import { Test, TestingModule } from '@nestjs/testing';
import { SignatureValidationService } from '@common/services/signature-validation.service';
import { DataSource, QueryRunner } from 'typeorm';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { OrdersService } from './orders.service';
import { OrderRepository, MarketRepository } from '@database/repositories';
import { Order, OrderStatus, OrderSide, OrderType, OrderOutcome } from '@database/entities/order.entity';
import { Market } from '@database/entities/market.entity';
import { AppLogger } from '@common/logger/app-logger.service';
import { OrderNotFoundException, OrderNotCancellableException, MarketNotFoundException, MarketNotActiveException } from '@common/exceptions';
import { MARKET_PROVIDER } from '@providers/market-provider.interface';
import type { MarketProvider } from '@app-types/index';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: jest.Mocked<OrderRepository>;
  let ordersQueue: jest.Mocked<Queue>;
  let dataSource: jest.Mocked<DataSource>;
  let queryRunner: jest.Mocked<QueryRunner>;
  let marketProvider: jest.Mocked<MarketProvider>;

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
    userWalletAddress: null,
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
    image: null,
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
        update: jest.fn(),
      } as any,
    } as unknown as jest.Mocked<QueryRunner>;

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as jest.Mocked<DataSource>;

    marketProvider = {
      providerName: 'polymarket',
      getName: jest.fn().mockReturnValue('polymarket'),
      getEvents: jest.fn(),
      getMarkets: jest.fn(),
      getAllMarkets: jest.fn(),
      getMarketPrice: jest.fn(),
      placeOrder: jest.fn(),
      cancelOrder: jest.fn(),
      getOrderStatus: jest.fn(),
      healthCheck: jest.fn(),
    } as jest.Mocked<MarketProvider>;

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
        {
          provide: SignatureValidationService,
          useValue: {
            validateSignature: jest.fn(),
          },
        },
        {
          provide: MarketRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: MARKET_PROVIDER,
          useValue: marketProvider,
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
      expect(ordersQueue.add).toHaveBeenCalledWith(
        'process-order',
        expect.any(Object),
        expect.objectContaining({
          delay: 10000,
        }),
      );
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

    it('should calculate quantity from amount for BUY orders', async () => {
      queryRunner.manager.findOne.mockResolvedValueOnce(mockMarket);
      const orderWithCalculatedQuantity = {
        ...mockOrder,
        quantity: '2.85714286',
      };
      queryRunner.manager.create.mockReturnValue(orderWithCalculatedQuantity);
      queryRunner.manager.save.mockResolvedValue(orderWithCalculatedQuantity);
      ordersQueue.add.mockResolvedValue({} as never);
      orderRepository.updateStatus.mockResolvedValue(undefined);

      const dto = {
        marketId: 1,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        outcome: OrderOutcome.NO,
        amount: '1',
      };

      const result = await service.createOrder(dto, 'idem-amount-123');

      expect(result.id).toBe(1);
      expect(queryRunner.manager.create).toHaveBeenCalledWith(
        Order,
        expect.objectContaining({
          quantity: '2.85714286',
        }),
      );
    });

    it('should calculate quantity from amount and use provided price for LIMIT orders', async () => {
      queryRunner.manager.findOne.mockResolvedValueOnce(mockMarket);
      const orderWithCalculatedQuantity = {
        ...mockOrder,
        quantity: '500.00000000',
        price: '0.002',
      };
      queryRunner.manager.create.mockReturnValue(orderWithCalculatedQuantity);
      queryRunner.manager.save.mockResolvedValue(orderWithCalculatedQuantity);
      ordersQueue.add.mockResolvedValue({} as never);
      orderRepository.updateStatus.mockResolvedValue(undefined);

      const dto = {
        marketId: 1,
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        outcome: OrderOutcome.YES,
        amount: '1',
        price: '0.002',
      };

      const result = await service.createOrder(dto, 'idem-amount-limit-123');

      expect(result.id).toBe(1);
      expect(queryRunner.manager.create).toHaveBeenCalledWith(
        Order,
        expect.objectContaining({
          quantity: '500.00000000',
          price: '0.002',
        }),
      );
    });
  });

  describe('getOrder', () => {
    it('should return order by id', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockOrder),
      };
      orderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);

      const result = await service.getOrder(1);

      expect(result.id).toBe(1);
      expect(result.status).toBe(OrderStatus.PENDING);
    });

    it('should throw OrderNotFoundException if order not found', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      orderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);

      await expect(service.getOrder(999)).rejects.toThrow(OrderNotFoundException);
    });
  });

  describe('getOrders', () => {
    it('should return paginated orders', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
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
        leftJoinAndSelect: jest.fn().mockReturnThis(),
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
        leftJoinAndSelect: jest.fn().mockReturnThis(),
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
        leftJoinAndSelect: jest.fn().mockReturnThis(),
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
        leftJoinAndSelect: jest.fn().mockReturnThis(),
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
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should cancel a pending order', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING };
      queryRunner.manager.findOne.mockResolvedValue(pendingOrder);
      queryRunner.manager.save.mockResolvedValue({
        ...pendingOrder,
        status: OrderStatus.CANCELLED,
      });

      const result = await service.cancelOrder(1);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(ordersQueue.getJobs).not.toHaveBeenCalled();
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
      expect(mockLogger.log).not.toHaveBeenCalledWith(expect.stringContaining('Removed'));
    });

    it('should handle queue removal errors gracefully', async () => {
      const queuedOrder = { ...mockOrder, status: OrderStatus.QUEUED };

      queryRunner.manager.findOne.mockResolvedValue(queuedOrder);
      queryRunner.manager.save.mockResolvedValue({ ...queuedOrder, status: OrderStatus.CANCELLED });
      ordersQueue.getJobs.mockRejectedValue(new Error('Queue error'));

      const result = await service.cancelOrder(1);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to remove order from queue: Queue error', expect.any(String));
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

    it('should throw OrderNotCancellableException if order is cancelled', async () => {
      const cancelledOrder = { ...mockOrder, status: OrderStatus.CANCELLED };
      queryRunner.manager.findOne.mockResolvedValue(cancelledOrder);

      await expect(service.cancelOrder(1)).rejects.toThrow(OrderNotCancellableException);
    });

    it('should throw OrderNotCancellableException if order is failed', async () => {
      const failedOrder = { ...mockOrder, status: OrderStatus.FAILED };
      queryRunner.manager.findOne.mockResolvedValue(failedOrder);

      await expect(service.cancelOrder(1)).rejects.toThrow(OrderNotCancellableException);
    });

    it('should allow cancellation of PROCESSING order with externalOrderId', async () => {
      const processingOrder = {
        ...mockOrder,
        status: OrderStatus.PROCESSING,
        externalOrderId: 'ext-order-123',
      };

      queryRunner.manager.findOne.mockResolvedValue(processingOrder);
      queryRunner.manager.save.mockResolvedValue({
        ...processingOrder,
        status: OrderStatus.CANCELLED,
      });
      marketProvider.cancelOrder.mockResolvedValue({
        success: true,
        orderId: 'ext-order-123',
        message: 'Order cancelled successfully',
      });

      const result = await service.cancelOrder(1);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(marketProvider.cancelOrder).toHaveBeenCalledWith('ext-order-123', undefined);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw OrderNotCancellableException for PROCESSING order without externalOrderId', async () => {
      const processingOrder = {
        ...mockOrder,
        status: OrderStatus.PROCESSING,
        externalOrderId: null,
      };

      queryRunner.manager.findOne.mockResolvedValue(processingOrder);

      await expect(service.cancelOrder(1)).rejects.toThrow(OrderNotCancellableException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should cancel order with externalOrderId and call provider cancelOrder', async () => {
      const orderWithExternal = {
        ...mockOrder,
        status: OrderStatus.PENDING,
        externalOrderId: 'ext-order-456',
      };

      queryRunner.manager.findOne.mockResolvedValue(orderWithExternal);
      queryRunner.manager.save.mockResolvedValue({
        ...orderWithExternal,
        status: OrderStatus.CANCELLED,
      });
      marketProvider.cancelOrder.mockResolvedValue({
        success: true,
        orderId: 'ext-order-456',
      });

      const result = await service.cancelOrder(1);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(marketProvider.cancelOrder).toHaveBeenCalledWith('ext-order-456', undefined);
    });

    it('should proceed with local cancellation if provider cancelOrder fails', async () => {
      const orderWithExternal = {
        ...mockOrder,
        status: OrderStatus.PENDING,
        externalOrderId: 'ext-order-789',
      };

      queryRunner.manager.findOne.mockResolvedValue(orderWithExternal);
      queryRunner.manager.save.mockResolvedValue({
        ...orderWithExternal,
        status: OrderStatus.CANCELLED,
      });
      marketProvider.cancelOrder.mockResolvedValue({
        success: false,
        orderId: 'ext-order-789',
        message: 'Order already cancelled on provider',
      });

      const result = await service.cancelOrder(1);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to cancel order on Polymarket'));
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should proceed with local cancellation if provider cancelOrder throws error', async () => {
      const orderWithExternal = {
        ...mockOrder,
        status: OrderStatus.PENDING,
        externalOrderId: 'ext-order-error',
      };

      queryRunner.manager.findOne.mockResolvedValue(orderWithExternal);
      queryRunner.manager.save.mockResolvedValue({
        ...orderWithExternal,
        status: OrderStatus.CANCELLED,
      });
      marketProvider.cancelOrder.mockRejectedValue(new Error('Network timeout'));

      const result = await service.cancelOrder(1);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Error cancelling order on Polymarket: Network timeout'));
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should pass walletContext when cancelling order with userWalletAddress', async () => {
      const orderWithWallet = {
        ...mockOrder,
        status: OrderStatus.PENDING,
        externalOrderId: 'ext-order-wallet',
        userWalletAddress: '0x1234567890abcdef',
      };

      queryRunner.manager.findOne.mockResolvedValue(orderWithWallet);
      queryRunner.manager.save.mockResolvedValue({
        ...orderWithWallet,
        status: OrderStatus.CANCELLED,
      });
      marketProvider.cancelOrder.mockResolvedValue({
        success: true,
        orderId: 'ext-order-wallet',
      });

      const result = await service.cancelOrder(1);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(marketProvider.cancelOrder).toHaveBeenCalledWith('ext-order-wallet', {
        walletAddress: '0x1234567890abcdef',
        signature: '',
        nonce: '',
        message: '',
      });
    });

    it('should handle transaction rollback on database error', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING };
      queryRunner.manager.findOne.mockResolvedValue(pendingOrder);
      queryRunner.manager.save.mockRejectedValue(new Error('Database connection lost'));

      await expect(service.cancelOrder(1)).rejects.toThrow('Database connection lost');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should remove multiple jobs from queue if they exist', async () => {
      const queuedOrder = { ...mockOrder, status: OrderStatus.QUEUED };
      const mockJob1 = {
        id: 'job-1',
        data: { orderId: 1, attempt: 1 },
        remove: jest.fn().mockResolvedValue(undefined),
      };
      const mockJob2 = {
        id: 'job-2',
        data: { orderId: 1, attempt: 2 },
        remove: jest.fn().mockResolvedValue(undefined),
      };

      queryRunner.manager.findOne.mockResolvedValue(queuedOrder);
      queryRunner.manager.save.mockResolvedValue({ ...queuedOrder, status: OrderStatus.CANCELLED });
      ordersQueue.getJobs.mockResolvedValue([mockJob1, mockJob2] as never);

      const result = await service.cancelOrder(1);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(mockJob1.remove).toHaveBeenCalled();
      expect(mockJob2.remove).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('Removed 2 job(s) from queue');
    });

    it('should not call cancelOrder on provider if order has no externalOrderId', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING, externalOrderId: null };
      queryRunner.manager.findOne.mockResolvedValue(pendingOrder);
      queryRunner.manager.save.mockResolvedValue({
        ...pendingOrder,
        status: OrderStatus.CANCELLED,
      });

      await service.cancelOrder(1);

      expect(marketProvider.cancelOrder).not.toHaveBeenCalled();
    });

    it('should use pessimistic write lock when fetching order', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING };
      queryRunner.manager.findOne.mockResolvedValue(pendingOrder);
      queryRunner.manager.save.mockResolvedValue({
        ...pendingOrder,
        status: OrderStatus.CANCELLED,
      });

      await service.cancelOrder(1);

      expect(queryRunner.manager.findOne).toHaveBeenCalledWith(Order, {
        where: { id: 1 },
        lock: { mode: 'pessimistic_write' },
      });
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

      await expect(service.updateOrderStatus(999, OrderStatus.FILLED)).rejects.toThrow(OrderNotFoundException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw OptimisticLockException on version mismatch', async () => {
      const order = { ...mockOrder, version: 1 };
      const updatedOrder = { ...order, status: OrderStatus.FILLED, version: 1 };
      queryRunner.manager.findOne.mockResolvedValue(order);
      queryRunner.manager.save.mockResolvedValue(updatedOrder);

      await expect(service.updateOrderStatus(1, OrderStatus.FILLED)).rejects.toThrow('Order 1 was modified by another process');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});
