import { Test, TestingModule } from '@nestjs/testing';
import { MarketsService } from './markets.service';
import { MarketRepository } from '@database/repositories/market.repository';
import { TokenRepository } from '@database/repositories/token.repository';
import { EventRepository } from '@database/repositories/event.repository';
import { AppLogger } from '@common/logger/app-logger.service';
import { MarketNotFoundException } from '@common/exceptions';
import { Market } from '@database/entities/market.entity';
import { Token, TokenOutcome } from '@database/entities/token.entity';
import { Event } from '@database/entities/event.entity';

describe('MarketsService', () => {
  let service: MarketsService;
  let marketRepository: jest.Mocked<MarketRepository>;
  let tokenRepository: jest.Mocked<TokenRepository>;
  let eventRepository: jest.Mocked<EventRepository>;

  const mockLogger = {
    setPrefix: jest.fn().mockReturnThis(),
    setContext: jest.fn().mockReturnThis(),
    setContextData: jest.fn().mockReturnThis(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockToken: Token = {
    id: 1,
    tokenId: 'token-123',
    marketId: 1,
    outcome: TokenOutcome.YES,
    price: '0.65',
    metadata: null,
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
    question: 'Test question?',
    description: 'Test description',
    outcomeYesPrice: '0.65',
    outcomeNoPrice: '0.35',
    volume: '10000',
    liquidity: '5000',
    active: true,
    closed: false,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    event: {} as never,
    tokens: [mockToken],
    orders: [],
  };

  const mockEvent: Event = {
    id: 1,
    externalId: 'event-123',
    title: 'Test Event',
    description: 'Event description',
    slug: 'test-event',
    startDate: new Date(),
    endDate: new Date(),
    active: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    markets: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketsService,
        {
          provide: MarketRepository,
          useValue: {
            findById: jest.fn(),
            findByExternalId: jest.fn(),
            findByEventId: jest.fn(),
            createQueryBuilder: jest.fn(),
            paginate: jest.fn(),
          },
        },
        {
          provide: TokenRepository,
          useValue: {
            findByMarketId: jest.fn(),
            findByMarketIds: jest.fn(),
          },
        },
        {
          provide: EventRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: AppLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<MarketsService>(MarketsService);
    marketRepository = module.get(MarketRepository);
    tokenRepository = module.get(TokenRepository);
    eventRepository = module.get(EventRepository);
  });

  describe('getMarket', () => {
    it('should return market with tokens by id', async () => {
      marketRepository.findById.mockResolvedValue(mockMarket);
      tokenRepository.findByMarketId.mockResolvedValue([mockToken]);
      eventRepository.findById.mockResolvedValue(mockEvent);

      const result = await service.getMarket(1);

      expect(result.id).toBe(1);
      expect(result.question).toBe('Test question?');
      expect(result.tokens).toHaveLength(1);
      expect(result.eventTitle).toBe('Test Event');
      expect(marketRepository.findById).toHaveBeenCalledWith(1);
      expect(tokenRepository.findByMarketId).toHaveBeenCalledWith(1);
      expect(eventRepository.findById).toHaveBeenCalledWith(1);
    });

    it('should throw MarketNotFoundException if market not found', async () => {
      marketRepository.findById.mockResolvedValue(null);

      await expect(service.getMarket(999)).rejects.toThrow(MarketNotFoundException);
    });
  });

  describe('getMarkets', () => {
    it('should return paginated markets', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
      };
      marketRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      marketRepository.paginate.mockResolvedValue({
        data: [mockMarket],
        meta: { currentPage: 1, perPage: 20, total: 1, totalPages: 1 },
      });
      tokenRepository.findByMarketIds.mockResolvedValue([mockToken]);

      const result = await service.getMarkets({ page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by eventId', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
      };
      marketRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      marketRepository.paginate.mockResolvedValue({
        data: [],
        meta: { currentPage: 1, perPage: 20, total: 0, totalPages: 0 },
      });
      tokenRepository.findByMarketIds.mockResolvedValue([]);

      await service.getMarkets({ eventId: 1 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('market.event_id = :eventId', {
        eventId: 1,
      });
    });

    it('should filter by active status', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
      };
      marketRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      marketRepository.paginate.mockResolvedValue({
        data: [],
        meta: { currentPage: 1, perPage: 20, total: 0, totalPages: 0 },
      });
      tokenRepository.findByMarketIds.mockResolvedValue([]);

      await service.getMarkets({ active: true });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('market.active = :active', {
        active: true,
      });
    });

    it('should filter by search query', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
      };
      marketRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      marketRepository.paginate.mockResolvedValue({
        data: [],
        meta: { currentPage: 1, perPage: 20, total: 0, totalPages: 0 },
      });
      tokenRepository.findByMarketIds.mockResolvedValue([]);

      await service.getMarkets({ search: 'test' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('market.question ILIKE :search', {
        search: '%test%',
      });
    });

    it('should filter by closed status', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
      };
      marketRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      marketRepository.paginate.mockResolvedValue({
        data: [],
        meta: { currentPage: 1, perPage: 20, total: 0, totalPages: 0 },
      });
      tokenRepository.findByMarketIds.mockResolvedValue([]);

      await service.getMarkets({ closed: false });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('market.closed = :closed', {
        closed: false,
      });
    });

    it('should filter by volume range', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
      };
      marketRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      marketRepository.paginate.mockResolvedValue({
        data: [],
        meta: { currentPage: 1, perPage: 20, total: 0, totalPages: 0 },
      });
      tokenRepository.findByMarketIds.mockResolvedValue([]);

      await service.getMarkets({ volumeMin: 1000, volumeMax: 50000 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('market.volume >= :volumeMin', {
        volumeMin: '1000',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('market.volume <= :volumeMax', {
        volumeMax: '50000',
      });
    });

    it('should filter by liquidity range', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
      };
      marketRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      marketRepository.paginate.mockResolvedValue({
        data: [],
        meta: { currentPage: 1, perPage: 20, total: 0, totalPages: 0 },
      });
      tokenRepository.findByMarketIds.mockResolvedValue([]);

      await service.getMarkets({ liquidityMin: 500, liquidityMax: 10000 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('market.liquidity >= :liquidityMin', {
        liquidityMin: '500',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('market.liquidity <= :liquidityMax', {
        liquidityMax: '10000',
      });
    });

    it('should filter by date ranges', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
      };
      marketRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);
      marketRepository.paginate.mockResolvedValue({
        data: [],
        meta: { currentPage: 1, perPage: 20, total: 0, totalPages: 0 },
      });
      tokenRepository.findByMarketIds.mockResolvedValue([]);

      const createdAtMin = '2024-01-01';
      const createdAtMax = '2024-12-31';
      const updatedAtMin = '2024-06-01';
      const updatedAtMax = '2024-12-31';

      await service.getMarkets({
        createdAtMin,
        createdAtMax,
        updatedAtMin,
        updatedAtMax,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('market.created_at >= :createdAtMin', {
        createdAtMin,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('market.created_at <= :createdAtMax', {
        createdAtMax,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('market.updated_at >= :updatedAtMin', {
        updatedAtMin,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('market.updated_at <= :updatedAtMax', {
        updatedAtMax,
      });
    });
  });

  describe('getMarketByExternalId', () => {
    it('should return market by polymarket id', async () => {
      marketRepository.findByExternalId.mockResolvedValue(mockMarket);
      marketRepository.findById.mockResolvedValue(mockMarket);
      tokenRepository.findByMarketId.mockResolvedValue([mockToken]);
      eventRepository.findById.mockResolvedValue(mockEvent);

      const result = await service.getMarketByExternalId('market-123');

      expect(result.externalId).toBe('market-123');
      expect(marketRepository.findByExternalId).toHaveBeenCalledWith('market-123', 'polymarket');
    });

    it('should throw MarketNotFoundException if not found', async () => {
      marketRepository.findByExternalId.mockResolvedValue(null);

      await expect(service.getMarketByExternalId('non-existent')).rejects.toThrow(MarketNotFoundException);
    });
  });
});
