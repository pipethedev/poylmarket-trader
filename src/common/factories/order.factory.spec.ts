import { OrderFactory } from './order.factory';
import { Order, OrderStatus, OrderSide, OrderType, OrderOutcome } from '@database/entities/order.entity';
import { CreateOrderDto } from '@modules/orders/dto/create-order.dto';

describe('OrderFactory', () => {
  const mockDto: CreateOrderDto = {
    marketId: 1,
    side: OrderSide.BUY,
    type: OrderType.LIMIT,
    outcome: OrderOutcome.YES,
    quantity: '100',
    price: '0.65',
    metadata: { source: 'api' },
  };

  describe('create', () => {
    it('should create order data from DTO and idempotency key', () => {
      const result = OrderFactory.create({ dto: mockDto, idempotencyKey: 'idem-123' });

      expect(result.idempotencyKey).toBe('idem-123');
      expect(result.marketId).toBe(1);
      expect(result.side).toBe(OrderSide.BUY);
      expect(result.type).toBe(OrderType.LIMIT);
      expect(result.outcome).toBe(OrderOutcome.YES);
      expect(result.quantity).toBe('100');
      expect(result.price).toBe('0.65');
      expect(result.status).toBe(OrderStatus.PENDING);
      expect(result.filledQuantity).toBe('0');
      expect(result.metadata).toEqual({ source: 'api' });
    });

    it('should handle market order without price', () => {
      const marketOrderDto: CreateOrderDto = {
        marketId: 2,
        side: OrderSide.SELL,
        type: OrderType.MARKET,
        outcome: OrderOutcome.NO,
        quantity: '50',
      };

      const result = OrderFactory.create({ dto: marketOrderDto, idempotencyKey: 'idem-456' });

      expect(result.type).toBe(OrderType.MARKET);
      expect(result.price).toBeUndefined();
      expect(result.status).toBe(OrderStatus.PENDING);
    });
  });

  describe('toResponse', () => {
    it('should map order entity to response DTO', () => {
      const order = new Order();
      order.id = 1;
      order.idempotencyKey = 'idem-123';
      order.marketId = 1;
      order.side = OrderSide.BUY;
      order.type = OrderType.LIMIT;
      order.outcome = OrderOutcome.YES;
      order.quantity = '100';
      order.price = '0.65';
      order.status = OrderStatus.FILLED;
      order.filledQuantity = '100';
      order.averageFillPrice = '0.64';
      order.externalOrderId = 'ext-123';
      order.failureReason = null;
      order.createdAt = new Date('2024-01-15T10:00:00Z');
      order.updatedAt = new Date('2024-01-15T10:05:00Z');

      const result = OrderFactory.toResponse(order);

      expect(result.id).toBe(1);
      expect(result.status).toBe(OrderStatus.FILLED);
      expect(result.filledQuantity).toBe('100');
      expect(result.averageFillPrice).toBe('0.64');
      expect(result.failureReason).toBeNull();
      expect(result.createdAt).toEqual(new Date('2024-01-15T10:00:00Z'));
    });

    it('should handle order with failure reason', () => {
      const order = new Order();
      order.id = 2;
      order.idempotencyKey = 'idem-456';
      order.marketId = 1;
      order.side = OrderSide.SELL;
      order.type = OrderType.MARKET;
      order.outcome = OrderOutcome.NO;
      order.quantity = '50';
      order.price = null;
      order.status = OrderStatus.FAILED;
      order.filledQuantity = '0';
      order.averageFillPrice = null;
      order.externalOrderId = null;
      order.failureReason = 'Insufficient liquidity';
      order.createdAt = new Date();
      order.updatedAt = new Date();

      const result = OrderFactory.toResponse(order);

      expect(result.id).toBe(2);
      expect(result.status).toBe(OrderStatus.FAILED);
      expect(result.filledQuantity).toBe('0');
      expect(result.averageFillPrice).toBeNull();
      expect(result.failureReason).toBe('Insufficient liquidity');
      expect(result.createdAt).toBeDefined();
    });
  });
});
