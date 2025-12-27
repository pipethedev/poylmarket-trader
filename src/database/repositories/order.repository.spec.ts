import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderRepository } from './order.repository';
import { Order, OrderStatus, OrderSide, OrderType, OrderOutcome } from '@database/entities/order.entity';
import { Market } from '@database/entities/market.entity';

describe('OrderRepository', () => {
  let orderRepository: OrderRepository;
  let repository: jest.Mocked<Repository<Order>>;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderRepository,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            find: jest.fn(),
            findBy: jest.fn(),
            update: jest.fn(),
            manager: {},
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    orderRepository = module.get<OrderRepository>(OrderRepository);
    repository = module.get(getRepositoryToken(Order));
  });

  describe('findByIdempotencyKey', () => {
    it('should find order by idempotency key', async () => {
      repository.findOneBy.mockResolvedValue(mockOrder);

      const result = await orderRepository.findByIdempotencyKey('idem-123');

      expect(result).toEqual(mockOrder);
      expect(repository.findOneBy).toHaveBeenCalledWith({ idempotencyKey: 'idem-123' });
    });

    it('should return null if not found', async () => {
      repository.findOneBy.mockResolvedValue(null);

      const result = await orderRepository.findByIdempotencyKey('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByMarketId', () => {
    it('should find orders by market id', async () => {
      repository.findBy.mockResolvedValue([mockOrder]);

      const result = await orderRepository.findByMarketId(1);

      expect(result).toHaveLength(1);
      expect(repository.findBy).toHaveBeenCalledWith({ marketId: 1 });
    });
  });

  describe('findByStatus', () => {
    it('should find orders by status', async () => {
      repository.findBy.mockResolvedValue([mockOrder]);

      const result = await orderRepository.findByStatus(OrderStatus.PENDING);

      expect(result).toHaveLength(1);
      expect(repository.findBy).toHaveBeenCalledWith({ status: OrderStatus.PENDING });
    });
  });

  describe('findPendingOrders', () => {
    it('should find pending and queued orders', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING };
      const queuedOrder = { ...mockOrder, id: 2, status: OrderStatus.QUEUED };
      repository.find.mockResolvedValue([pendingOrder, queuedOrder]);

      const result = await orderRepository.findPendingOrders();

      expect(result).toHaveLength(2);
      expect(repository.find).toHaveBeenCalledWith({
        where: [{ status: OrderStatus.PENDING }, { status: OrderStatus.QUEUED }],
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('updateStatus', () => {
    it('should update order status', async () => {
      repository.update.mockResolvedValue({ affected: 1 } as never);

      await orderRepository.updateStatus(1, OrderStatus.QUEUED);

      expect(repository.update).toHaveBeenCalledWith({ id: 1 }, { status: OrderStatus.QUEUED });
    });
  });

  describe('markAsFailed', () => {
    it('should mark order as failed with reason', async () => {
      repository.update.mockResolvedValue({ affected: 1 } as never);

      await orderRepository.markAsFailed(1, 'Processing error');

      expect(repository.update).toHaveBeenCalledWith(
        { id: 1 },
        { status: OrderStatus.FAILED, failureReason: 'Processing error' },
      );
    });
  });

  describe('markAsFilled', () => {
    it('should mark order as filled with details', async () => {
      repository.update.mockResolvedValue({ affected: 1 } as never);

      await orderRepository.markAsFilled(1, '100', '0.64', 'ext-123');

      expect(repository.update).toHaveBeenCalledWith(
        { id: 1 },
        {
          status: OrderStatus.FILLED,
          filledQuantity: '100',
          averageFillPrice: '0.64',
          externalOrderId: 'ext-123',
        },
      );
    });

    it('should mark as filled without external order id', async () => {
      repository.update.mockResolvedValue({ affected: 1 } as never);

      await orderRepository.markAsFilled(1, '50', '0.70');

      expect(repository.update).toHaveBeenCalledWith(
        { id: 1 },
        {
          status: OrderStatus.FILLED,
          filledQuantity: '50',
          averageFillPrice: '0.70',
          externalOrderId: undefined,
        },
      );
    });
  });
});
