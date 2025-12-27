import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Job } from 'bullmq';
import { OrderRepository } from '@database/repositories/index';
import { Order, OrderStatus, OrderType } from '@database/entities/order.entity';
import { Market } from '@database/entities/market.entity';
import { AppLogger, LogPrefix } from '@common/logger/index';
import type { OrderJobData, MarketProvider, OrderRequest } from '@app-types/index';
import { MARKET_PROVIDER } from '@providers/market-provider.interface';
import { UsdcTokenService } from '@common/services/usdc-token.service';

@Processor('orders')
export class OrdersProcessor extends WorkerHost {
  private readonly logger: AppLogger;
  private readonly enableRealTrading: boolean;

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly dataSource: DataSource,
    @Inject(MARKET_PROVIDER) private readonly marketProvider: MarketProvider,
    private readonly configService: ConfigService,
    private readonly usdcTokenService: UsdcTokenService,
    logger: AppLogger,
  ) {
    super();
    this.logger = logger.setPrefix(LogPrefix.QUEUE).setContext(OrdersProcessor.name);
    this.enableRealTrading =
      this.configService.get<boolean>('polymarket.enableRealTrading') ?? false;
  }

  async process(job: Job<OrderJobData>): Promise<void> {
    const { orderId, attempt } = job.data;
    const jobLogger = this.logger.child({ orderId, attempt, jobId: job.id });

    jobLogger.log('Processing order');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    await queryRunner.startTransaction('READ COMMITTED');

    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: orderId },
      });

      if (!order) {
        jobLogger.warn('Order not found, skipping');
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        return;
      }

      if (!this.isProcessable(order)) {
        jobLogger.log(`Order not processable (status: ${order.status}), skipping`);
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        return;
      }

      order.status = OrderStatus.PROCESSING;
      await queryRunner.manager.save(Order, order);

      const market = await queryRunner.manager.findOne(Market, {
        where: { id: order.marketId },
      });

      if (!market) {
        await this.failOrder(queryRunner, order, 'Market not found', jobLogger);
        return;
      }

      if (!market.active || market.closed) {
        await this.failOrder(queryRunner, order, 'Market is not active', jobLogger);
        return;
      }

      const executionResult = await this.executeOrder(order, market, jobLogger);

      if (executionResult.success && executionResult.fillPrice) {
        order.status = OrderStatus.FILLED;
        order.filledQuantity = order.quantity;
        order.averageFillPrice = executionResult.fillPrice;
        order.externalOrderId = executionResult.externalOrderId ?? null;

        jobLogger.log(`Order filled at price ${executionResult.fillPrice}`);
      } else {
        order.status = OrderStatus.FAILED;
        order.failureReason = executionResult.reason ?? 'Unknown error';

        jobLogger.warn(`Order execution failed: ${executionResult.reason}`);
      }

      await queryRunner.manager.save(Order, order);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      jobLogger.error(
        `Error processing order: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<OrderJobData>) {
    this.logger.child({ orderId: job.data.orderId, jobId: job.id }).log('Job completed');
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<OrderJobData>, error: Error) {
    const jobLogger = this.logger.child({
      orderId: job.data.orderId,
      jobId: job.id,
    });
    jobLogger.error(`Job failed: ${error.message}`, error.stack);

    const maxAttempts = job.opts.attempts ?? 10;

    if (job.attemptsMade >= maxAttempts) {
      await this.orderRepository.markAsFailed(
        job.data.orderId,
        `Processing failed after ${job.attemptsMade} attempts: ${error.message}`,
      );
      jobLogger.warn('Max attempts reached, order marked as failed');
    }
  }

  private isProcessable(order: Order): boolean {
    const processableStatuses: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.QUEUED];
    return processableStatuses.includes(order.status);
  }

  private async failOrder(
    queryRunner: ReturnType<DataSource['createQueryRunner']>,
    order: Order,
    reason: string,
    logger: AppLogger,
  ): Promise<void> {
    order.status = OrderStatus.FAILED;
    order.failureReason = reason;
    await queryRunner.manager.save(Order, order);
    await queryRunner.commitTransaction();
    logger.warn(`Order failed: ${reason}`);
  }

  private async executeOrder(
    order: Order,
    market: Market,
    logger: AppLogger,
  ): Promise<{
    success: boolean;
    fillPrice?: string;
    externalOrderId?: string;
    reason?: string;
  }> {
    if (this.enableRealTrading) {
      return this.executeRealOrder(order, market, logger);
    } else {
      logger.log('Simulating order execution');
      return this.simulateExecution(order, market);
    }
  }

  private async executeRealOrder(
    order: Order,
    market: Market,
    logger: AppLogger,
  ): Promise<{
    success: boolean;
    fillPrice?: string;
    externalOrderId?: string;
    reason?: string;
  }> {
    try {
      if (!market.conditionId) {
        logger.warn(
          `Market ${market.id} does not have a conditionId. The market may need to be synced from Polymarket.`,
        );
        return {
          success: false,
          reason: 'Market condition ID not found. Please sync the market from Polymarket.',
        };
      }

      const isPolymarketHealthy = await this.marketProvider.healthCheck();

      if (!isPolymarketHealthy) {
        logger.error('Polymarket API is unavailable. Order will be retried shortly.');

        throw new Error('Polymarket API is currently unavailable. Please try again later.');
      }

      if (order.userWalletAddress) {
        logger.log(`Order has user wallet: ${order.userWalletAddress}`);

        try {
          const usdcAmount = this.calculateUsdcAmount(order, market);

          logger.log(`Calculated USDC amount needed: ${usdcAmount} USDC`);

          const userBalance = await this.usdcTokenService.getBalance(order.userWalletAddress);

          logger.log(`User USDC balance: ${userBalance} USDC`);

          if (parseFloat(userBalance) < parseFloat(usdcAmount)) {
            return {
              success: false,
              reason: `Insufficient USDC balance. Required: ${usdcAmount}, Available: ${userBalance}`,
            };
          }

          const allowance = await this.usdcTokenService.getAllowance(order.userWalletAddress);

          logger.log(`User USDC allowance: ${allowance} USDC`);

          if (parseFloat(allowance) < parseFloat(usdcAmount)) {
            return {
              success: false,
              reason: `Insufficient USDC allowance. Required: ${usdcAmount}, Approved: ${allowance}. Please approve USDC spending first.`,
            };
          }

          if (order.side === 'BUY' && parseFloat(usdcAmount) > 0) {
            logger.log(
              `Transferring ${usdcAmount} USDC from ${order.userWalletAddress} to funder address`,
            );
            const txHash = await this.usdcTokenService.transferFromUser(
              order.userWalletAddress,
              usdcAmount,
            );
            logger.log(`USDC transfer completed. Transaction: ${txHash}`);

            const funderAddress = this.usdcTokenService.getFunderAddress();

            const funderBalance = await this.usdcTokenService.getBalance(funderAddress);

            logger.log(`Funder address USDC balance after transfer: ${funderBalance} USDC`);

            if (parseFloat(funderBalance) < parseFloat(usdcAmount) * 0.99) {
              logger.warn(
                `Funder address balance (${funderBalance}) is less than expected (${usdcAmount}). ` +
                  `This might cause order placement to fail. Please check the funder address balance.`,
              );
            }
          }
        } catch (transferError) {
          const errorMessage = (transferError as Error).message;
          logger.error(`Failed to transfer USDC: ${errorMessage}`);
          return {
            success: false,
            reason: `Failed to transfer USDC: ${errorMessage}`,
          };
        }
      }

      logger.log(`Executing real order on Polymarket with conditionId: ${market.conditionId}`);

      const orderRequest: OrderRequest = {
        marketId: market.conditionId,
        side: order.side,
        type: order.type,
        outcome: order.outcome,
        quantity: order.quantity,
        price: order.price ?? undefined,
      };

      try {
        const result = await this.marketProvider.placeOrder!(orderRequest);

        logger.log(`Real order placed with external ID: ${result.orderId}`);

        return {
          success: result.status === 'FILLED' || result.status === 'PENDING',
          fillPrice: result.averagePrice || order.price || '0',
          externalOrderId: result.orderId,
          reason: result.message,
        };
      } catch (placeOrderError) {
        const errorMessage = (placeOrderError as Error).message;

        if (
          errorMessage.includes('invalid price') ||
          (errorMessage.includes('price') &&
            errorMessage.includes('min') &&
            errorMessage.includes('max'))
        ) {
          logger.error(
            `Order placement failed due to invalid price: ${errorMessage}. ` +
              `Polymarket only accepts prices between 0.01 and 0.99.`,
          );
          return {
            success: false,
            reason: `Invalid order price: ${errorMessage}. Prices must be between $0.01 and $0.99.`,
          };
        }

        if (
          errorMessage.includes('invalid signature') ||
          errorMessage.includes('signature') ||
          errorMessage.includes('authentication') ||
          errorMessage.includes('Failed to authenticate')
        ) {
          logger.error(
            `Order placement failed due to authentication/signature error: ${errorMessage}. ` +
              `The server wallet may need to re-authenticate with Polymarket.`,
          );
          return {
            success: false,
            reason: `Order placement failed: ${errorMessage}. The system will attempt to re-authenticate on the next order.`,
          };
        }

        if (
          errorMessage.includes('Market not found') ||
          errorMessage.includes('404') ||
          (errorMessage.includes('invalid') && errorMessage.includes('market'))
        ) {
          logger.warn(
            `Market conditionId ${market.conditionId} is invalid. The market may need to be re-synced from Polymarket. ` +
              `Market ID: ${market.id}, External ID: ${market.externalId}`,
          );
          return {
            success: false,
            reason: `Market conditionId is invalid or the market has been removed from Polymarket. Please re-sync the market (ID: ${market.id}) from Polymarket to update the conditionId.`,
          };
        }

        throw placeOrderError;
      }
    } catch (error) {
      logger.error(`Real order execution failed: ${(error as Error).message}`);
      return {
        success: false,
        reason: `Real execution failed: ${(error as Error).message}`,
      };
    }
  }

  private calculateUsdcAmount(order: Order, market?: Market): string {
    if (order.side === 'SELL') {
      return '0';
    }

    let price: number;

    if (order.type === OrderType.MARKET) {
      if (!market) {
        throw new Error('Market data is required to calculate USDC amount for MARKET orders');
      }

      const marketPrice = order.outcome === 'YES' ? market.outcomeYesPrice : market.outcomeNoPrice;

      if (!marketPrice) {
        throw new Error(`Market price not available for ${order.outcome} outcome`);
      }

      price = parseFloat(marketPrice);
    } else {
      if (!order.price) {
        throw new Error('Price is required for LIMIT orders');
      }
      price = parseFloat(order.price);
    }

    const quantity = parseFloat(order.quantity);
    let amount = price * quantity;

    const minimumOrderValue = 1.0;

    if (amount < minimumOrderValue) {
      amount = minimumOrderValue;
    }

    const bufferAmount = amount * 0.01;

    const estimatedGasFeeUsd = 0.0005;

    const totalAmount = amount + bufferAmount + estimatedGasFeeUsd;

    return totalAmount.toFixed(6);
  }

  private async simulateExecution(
    order: Order,
    market: Market,
  ): Promise<{
    success: boolean;
    fillPrice?: string;
    externalOrderId?: string;
    reason?: string;
  }> {
    await this.delay(100 + Math.random() * 200);

    if (Math.random() < 0.05) {
      return {
        success: false,
        reason: 'Simulated execution failure - insufficient liquidity',
      };
    }

    let fillPrice: string;

    if (order.type === OrderType.MARKET) {
      const price = order.outcome === 'YES' ? market.outcomeYesPrice : market.outcomeNoPrice;
      fillPrice = price;
    } else {
      if (!order.price) {
        return {
          success: false,
          reason: 'Limit order requires a price',
        };
      }

      let marketPrice = parseFloat(market.outcomeNoPrice);

      if (order.outcome === 'YES') {
        marketPrice = parseFloat(market.outcomeYesPrice);
      }

      const limitPrice = parseFloat(order.price);

      if (order.side === 'BUY' && marketPrice > limitPrice) {
        return {
          success: false,
          reason: `Market price ${marketPrice} exceeds limit price ${limitPrice}`,
        };
      }
      if (order.side === 'SELL' && marketPrice < limitPrice) {
        return {
          success: false,
          reason: `Market price ${marketPrice} below limit price ${limitPrice}`,
        };
      }

      fillPrice = order.price;
    }

    const externalOrderId = `sim-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    return {
      success: true,
      fillPrice,
      externalOrderId,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
