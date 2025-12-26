import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { OrdersService } from './orders.service';
import { OrderRepository } from '@database/repositories/order.repository';
import { Order, OrderStatus, OrderSide, OrderType, OrderOutcome } from '@database/entities/order.entity';
import { Market } from '@database/entities/market.entity';
import { AppLogger } from '@common/logger/app-logger.service';
import {
  OrderNotFoundException,
  OrderNotCancellableException,
  MarketNotFoundException,
  MarketNotActiveException,
} from '@common/exceptions';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: jest.Mocked<OrderRepository>;
  let ordersQueue: jest.Mocked<Queue>;
  let dataSource: jest.Mocked<DataSource>;
  let queryRunner: jest.Mocked<QueryRunner>;

  const mockLogger = {
    setPrefix: jest.fn().mockReturnThis(),
    setContext: jest.fn().mockReturnThis(),
    setContextData: jest.fn().mockReturnThis(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockOrder: Order = {
    id: 1,
    idempotencyKey: 'idem-123',
    marketId: 1,
    side: OrderSide.BUY,
    type: OrderType.LIMIT,
    outcome: OrderOutcome.YES,
    quantity: '100',
    price: '0.65',
    status: OrderStatus.PENDING,
    filledQuantity: '0',
    averageFillPrice: null,
    externalOrderId: null,
    failureReason: null,
    metadata: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    market: {} as Market,
  };

  const mockMarket: Market = {
    id: 1,
    externalId: 'market-123',
    provider: 'polymarket',
    eventId: 1,
    conditionId: 'condition-456',
    question: 'Test?',
    description: null,
    outcomeYesPrice: '0.65',
    outcomeNoPrice: '0.35',
    volume: null,
    liquidity: null,
    active: true,
    closed: false,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    event: {} as never,
    tokens: [],
    orders: [],
  };

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      } as any,
    } as unknown as jest.Mocked<QueryRunner>;

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as jest.Mocked<DataSource>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: OrderRepository,
          useValue: {
            findById: jest.fn(),
            createQueryBuilder: jest.fn(),
            paginate: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: getQueueToken('orders'),
          useValue: {
            add: jest.fn(),
            getJobs: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: AppLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    orderRepository = module.get(OrderRepository);
    ordersQueue = module.get(getQueueToken('orders'));
  });

  describe('createOrder', () => {
    it('should create and queue a new order', async () => {
      queryRunner.manager.findOne.mockResolvedValueOnce(mockMarket);
      queryRunner.manager.create.mockReturnValue(mockOrder);
      queryRunner.manager.save.mockResolvedValue(mockOrder);
      ordersQueue.add.mockResolvedValue({} as never);
      orderRepository.updateStatus.mockResolvedValue(undefined);

      const dto = {
        marketId: 1,
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        outcome: OrderOutcome.YES,
        quantity: '100',
        price: '0.65',
      };

      const result = await service.createOrder(dto, 'idem-123');

      expect(result.id).toBe(1);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(ordersQueue.add).toHaveBeenCalledWith('process-order', expect.any(Object), expect.any(Object));
    });

    it('should throw MarketNotFoundException if market not found', async () => {
      queryRunner.manager.findOne.mockResolvedValueOnce(null);

      const dto = {
        marketId: 999,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        outcome: OrderOutcome.YES,
        quantity: '50',
      };

      await expect(service.createOrder(dto, 'idem-456')).rejects.toThrow(MarketNotFoundException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw MarketNotActiveException if market is closed', async () => {
      const closedMarket = { ...mockMarket, closed: true };
      queryRunner.manager.findOne.mockResolvedValueOnce(closedMarket);

      const dto = {
        marketId: 1,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        outcome: OrderOutcome.YES,
        quantity: '50',
      };

      await expect(service.createOrder(dto, 'idem-789')).rejects.toThrow(MarketNotActiveException);
    });

    it('should throw MarketNotActiveException if market is inactive', async () => {
      const inactiveMarket = { ...mockMarket, active: false };
      queryRunner.manager.findOne.mockResolvedValueOnce(inactiveMarket);

      const dto = {
        marketId: 1,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        outcome: OrderOutcome.YES,
        quantity: '50',
      };

      await expect(service.createOrder(dto, 'idem-abc')).rejects.toThrow(MarketNotActiveException);
    });
  });

  describe('getOrder', () => {
    it('should return order by id', async () => {
      orderRepository.findById.mockResolvedValue(mockOrder);

      const result = await service.getOrder(1);

      expect(result.id).toBe(1);
      expect(result.status).toBe(OrderStatus.PENDING);
    });

    it('should throw OrderNotFoundException if order not found', async () => {
      orderRepository.findById.mockResolvedValue(null);

      await expect(service.getOrder(999)).rejects.toThrow(OrderNotFoundException);
    });
  });

  describe('getOrders', () => {
    it('should return paginated orders', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
      };
      orderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      orderRepository.paginate.mockResolvedValue({
        data: [mockOrder],
        meta: { currentPage: 1, perPage: 20, total: 1, totalPages: 1 },
      });

      const result = await service.getOrders({ page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
    });

    it('should filter by status', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
      };
      orderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      orderRepository.paginate.mockResolvedValue({
        data: [],
        meta: { currentPage: 1, perPage: 20, total: 0, totalPages: 0 },
      });

      await service.getOrders({ status: OrderStatus.FILLED });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('order.status = :status', {
        status: OrderStatus.FILLED,
      });
    });

    it('should filter by marketId', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
      };
      orderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      orderRepository.paginate.mockResolvedValue({
        data: [],
        meta: { currentPage: 1, perPage: 20, total: 0, totalPages: 0 },
      });

      await service.getOrders({ marketId: 1 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('order.market_id = :marketId', {
        marketId: 1,
      });
    });

    it('should filter by side', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
      };
      orderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      orderRepository.paginate.mockResolvedValue({
        data: [],
        meta: { currentPage: 1, perPage: 20, total: 0, totalPages: 0 },
      });

      await service.getOrders({ side: OrderSide.BUY });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('order.side = :side', {
        side: OrderSide.BUY,
      });
    });

    it('should filter by outcome', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
      };
      orderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      orderRepository.paginate.mockResolvedValue({
        data: [],
        meta: { currentPage: 1, perPage: 20, total: 0, totalPages: 0 },
      });

      await service.getOrders({ outcome: OrderOutcome.YES });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('order.outcome = :outcome', {
        outcome: OrderOutcome.YES,
      });
    });
  });

  describe('cancelOrder', () => {
    it('should cancel a pending order', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING };
      queryRunner.manager.findOne.mockResolvedValue(pendingOrder);
      queryRunner.manager.save.mockResolvedValue({ ...pendingOrder, status: OrderStatus.CANCELLED });

      const result = await service.cancelOrder(1);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(ordersQueue.getJobs).not.toHaveBeenCalled(); // Not queued, so no queue removal
    });

    it('should cancel a queued order and remove from queue', async () => {
      const queuedOrder = { ...mockOrder, status: OrderStatus.QUEUED };
      const mockJob = {
        id: 'job-123',
        data: { orderId: 1, attempt: 1 },
        remove: jest.fn().mockResolvedValue(undefined),
      };

      queryRunner.manager.findOne.mockResolvedValue(queuedOrder);
      queryRunner.manager.save.mockResolvedValue({ ...queuedOrder, status: OrderStatus.CANCELLED });
      ordersQueue.getJobs.mockResolvedValue([mockJob] as never);

      const result = await service.cancelOrder(1);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(ordersQueue.getJobs).toHaveBeenCalledWith(['waiting', 'delayed', 'active']);
      expect(mockJob.remove).toHaveBeenCalled();
    });

    it('should handle queue removal when no jobs found', async () => {
      const queuedOrder = { ...mockOrder, status: OrderStatus.QUEUED };

      queryRunner.manager.findOne.mockResolvedValue(queuedOrder);
      queryRunner.manager.save.mockResolvedValue({ ...queuedOrder, status: OrderStatus.CANCELLED });
      ordersQueue.getJobs.mockResolvedValue([] as never);

      const result = await service.cancelOrder(1);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(ordersQueue.getJobs).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('No matching jobs found in queue');
    });

    it('should handle queue removal errors gracefully', async () => {
      const queuedOrder = { ...mockOrder, status: OrderStatus.QUEUED };

      queryRunner.manager.findOne.mockResolvedValue(queuedOrder);
      queryRunner.manager.save.mockResolvedValue({ ...queuedOrder, status: OrderStatus.CANCELLED });
      ordersQueue.getJobs.mockRejectedValue(new Error('Queue error'));

      const result = await service.cancelOrder(1);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to remove order from queue: Queue error',
        expect.any(String),
      );
    });

    it('should throw OrderNotFoundException if order not found', async () => {
      queryRunner.manager.findOne.mockResolvedValue(null);

      await expect(service.cancelOrder(999)).rejects.toThrow(OrderNotFoundException);
    });

    it('should throw OrderNotCancellableException if order is filled', async () => {
      const filledOrder = { ...mockOrder, status: OrderStatus.FILLED };
      queryRunner.manager.findOne.mockResolvedValue(filledOrder);

      await expect(service.cancelOrder(1)).rejects.toThrow(OrderNotCancellableException);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status successfully', async () => {
      const order = { ...mockOrder, version: 1 };
      const updatedOrder = { ...order, status: OrderStatus.FILLED, version: 2 };
      queryRunner.manager.findOne.mockResolvedValue(order);
      queryRunner.manager.save.mockResolvedValue(updatedOrder);

      const result = await service.updateOrderStatus(1, OrderStatus.FILLED);

      expect(result.status).toBe(OrderStatus.FILLED);
      expect(result.version).toBe(2);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should update order with additional fields', async () => {
      const order = { ...mockOrder, version: 1 };
      const updatedOrder = {
        ...order,
        status: OrderStatus.FILLED,
        filledQuantity: '100',
        averageFillPrice: '0.65',
        externalOrderId: 'ext-123',
        version: 2,
      };
      queryRunner.manager.findOne.mockResolvedValue(order);
      queryRunner.manager.save.mockResolvedValue(updatedOrder);

      const result = await service.updateOrderStatus(1, OrderStatus.FILLED, {
        filledQuantity: '100',
        averageFillPrice: '0.65',
        externalOrderId: 'ext-123',
      });

      expect(result.filledQuantity).toBe('100');
      expect(result.averageFillPrice).toBe('0.65');
      expect(result.externalOrderId).toBe('ext-123');
    });

    it('should update order with failure reason', async () => {
      const order = { ...mockOrder, version: 1 };
      const updatedOrder = {
        ...order,
        status: OrderStatus.FAILED,
        failureReason: 'Insufficient balance',
        version: 2,
      };
      queryRunner.manager.findOne.mockResolvedValue(order);
      queryRunner.manager.save.mockResolvedValue(updatedOrder);

      const result = await service.updateOrderStatus(1, OrderStatus.FAILED, {
        failureReason: 'Insufficient balance',
      });

      expect(result.status).toBe(OrderStatus.FAILED);
      expect(result.failureReason).toBe('Insufficient balance');
    });

    it('should throw OrderNotFoundException if order not found', async () => {
      queryRunner.manager.findOne.mockResolvedValue(null);

      await expect(service.updateOrderStatus(999, OrderStatus.FILLED)).rejects.toThrow(
        OrderNotFoundException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw OptimisticLockException on version mismatch', async () => {
      const order = { ...mockOrder, version: 1 };
      const updatedOrder = { ...order, status: OrderStatus.FILLED, version: 1 };
      queryRunner.manager.findOne.mockResolvedValue(order);
      queryRunner.manager.save.mockResolvedValue(updatedOrder);

      await expect(service.updateOrderStatus(1, OrderStatus.FILLED)).rejects.toThrow(
        'Order 1 was modified by another process',
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});

