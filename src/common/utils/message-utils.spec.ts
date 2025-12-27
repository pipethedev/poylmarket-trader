import { createOrderMessage } from './message-utils';
import { OrderSide, OrderType, OrderOutcome } from '@database/entities/order.entity';
import { CreateOrderDto } from '@modules/orders/dto/create-order.dto';

describe('message-utils', () => {
  describe('createOrderMessage', () => {
    it('should create a valid order message with all parameters', () => {
      const orderParams: CreateOrderDto = {
        marketId: 123,
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        outcome: OrderOutcome.YES,
        quantity: '100',
        price: '0.65',
      };
      const nonce = 'test-nonce-12345';

      const message = createOrderMessage(orderParams, nonce);

      expect(message).toBeDefined();
      expect(typeof message).toBe('string');

      const parsed = JSON.parse(message);
      expect(parsed).toEqual({
        marketId: 123,
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        outcome: OrderOutcome.YES,
        quantity: '100',
        price: '0.65',
        nonce: 'test-nonce-12345',
      });
    });

    it('should handle different order types', () => {
      const orderParams: CreateOrderDto = {
        marketId: 456,
        side: OrderSide.SELL,
        type: OrderType.MARKET,
        outcome: OrderOutcome.NO,
        quantity: '50',
        price: '0.35',
      };
      const nonce = 'nonce-789';

      const message = createOrderMessage(orderParams, nonce);
      const parsed = JSON.parse(message);

      expect(parsed.side).toBe(OrderSide.SELL);
      expect(parsed.type).toBe(OrderType.MARKET);
      expect(parsed.outcome).toBe(OrderOutcome.NO);
    });

    it('should handle decimal quantities and prices', () => {
      const orderParams: CreateOrderDto = {
        marketId: 1,
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        outcome: OrderOutcome.YES,
        quantity: '123.456',
        price: '0.789',
      };
      const nonce = 'test';

      const message = createOrderMessage(orderParams, nonce);
      const parsed = JSON.parse(message);

      expect(parsed.quantity).toBe('123.456');
      expect(parsed.price).toBe('0.789');
    });

    it('should include nonce in message', () => {
      const orderParams: CreateOrderDto = {
        marketId: 1,
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        outcome: OrderOutcome.YES,
        quantity: '1',
        price: '0.5',
      };
      const nonce = 'unique-nonce-value';

      const message = createOrderMessage(orderParams, nonce);
      const parsed = JSON.parse(message);

      expect(parsed.nonce).toBe('unique-nonce-value');
    });

    it('should return valid JSON string', () => {
      const orderParams: CreateOrderDto = {
        marketId: 999,
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
        outcome: OrderOutcome.NO,
        quantity: '10',
        price: '0.5',
      };
      const nonce = 'test-nonce';

      const message = createOrderMessage(orderParams, nonce);

      expect(() => JSON.parse(message)).not.toThrow();
    });
  });
});
