import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { EventRepository } from '@database/repositories/event.repository';
import { MarketRepository } from '@database/repositories/market.repository';
import { TokenRepository } from '@database/repositories/token.repository';
import { SyncService } from '@modules/sync/sync.service';
import { AppLogger } from '@common/logger/app-logger.service';
import { EventNotFoundException } from '@common/exceptions';
import { Event } from '@database/entities/event.entity';
import { Market } from '@database/entities/market.entity';

describe('EventsService', () => {
  let service: EventsService;
  let eventRepository: jest.Mocked<EventRepository>;
  let marketRepository: jest.Mocked<MarketRepository>;
  let tokenRepository: jest.Mocked<TokenRepository>;
  let syncService: jest.Mocked<SyncService>;
  let module: TestingModule;

  const mockLogger = {
    setPrefix: jest.fn().mockReturnThis(),
    setContext: jest.fn().mockReturnThis(),
    setContextData: jest.fn().mockReturnThis(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockEvent: Event = {
    id: 1,
    externalId: 'poly-123',
    provider: 'polymarket',
    title: 'Test Event',
    description: 'Test Description',
    slug: 'test-event',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    active: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    markets: [],
  };

  const mockMarket: Market = {
    id: 1,
    externalId: 'market-123',
    provider: 'polymarket',
    eventId: 1,
    conditionId: 'condition-456',
    question: 'Test question?',
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
    event: mockEvent as never,
    tokens: [],
    orders: [],
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: EventRepository,
          useValue: {
            findById: jest.fn(),
            findByExternalId: jest.fn(),
            findActive: jest.fn(),
            createQueryBuilder: jest.fn(),
            paginate: jest.fn(),
          },
        },
        {
          provide: MarketRepository,
          useValue: {
            findMany: jest.fn(),
            getMarketCountsByEventIds: jest.fn(),
          },
        },
        {
          provide: TokenRepository,
          useValue: {
            findByMarketIds: jest.fn(),
          },
        },
        {
          provide: SyncService,
          useValue: {
            syncEvents: jest.fn(),
          },
        },
        {
          provide: 'BullQueue_sync',
          useValue: {
            add: jest.fn(),
          },
        },
        {
          provide: AppLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    eventRepository = module.get(EventRepository);
    marketRepository = module.get(MarketRepository);
    tokenRepository = module.get(TokenRepository);
    syncService = module.get(SyncService);
  });

  describe('getEvent', () => {
    it('should return event with markets by id', async () => {
      eventRepository.findById.mockResolvedValue(mockEvent);
      marketRepository.findMany.mockResolvedValue([mockMarket]);
      tokenRepository.findByMarketIds.mockResolvedValue([]);

      const result = await service.getEvent(1);

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Event');
      expect(result.markets).toHaveLength(1);
      expect(eventRepository.findById).toHaveBeenCalledWith(1);
    });

    it('should throw EventNotFoundException if event not found', async () => {
      eventRepository.findById.mockResolvedValue(null);

      await expect(service.getEvent(999)).rejects.toThrow(EventNotFoundException);
    });
  });

  describe('getEvents', () => {
    it('should return paginated events with market counts', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
      };
      eventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      eventRepository.paginate.mockResolvedValue({
        data: [mockEvent],
        meta: { currentPage: 1, perPage: 20, total: 1, totalPages: 1 },
      });
      marketRepository.getMarketCountsByEventIds.mockResolvedValue({ 1: 5 });

      const result = await service.getEvents({ page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].marketCount).toBe(5);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by active status', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
      };
      eventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      eventRepository.paginate.mockResolvedValue({
        data: [],
        meta: { currentPage: 1, perPage: 20, total: 0, totalPages: 0 },
      });
      marketRepository.getMarketCountsByEventIds.mockResolvedValue({});

      await service.getEvents({ active: true });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('event.active = :active', {
        active: true,
      });
    });

    it('should filter by search query', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
      };
      eventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      eventRepository.paginate.mockResolvedValue({
        data: [],
        meta: { currentPage: 1, perPage: 20, total: 0, totalPages: 0 },
      });
      marketRepository.getMarketCountsByEventIds.mockResolvedValue({});

      await service.getEvents({ search: 'test' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('event.title ILIKE :search', {
        search: '%test%',
      });
    });
  });

  describe('getEventMarkets', () => {
    it('should return markets for an event', async () => {
      eventRepository.findById.mockResolvedValue(mockEvent);
      marketRepository.findMany.mockResolvedValue([mockMarket]);

      const result = await service.getEventMarkets(1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].question).toBe('Test question?');
      expect(eventRepository.findById).toHaveBeenCalledWith(1);
      expect(marketRepository.findMany).toHaveBeenCalledWith({
        where: { eventId: 1 },
        order: { updatedAt: 'DESC' },
      });
    });

    it('should throw EventNotFoundException if event not found', async () => {
      eventRepository.findById.mockResolvedValue(null);

      await expect(service.getEventMarkets(999)).rejects.toThrow(EventNotFoundException);
    });
  });

  describe('syncEvents', () => {
    it('should queue a sync job', async () => {
      const mockJob = { id: 'job-123' };
      const syncQueue = module.get('BullQueue_sync');
      syncQueue.add = jest.fn().mockResolvedValue(mockJob);

      const result = await service.syncEvents(100);

      expect(result).toEqual({
        jobId: 'job-123',
        message: 'Sync job has been queued and will be processed in the background',
        syncedEvents: 0,
        syncedMarkets: 0,
      });
      expect(syncQueue.add).toHaveBeenCalledWith(
        'sync-events',
        { limit: 100 },
        expect.objectContaining({
          attempts: 3,
        }),
      );
    });
  });
});
