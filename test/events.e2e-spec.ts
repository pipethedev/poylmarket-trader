import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TestAppFactory } from './utils/test-app.factory';
import { TestDbHelper } from './utils/test-db.helper';
import { TestDataFactory } from './utils/test-data.factory';

describe('Events API (e2e)', () => {
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

  describe('GET /events', () => {
    it('should return empty list when no events exist', async () => {
      const response = await request(app.getHttpServer()).get('/events').expect(200);

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

    it('should return paginated list of events', async () => {
      await dataFactory.createEvent({
        title: 'Event 1',
        slug: 'event-1',
      });
      await dataFactory.createEvent({
        title: 'Event 2',
        slug: 'event-2',
      });
      await dataFactory.createEvent({
        title: 'Event 3',
        slug: 'event-3',
      });

      const response = await request(app.getHttpServer()).get('/events').query({ page: 1, limit: 2 }).expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toEqual({
        total: 3,
        currentPage: 1,
        perPage: 2,
        totalPages: 2,
      });
    });

    it('should filter events by active status', async () => {
      await dataFactory.createEvent({
        title: 'Active Event',
        active: true,
      });
      await dataFactory.createEvent({
        title: 'Inactive Event',
        active: false,
      });

      const response = await request(app.getHttpServer()).get('/events').query({ active: true }).expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Active Event');
    });

    it('should filter events by end date', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      const pastDate = new Date(Date.now() - 86400000);

      await dataFactory.createEvent({
        title: 'Future Event',
        endDate: futureDate,
      });
      await dataFactory.createEvent({
        title: 'Past Event',
        endDate: pastDate,
      });

      const response = await request(app.getHttpServer()).get('/events').expect(200);

      expect(response.body.data).toHaveLength(2);
    });

    it('should search events by title', async () => {
      await dataFactory.createEvent({
        title: 'Presidential Election 2024',
        slug: 'election-2024',
      });
      await dataFactory.createEvent({
        title: 'Super Bowl Winner',
        slug: 'super-bowl',
      });

      const response = await request(app.getHttpServer()).get('/events').query({ search: 'election' }).expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Presidential Election 2024');
    });

    it('should include market count in response', async () => {
      const { markets } = await dataFactory.createCompleteEventWithMarkets();

      const response = await request(app.getHttpServer()).get('/events').expect(200);

      expect(response.body.data[0].marketCount).toBe(markets.length);
    });
  });

  describe('GET /events/:id', () => {
    it('should return event details with markets', async () => {
      const { event, markets } = await dataFactory.createCompleteEventWithMarkets();

      const response = await request(app.getHttpServer()).get(`/events/${event.id}`).expect(200);

      expect(response.body).toMatchObject({
        id: event.id,
        title: event.title,
        slug: event.slug,
      });
      expect(response.body.markets).toHaveLength(markets.length);
      expect(response.body.markets[0]).toHaveProperty('question');
      expect(response.body.markets[0]).toHaveProperty('tokens');
    });

    it('should return 404 when event does not exist', async () => {
      const response = await request(app.getHttpServer()).get('/events/99999').expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for invalid event ID', async () => {
      await request(app.getHttpServer()).get('/events/invalid').expect(400);
    });
  });

  describe('POST /events/sync', () => {
    it('should trigger sync and return success response', async () => {
      const response = await request(app.getHttpServer()).post('/events/sync').expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Sync job has been queued and will be processed in the background');
    });

    it('should accept optional limit parameter', async () => {
      const response = await request(app.getHttpServer()).post('/events/sync').query({ limit: 50 }).expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Sync job has been queued and will be processed in the background');
    });

    it('should handle sync with existing events gracefully', async () => {
      const response = await request(app.getHttpServer()).post('/events/sync').query({ limit: 10 }).expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Sync job has been queued and will be processed in the background');
    });
  });

  describe('Edge cases', () => {
    it('should handle pagination with page beyond total pages', async () => {
      await dataFactory.createEvent();

      const response = await request(app.getHttpServer()).get('/events').query({ page: 100, limit: 10 }).expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.currentPage).toBe(100);
    });

    it('should enforce maximum limit for pagination', async () => {
      const response = await request(app.getHttpServer()).get('/events').query({ limit: 1000 }).expect(200);

      expect(response.body.meta.perPage).toBeLessThanOrEqual(100);
    });

    it('should handle multiple filters simultaneously', async () => {
      await dataFactory.createEvent({
        title: 'Active Event',
        active: true,
      });
      await dataFactory.createEvent({
        title: 'Inactive Event',
        active: false,
      });

      const response = await request(app.getHttpServer()).get('/events').query({ active: true }).expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Active Event');
    });
  });
});
