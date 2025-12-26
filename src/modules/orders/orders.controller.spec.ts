import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderStatus, OrderSide, OrderType, OrderOutcome } from '@database/entities/order.entity';
import { IdempotencyKeyRequiredException } from '@common/exceptions';
import { IdempotencyInterceptor } from '@common/interceptors/idempotency.interceptor';
import { Reflector } from '@nestjs/core';
import { IdempotencyService } from '@common/services/idempotency.service';
import { AppLogger } from '@common/logger/app-logger.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: jest.Mocked<OrdersService>;

  const mockOrderResponse = {
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLogger = {
    setPrefix: jest.fn().mockReturnThis(),
    setContext: jest.fn().mockReturnThis(),
    setContextData: jest.fn().mockReturnThis(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            createOrder: jest.fn(),
            getOrder: jest.fn(),
            getOrders: jest.fn(),
            cancelOrder: jest.fn(),
          },
        },
        IdempotencyInterceptor,
        Reflector,
        {
          provide: IdempotencyService,
          useValue: {
            checkAndLock: jest.fn(),
            storeResponse: jest.fn(),
            releaseLock: jest.fn(),
          },
        },
        {
          provide: AppLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get(OrdersService);
  });

  describe('createOrder', () => {
    it('should create a new order', async () => {
      service.createOrder.mockResolvedValue(mockOrderResponse);

      const dto = {
        marketId: 1,
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        outcome: OrderOutcome.YES,
        quantity: '100',
        price: '0.65',
      };

      const result = await controller.createOrder(dto, 'idem-123');

      expect(result.id).toBe(1);
      expect(service.createOrder).toHaveBeenCalledWith(dto, 'idem-123');
    });

    it('should throw if no idempotency key', async () => {
      const dto = {
        marketId: 1,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        outcome: OrderOutcome.YES,
        quantity: '50',
      };

      await expect(controller.createOrder(dto, '')).rejects.toThrow(IdempotencyKeyRequiredException);
    });
  });

  describe('getOrder', () => {
    it('should return order by id', async () => {
      service.getOrder.mockResolvedValue(mockOrderResponse);

      const result = await controller.getOrder(1);

      expect(result.id).toBe(1);
      expect(service.getOrder).toHaveBeenCalledWith(1);
    });
  });

  describe('getOrders', () => {
    it('should return paginated orders', async () => {
      const ordersResponse = {
        data: [mockOrderResponse],
        meta: { page: 1, size: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
      };
      service.getOrders.mockResolvedValue(ordersResponse);

      const result = await controller.getOrders({ page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(service.getOrders).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    });

    it('should filter by status', async () => {
      service.getOrders.mockResolvedValue({
        data: [],
        meta: { page: 1, size: 20, total: 0, totalPages: 0, hasNext: false, hasPrevious: false },
      });

      await controller.getOrders({ status: OrderStatus.FILLED });

      expect(service.getOrders).toHaveBeenCalledWith({ status: OrderStatus.FILLED });
    });
  });

  describe('cancelOrder', () => {
    it('should cancel an order', async () => {
      const cancelledOrder = { ...mockOrderResponse, status: OrderStatus.CANCELLED };
      service.cancelOrder.mockResolvedValue(cancelledOrder);

      const result = await controller.cancelOrder(1);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(service.cancelOrder).toHaveBeenCalledWith(1);
    });
  });
});

