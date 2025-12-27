import { Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import { Queue } from 'bullmq';
import { OrderRepository } from '@database/repositories/index';
import { Order, OrderStatus } from '@database/entities/order.entity';
import { Market } from '@database/entities/market.entity';
import { AppLogger, LogPrefix } from '@common/logger/index';
import { OrderFactory } from '@common/factories/index';
import {
  OrderNotFoundException,
  OrderNotCancellableException,
  MarketNotFoundException,
  MarketNotActiveException,
  OptimisticLockException,
  InvalidSignatureException,
} from '@common/exceptions/index';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { OrderResponseDto, OrderListResponseDto } from './dto/order-response.dto';
import type { OrderJobData } from '@app-types/index';
import { PolymarketClobService } from '@providers/polymarket/polymarket-clob.service';
import { SignatureValidationService } from '@common/services/signature-validation.service';
import { createOrderMessage } from '@common/utils/message-utils';

export type { OrderJobData };

@Injectable()
export class OrdersService {
  private readonly logger: AppLogger;

  constructor(
    private readonly orderRepository: OrderRepository,
    @InjectQueue('orders')
    private readonly ordersQueue: Queue<OrderJobData>,
    private readonly dataSource: DataSource,
    private readonly signatureValidationService: SignatureValidationService,
    @Optional()
    private readonly clobService?: PolymarketClobService,
    logger?: AppLogger,
  ) {
    this.logger = (logger || new AppLogger())
      .setPrefix(LogPrefix.ORDER)
      .setContext(OrdersService.name);
  }

  async createOrder(dto: CreateOrderDto, idempotencyKey: string): Promise<OrderResponseDto> {
    this.logger
      .setContextData({ marketId: dto.marketId, idempotencyKey })
      .log('Creating new order');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const market = await queryRunner.manager.findOne(Market, {
        where: { id: dto.marketId },
        lock: { mode: 'pessimistic_read' },
      });

      if (!market) {
        this.logger.warn('Market not found');
        throw new MarketNotFoundException(String(dto.marketId));
      }

      if (!market.active || market.closed) {
        this.logger.warn('Market not active or closed');
        throw new MarketNotActiveException(String(dto.marketId));
      }

      let userWalletAddress: string | null = null;
      if (dto.walletAddress) {
        if (!dto.signature || !dto.nonce) {
          throw new InvalidSignatureException(
            'Signature and nonce are required when wallet address is provided',
          );
        }

        const message = createOrderMessage(dto, dto.nonce);
        const isValid = this.signatureValidationService.verifyMessage(
          message,
          dto.signature,
          dto.walletAddress,
        );

        if (!isValid) {
          this.logger.warn(`Invalid signature for wallet ${dto.walletAddress}`);
          throw new InvalidSignatureException();
        }

        userWalletAddress = dto.walletAddress;
        this.logger.log(`Wallet signature validated for ${dto.walletAddress}`);
      }

      const order = queryRunner.manager.create(
        Order,
        OrderFactory.create({ dto, idempotencyKey, userWalletAddress }),
      );

      const savedOrder = await queryRunner.manager.save(Order, order);
      await queryRunner.commitTransaction();

      await this.queueOrder(savedOrder.id);

      this.logger.setContextData({ orderId: savedOrder.id }).log('Order created successfully');
      return OrderFactory.toResponse(savedOrder);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getOrder(id: number): Promise<OrderResponseDto> {
    this.logger.setContextData({ orderId: id }).log('Fetching order details');

    const order = await this.orderRepository.findById(id);

    if (!order) {
      this.logger.warn('Order not found');
      throw new OrderNotFoundException(String(id));
    }

    return OrderFactory.toResponse(order);
  }

  async getOrders(query: QueryOrdersDto): Promise<OrderListResponseDto> {
    this.logger.log('Fetching orders list');

    const qb = this.orderRepository.createQueryBuilder('order');

    if (query.marketId) {
      qb.andWhere('order.market_id = :marketId', { marketId: query.marketId });
    }

    if (query.status) {
      qb.andWhere('order.status = :status', { status: query.status });
    }

    if (query.side) {
      qb.andWhere('order.side = :side', { side: query.side });
    }

    if (query.outcome) {
      qb.andWhere('order.outcome = :outcome', { outcome: query.outcome });
    }

    qb.orderBy('order.created_at', 'DESC');

    const result = await this.orderRepository.paginate(qb, {
      page: query.page ?? 1,
      size: query.limit ?? query.pageSize ?? 20,
    });

    this.logger.log(`Found ${result.meta.total} orders`);

    let stats;
    if (this.clobService?.isRealTradingEnabled() && this.clobService?.isServerWalletConfigured()) {
      try {
        const [openOrders, trades] = await Promise.all([
          this.clobService.getOpenOrders(),
          this.clobService.getTrades(),
        ]);

        stats = {
          totalOrders: result.meta.total,
          openOrders: openOrders.length,
          trades: trades.length,
        };
      } catch (error) {
        this.logger.warn(`Failed to fetch CLOB stats: ${(error as Error).message}`);
      }
    }

    return {
      data: result.data.map((order) => OrderFactory.toResponse(order)),
      meta: result.meta,
      stats,
    };
  }

  async cancelOrder(id: number): Promise<OrderResponseDto> {
    this.logger.setContextData({ orderId: id }).log('Cancelling order');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        this.logger.warn('Order not found');
        throw new OrderNotFoundException(String(id));
      }

      const cancellableStatuses: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.QUEUED];

      if (!cancellableStatuses.includes(order.status)) {
        this.logger.warn(`Order cannot be cancelled in status: ${order.status}`);
        throw new OrderNotCancellableException(String(id), order.status);
      }

      const wasQueued = order.status === OrderStatus.QUEUED;

      order.status = OrderStatus.CANCELLED;
      const savedOrder = await queryRunner.manager.save(Order, order);

      await queryRunner.commitTransaction();

      if (wasQueued) {
        await this.removeOrderFromQueue(id);
      }

      this.logger.log('Order cancelled successfully');
      return OrderFactory.toResponse(savedOrder);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateOrderStatus(
    id: number,
    status: OrderStatus,
    updates?: Partial<
      Pick<Order, 'filledQuantity' | 'averageFillPrice' | 'externalOrderId' | 'failureReason'>
    >,
  ): Promise<Order> {
    this.logger.setContextData({ orderId: id, status }).log('Updating order status');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new OrderNotFoundException(String(id));
      }

      const previousVersion = order.version;
      order.status = status;

      if (updates) {
        if (updates.filledQuantity !== undefined) order.filledQuantity = updates.filledQuantity;
        if (updates.averageFillPrice !== undefined)
          order.averageFillPrice = updates.averageFillPrice;
        if (updates.externalOrderId !== undefined) order.externalOrderId = updates.externalOrderId;
        if (updates.failureReason !== undefined) order.failureReason = updates.failureReason;
      }

      const savedOrder = await queryRunner.manager.save(Order, order);

      if (savedOrder.version !== previousVersion + 1) {
        throw new OptimisticLockException('Order', String(id));
      }

      await queryRunner.commitTransaction();
      this.logger.log('Order status updated successfully');
      return savedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async queueOrder(orderId: number): Promise<void> {
    this.logger.setContextData({ orderId }).log('Queueing order for processing');

    await this.ordersQueue.add(
      'process-order',
      { orderId, attempt: 1 },
      {
        priority: 10,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          age: 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 86400,
        },
      },
    );

    await this.orderRepository.updateStatus(orderId, OrderStatus.QUEUED);
    this.logger.log('Order queued successfully');
  }

  private async removeOrderFromQueue(orderId: number): Promise<void> {
    this.logger.setContextData({ orderId }).log('Removing order from queue');

    try {
      const jobs = await this.ordersQueue.getJobs(['waiting', 'delayed', 'active']);

      const jobsToRemove = jobs.filter((job) => job.data.orderId === orderId);

      for (const job of jobsToRemove) {
        await job.remove();
        this.logger.log(`Removed job ${job.id} from queue`);
      }

      if (jobsToRemove.length === 0) {
        this.logger.warn('No matching jobs found in queue');
      } else {
        this.logger.log(`Removed ${jobsToRemove.length} job(s) from queue`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to remove order from queue: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
