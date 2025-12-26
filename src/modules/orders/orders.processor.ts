import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import { Job } from 'bullmq';
import { OrderRepository, MarketRepository } from '@database/repositories/index';
import { Order, OrderStatus, OrderType } from '@database/entities/order.entity';
import { Market } from '@database/entities/market.entity';
import { AppLogger, LogPrefix } from '@common/logger/index';
import type { OrderJobData } from '@app-types/index';

@Processor('orders')
export class OrdersProcessor extends WorkerHost {
  private readonly logger: AppLogger;

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly marketRepository: MarketRepository,
    private readonly dataSource: DataSource,
    logger: AppLogger,
  ) {
    super();
    this.logger = logger.setPrefix(LogPrefix.QUEUE).setContext(OrdersProcessor.name);
  }

  async process(job: Job<OrderJobData>): Promise<void> {
    const { orderId, attempt } = job.data;
    const jobLogger = this.logger.child({ orderId, attempt, jobId: job.id });

    jobLogger.log('Processing order');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        jobLogger.warn('Order not found, skipping');
        await queryRunner.rollbackTransaction();
        return;
      }

      if (!this.isProcessable(order)) {
        jobLogger.log(`Order not processable (status: ${order.status}), skipping`);
        await queryRunner.rollbackTransaction();
        return;
      }

      order.status = OrderStatus.PROCESSING;
      await queryRunner.manager.save(Order, order);

      const market = await queryRunner.manager.findOne(Market, {
        where: { id: order.marketId },
        lock: { mode: 'pessimistic_read' },
      });

      if (!market) {
        await this.failOrder(queryRunner, order, 'Market not found', jobLogger);
        return;
      }

      if (!market.active || market.closed) {
        await this.failOrder(queryRunner, order, 'Market is not active', jobLogger);
        return;
      }

      const executionResult = await this.simulateExecution(order, market);

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

    const maxAttempts = job.opts.attempts ?? 3;
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

      const marketPrice =
        order.outcome === 'YES'
          ? parseFloat(market.outcomeYesPrice)
          : parseFloat(market.outcomeNoPrice);
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
