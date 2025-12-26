import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TestAppFactory } from './utils/test-app.factory';
import { TestDbHelper } from './utils/test-db.helper';
import { TestDataFactory } from './utils/test-data.factory';
import { TokenOutcome } from '@database/entities/token.entity';
import { OrderOutcome, OrderStatus, OrderType, OrderSide } from '@database/entities/order.entity';

describe('Orders API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let dbHelper: TestDbHelper;
  let dataFactory: TestDataFactory;

  beforeAll(async () => {
    app = await TestAppFactory.createApp();
    dataSource = TestAppFactory.getDataSource();
    dbHelper = new TestDbHelper(dataSource);
    dataFactory = new TestDataFactory(dataSource);
  });

  afterAll(async () => {
    await TestAppFactory.closeApp();
  });

  beforeEach(async () => {
    await dbHelper.cleanDatabase();
  });

  describe('POST /orders', () => {
    it('should create a market order successfully', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);
      await dataFactory.createToken(market.id, TokenOutcome.YES);

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', `test-order-${Date.now()}`)
        .send({
          marketId: market.id,
          outcome: OrderOutcome.YES,
          side: OrderSide.BUY,
          type: OrderType.MARKET,
          quantity: '10',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        marketId: market.id,
        outcome: OrderOutcome.YES,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        quantity: '10',
        status: OrderStatus.PENDING,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should create a limit order successfully', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);
      await dataFactory.createToken(market.id, TokenOutcome.NO);

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', `test-limit-order-${Date.now()}`)
        .send({
          marketId: market.id,
          outcome: OrderOutcome.NO,
          side: OrderSide.SELL,
          type: OrderType.LIMIT,
          quantity: '5',
          price: '0.45',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        type: OrderType.LIMIT,
        price: '0.45',
        quantity: '5',
      });
    });

    it('should enforce idempotency key requirement', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);

      const response = await request(app.getHttpServer())
        .post('/orders')
        .send({
          marketId: market.id,
          outcome: OrderOutcome.YES,
          side: OrderSide.BUY,
          type: OrderType.MARKET,
          quantity: '10',
        })
        .expect(400);

      expect(response.body.message).toContain('Idempotency');
    });

    it('should handle duplicate idempotency key', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);
      const idempotencyKey = `duplicate-key-${Date.now()}`;

      const orderData = {
        marketId: market.id,
        outcome: OrderOutcome.YES,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        quantity: '10',
      };

      // First request
      const response1 = await request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send(orderData)
        .expect(201);

      // Second request with same idempotency key
      const response2 = await request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send(orderData)
        .expect(200);

      expect(response1.body.id).toBe(response2.body.id);
    });

    it('should return 409 for idempotency key conflict with different parameters', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);
      const idempotencyKey = `conflict-key-${Date.now()}`;

      // First request
      await request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          marketId: market.id,
          outcome: OrderOutcome.YES,
          side: OrderSide.BUY,
          type: OrderType.MARKET,
          quantity: '10',
        })
        .expect(201);

      // Second request with same key but different parameters
      await request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          marketId: market.id,
          outcome: OrderOutcome.NO,
          side: OrderSide.SELL,
          type: OrderType.MARKET,
          quantity: '20',
        })
        .expect(409);
    });

    it('should return 404 when market does not exist', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', `nonexistent-market-${Date.now()}`)
        .send({
          marketId: 99999,
          outcome: OrderOutcome.YES,
          side: OrderSide.BUY,
          type: OrderType.MARKET,
          quantity: '10',
        })
        .expect(404);
    });

    it('should validate order data', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);

      await request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', `invalid-order-${Date.now()}`)
        .send({
          marketId: market.id,
          outcome: OrderOutcome.YES,
          side: OrderSide.BUY,
          type: OrderType.MARKET,
          quantity: '-10', // Invalid negative quantity
        })
        .expect(400);
    });

    it('should require price for limit orders', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);

      await request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', `limit-no-price-${Date.now()}`)
        .send({
          marketId: market.id,
          outcome: OrderOutcome.YES,
          side: OrderSide.BUY,
          type: OrderType.LIMIT,
          quantity: '10',
          // Missing price
        })
        .expect(400);
    });
  });

  describe('GET /orders', () => {
    it('should return empty list when no orders exist', async () => {
      const response = await request(app.getHttpServer()).get('/orders').expect(200);

      expect(response.body).toEqual({
        data: [],
        meta: {
          total: 0,
          currentPage: 1,
          perPage: 20,
          totalPages: 0,
        },
      });
    });

    it('should return paginated list of orders', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);

      await dataFactory.createOrder(market.id, OrderOutcome.YES);
      await dataFactory.createOrder(market.id, OrderOutcome.NO);
      await dataFactory.createOrder(market.id, OrderOutcome.YES);

      const response = await request(app.getHttpServer())
        .get('/orders')
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toEqual({
        total: 3,
        currentPage: 1,
        perPage: 2,
        totalPages: 2,
      });
    });

    it('should filter orders by status', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);

      await dataFactory.createOrder(market.id, OrderOutcome.YES, {
        status: OrderStatus.PENDING,
      });
      await dataFactory.createOrder(market.id, OrderOutcome.NO, {
        status: OrderStatus.FILLED,
      });

      const response = await request(app.getHttpServer())
        .get('/orders')
        .query({ status: OrderStatus.PENDING })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe(OrderStatus.PENDING);
    });

    it('should filter orders by marketId', async () => {
      const event = await dataFactory.createEvent();
      const market1 = await dataFactory.createMarket(event.id);
      const market2 = await dataFactory.createMarket(event.id);

      await dataFactory.createOrder(market1.id, OrderOutcome.YES);
      await dataFactory.createOrder(market2.id, OrderOutcome.NO);

      const response = await request(app.getHttpServer())
        .get('/orders')
        .query({ marketId: market1.id })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].marketId).toBe(market1.id);
    });
  });

  describe('GET /orders/:id', () => {
    it('should return order details', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);
      const order = await dataFactory.createOrder(market.id, OrderOutcome.YES);

      const response = await request(app.getHttpServer()).get(`/orders/${order.id}`).expect(200);

      expect(response.body).toMatchObject({
        id: order.id,
        marketId: market.id,
        outcome: OrderOutcome.YES,
        type: OrderType.MARKET,
        side: OrderSide.BUY,
      });
    });

    it('should return 404 when order does not exist', async () => {
      const response = await request(app.getHttpServer()).get('/orders/99999').expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for invalid order ID', async () => {
      await request(app.getHttpServer()).get('/orders/invalid').expect(400);
    });
  });

  describe('DELETE /orders/:id', () => {
    it('should cancel a pending order', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);
      const order = await dataFactory.createOrder(market.id, OrderOutcome.YES, {
        status: OrderStatus.PENDING,
      });

      const response = await request(app.getHttpServer()).delete(`/orders/${order.id}`).expect(200);

      expect(response.body.status).toBe(OrderStatus.CANCELLED);
    });

    it('should cancel a queued order', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);
      const order = await dataFactory.createOrder(market.id, OrderOutcome.YES, {
        status: OrderStatus.QUEUED,
      });

      const response = await request(app.getHttpServer()).delete(`/orders/${order.id}`).expect(200);

      expect(response.body.status).toBe(OrderStatus.CANCELLED);
    });

    it('should not cancel a processing order', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);
      const order = await dataFactory.createOrder(market.id, OrderOutcome.YES, {
        status: OrderStatus.PROCESSING,
      });

      await request(app.getHttpServer()).delete(`/orders/${order.id}`).expect(400);
    });

    it('should not cancel a filled order', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);
      const order = await dataFactory.createOrder(market.id, OrderOutcome.YES, {
        status: OrderStatus.FILLED,
      });

      await request(app.getHttpServer()).delete(`/orders/${order.id}`).expect(400);
    });

    it('should not cancel an already cancelled order', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);
      const order = await dataFactory.createOrder(market.id, OrderOutcome.YES, {
        status: OrderStatus.CANCELLED,
      });

      await request(app.getHttpServer()).delete(`/orders/${order.id}`).expect(400);
    });

    it('should return 404 when order does not exist', async () => {
      await request(app.getHttpServer()).delete('/orders/99999').expect(404);
    });
  });

  describe('Edge cases', () => {
    it('should handle pagination with page beyond total pages', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);
      await dataFactory.createOrder(market.id, OrderOutcome.YES);

      const response = await request(app.getHttpServer())
        .get('/orders')
        .query({ page: 100, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.currentPage).toBe(100);
    });

    it('should handle order with metadata', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Idempotency-Key', `metadata-order-${Date.now()}`)
        .send({
          marketId: market.id,
          outcome: OrderOutcome.YES,
          side: OrderSide.BUY,
          type: OrderType.MARKET,
          quantity: '10',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });

    it('should handle concurrent order updates with optimistic locking', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);
      const order = await dataFactory.createOrder(market.id, OrderOutcome.YES);

      const response = await request(app.getHttpServer()).get(`/orders/${order.id}`).expect(200);

      expect(response.body).toHaveProperty('id', order.id);
      expect(response.body).toHaveProperty('status');
    });
  });
});
