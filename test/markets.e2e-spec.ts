import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TestAppFactory } from './utils/test-app.factory';
import { TestDbHelper } from './utils/test-db.helper';
import { TestDataFactory } from './utils/test-data.factory';
import { TokenOutcome } from '@database/entities/token.entity';

describe('Markets API (e2e)', () => {
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

  describe('GET /markets', () => {
    it('should return empty list when no markets exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/markets')
        .expect(200);

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

    it('should return paginated list of markets', async () => {
      const event = await dataFactory.createEvent();
      await dataFactory.createMarket(event.id, { question: 'Market 1?' });
      await dataFactory.createMarket(event.id, { question: 'Market 2?' });
      await dataFactory.createMarket(event.id, { question: 'Market 3?' });

      const response = await request(app.getHttpServer())
        .get('/markets')
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

    it('should filter markets by active status', async () => {
      const event = await dataFactory.createEvent();
      await dataFactory.createMarket(event.id, {
        question: 'Active Market',
        active: true,
      });
      await dataFactory.createMarket(event.id, {
        question: 'Inactive Market',
        active: false,
      });

      const response = await request(app.getHttpServer())
        .get('/markets')
        .query({ active: true })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].question).toBe('Active Market');
    });

    it('should search markets by keyword', async () => {
      const event = await dataFactory.createEvent();
      await dataFactory.createMarket(event.id, {
        question: 'Will BTC reach 100k?',
      });
      await dataFactory.createMarket(event.id, {
        question: 'Will ETH flip BTC?',
      });

      const response = await request(app.getHttpServer())
        .get('/markets')
        .query({ search: 'BTC' })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter markets by eventId', async () => {
      const event1 = await dataFactory.createEvent({ title: 'Event 1' });
      const event2 = await dataFactory.createEvent({ title: 'Event 2' });

      await dataFactory.createMarket(event1.id, { question: 'Event 1 Market' });
      await dataFactory.createMarket(event2.id, { question: 'Event 2 Market' });

      const response = await request(app.getHttpServer())
        .get('/markets')
        .query({ eventId: event1.id })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].question).toBe('Event 1 Market');
    });

    it('should search markets by question', async () => {
      const event = await dataFactory.createEvent();
      await dataFactory.createMarket(event.id, {
        question: 'Will Bitcoin reach $100k?',
      });
      await dataFactory.createMarket(event.id, {
        question: 'Will Ethereum flip Bitcoin?',
      });

      const response = await request(app.getHttpServer())
        .get('/markets')
        .query({ search: 'Bitcoin' })
        .expect(200);

      expect(response.body.data).toHaveLength(2);
    });

    it('should include tokens in market response', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id);
      await dataFactory.createToken(market.id, TokenOutcome.YES);
      await dataFactory.createToken(market.id, TokenOutcome.NO);

      const response = await request(app.getHttpServer())
        .get('/markets')
        .expect(200);

      expect(response.body.data[0]).toHaveProperty('tokens');
      expect(response.body.data[0].tokens).toHaveLength(2);
    });
  });

  describe('GET /markets/:id', () => {
    it('should return market details with tokens', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id, {
        question: 'Test Market?',
      });
      await dataFactory.createToken(market.id, TokenOutcome.YES, {
        price: '0.6',
      });
      await dataFactory.createToken(market.id, TokenOutcome.NO, {
        price: '0.4',
      });

      const response = await request(app.getHttpServer())
        .get(`/markets/${market.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: market.id,
        question: 'Test Market?',
      });
      expect(response.body.tokens).toHaveLength(2);
      expect(response.body.tokens[0]).toHaveProperty('outcome');
      expect(response.body.tokens[0]).toHaveProperty('price');
    });

    it('should include event details in market response', async () => {
      const event = await dataFactory.createEvent({
        title: 'Presidential Election',
      });
      const market = await dataFactory.createMarket(event.id);

      const response = await request(app.getHttpServer())
        .get(`/markets/${market.id}`)
        .expect(200);

      expect(response.body).toHaveProperty('event');
      expect(response.body.event.title).toBe('Presidential Election');
    });

    it('should return 404 when market does not exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/markets/99999')
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for invalid market ID', async () => {
      await request(app.getHttpServer())
        .get('/markets/invalid')
        .expect(400);
    });
  });

  describe('Edge cases', () => {
    it('should handle pagination with page beyond total pages', async () => {
      const event = await dataFactory.createEvent();
      await dataFactory.createMarket(event.id);

      const response = await request(app.getHttpServer())
        .get('/markets')
        .query({ page: 100, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.currentPage).toBe(100);
    });

    it('should enforce maximum limit for pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/markets')
        .query({ limit: 1000 })
        .expect(200);

      expect(response.body.meta.perPage).toBeLessThanOrEqual(100);
    });

    it('should handle multiple filters simultaneously', async () => {
      const event1 = await dataFactory.createEvent({ title: 'Event 1' });
      const event2 = await dataFactory.createEvent({ title: 'Event 2' });

      await dataFactory.createMarket(event1.id, {
        question: 'Active Market in Event 1',
        active: true,
      });
      await dataFactory.createMarket(event1.id, {
        question: 'Inactive Market in Event 1',
        active: false,
      });
      await dataFactory.createMarket(event2.id, {
        question: 'Active Market in Event 2',
        active: true,
      });

      const response = await request(app.getHttpServer())
        .get('/markets')
        .query({ active: true, eventId: event1.id })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].question).toBe('Active Market in Event 1');
    });

    it('should return markets with price information', async () => {
      const event = await dataFactory.createEvent();
      const market = await dataFactory.createMarket(event.id, {
        outcomeYesPrice: '0.65',
        outcomeNoPrice: '0.35',
      });

      const response = await request(app.getHttpServer())
        .get(`/markets/${market.id}`)
        .expect(200);

      expect(response.body.outcomeYesPrice).toBe('0.65');
      expect(response.body.outcomeNoPrice).toBe('0.35');
    });
  });
});
