import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';
import { SyncService } from './sync.service';
import { MarketRepository } from '@database/repositories/market.repository';
import { TokenRepository } from '@database/repositories/token.repository';
import { MARKET_PROVIDER } from '@providers/market-provider.interface';
import { AppLogger } from '@common/logger/app-logger.service';
import { Event } from '@database/entities/event.entity';
import { Market } from '@database/entities/market.entity';
import { Token } from '@database/entities/token.entity';
import type { ProviderEvent, ProviderMarket, MarketProvider } from '@app-types/index';

describe('SyncService', () => {
  let service: SyncService;
  let marketProvider: jest.Mocked<MarketProvider>;
  let marketRepository: jest.Mocked<MarketRepository>;
  let tokenRepository: jest.Mocked<TokenRepository>;
  let dataSource: jest.Mocked<DataSource>;
  let queryRunner: jest.Mocked<QueryRunner>;

  const mockLogger = {
    setPrefix: jest.fn().mockReturnThis(),
    setContext: jest.fn().mockReturnThis(),
    setContextData: jest.fn().mockReturnThis(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  };

  const mockProviderEvent: ProviderEvent = {
    id: 'poly-event-123',
    title: 'Test Event',
    description: 'Description',
    slug: 'test-event',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    active: true,
    metadata: {},
  };

  const mockProviderMarket: ProviderMarket = {
    id: 'poly-market-456',
    eventId: 'poly-event-123',
    conditionId: 'condition-789',
    question: 'Test question?',
    description: 'Market description',
    outcomeYesPrice: '0.65',
    outcomeNoPrice: '0.35',
    volume: '10000',
    liquidity: '5000',
    active: true,
    closed: false,
    tokens: [
      { tokenId: 'token-yes', outcome: 'YES', price: '0.65' },
      { tokenId: 'token-no', outcome: 'NO', price: '0.35' },
    ],
    metadata: {},
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
        create: jest.fn().mockImplementation((_, data) => data),
        save: jest.fn().mockImplementation((_, data) => ({ id: 1, ...data })),
      } as any,
    } as unknown as jest.Mocked<QueryRunner>;

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as jest.Mocked<DataSource>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        {
          provide: MARKET_PROVIDER,
          useValue: {
            getName: jest.fn().mockReturnValue('polymarket'),
            getEvents: jest.fn(),
            getMarkets: jest.fn(),
            getMarketPrice: jest.fn(),
          },
        },
        {
          provide: MarketRepository,
          useValue: {
            findActiveMarketsWithPriceInfo: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: TokenRepository,
          useValue: {
            updatePriceByMarketIdAndOutcome: jest.fn(),
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
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
    marketProvider = module.get(MARKET_PROVIDER);
    marketRepository = module.get(MarketRepository);
    tokenRepository = module.get(TokenRepository);
  });

  describe('syncEvents', () => {
    it('should sync events from provider', async () => {
      marketProvider.getEvents.mockResolvedValue([mockProviderEvent]);
      marketProvider.getMarkets.mockResolvedValue([mockProviderMarket]);
      queryRunner.manager.findOne.mockResolvedValue(null);

      const result = await service.syncEvents(100);

      expect(result.eventsCreated).toBe(1);
      expect(result.marketsCreated).toBe(1);
      expect(result.tokensCreated).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should update existing events', async () => {
      marketProvider.getEvents.mockResolvedValue([mockProviderEvent]);
      marketProvider.getMarkets.mockResolvedValue([]);

      const existingEvent = new Event();
      existingEvent.id = 1;
      existingEvent.externalId = 'poly-event-123';
      queryRunner.manager.findOne.mockResolvedValue(existingEvent);

      const result = await service.syncEvents(100);

      expect(result.eventsUpdated).toBe(1);
      expect(result.eventsCreated).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      marketProvider.getEvents.mockRejectedValue(new Error('API Error'));

      const result = await service.syncEvents(100);

      expect(result.errors).toContain('Sync failed: API Error');
    });

    it('should handle individual event sync errors', async () => {
      marketProvider.getEvents.mockResolvedValue([mockProviderEvent]);
      queryRunner.manager.findOne.mockRejectedValue(new Error('DB Error'));

      const result = await service.syncEvents(100);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to sync event');
    });

    it('should continue syncing after market sync errors', async () => {
      const event2 = { ...mockProviderEvent, id: 'poly-event-456' };
      marketProvider.getEvents.mockResolvedValue([mockProviderEvent, event2]);
      marketProvider.getMarkets.mockRejectedValue(new Error('Market fetch failed'));
      queryRunner.manager.findOne.mockResolvedValue(null);

      const result = await service.syncEvents(100);

      expect(result.eventsCreated).toBe(2);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('syncEvent', () => {
    it('should create new event', async () => {
      queryRunner.manager.findOne.mockResolvedValue(null);

      const result = await service.syncEvent(mockProviderEvent);

      expect(result.created).toBe(true);
      expect(result.event).toBeDefined();
    });

    it('should update existing event', async () => {
      const existingEvent = new Event();
      existingEvent.id = 1;
      existingEvent.externalId = 'poly-event-123';
      queryRunner.manager.findOne.mockResolvedValue(existingEvent);
      queryRunner.manager.save.mockResolvedValue(existingEvent);

      const result = await service.syncEvent(mockProviderEvent);

      expect(result.created).toBe(false);
      expect(result.event.id).toBe(1);
    });

    it('should rollback on error', async () => {
      queryRunner.manager.findOne.mockResolvedValue(null);
      queryRunner.manager.save.mockRejectedValue(new Error('Save failed'));

      await expect(service.syncEvent(mockProviderEvent)).rejects.toThrow('Save failed');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('syncMarket', () => {
    it('should create new market with tokens', async () => {
      queryRunner.manager.findOne.mockResolvedValue(null);

      const result = await service.syncMarket(mockProviderMarket, 1);

      expect(result.created).toBe(true);
      expect(result.tokensCreated).toBe(2);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should update existing market and tokens', async () => {
      const existingMarket = new Market();
      existingMarket.id = 1;
      const existingToken = new Token();
      existingToken.id = 1;

      queryRunner.manager.findOne
        .mockResolvedValueOnce(existingMarket)
        .mockResolvedValueOnce(existingToken)
        .mockResolvedValueOnce(existingToken);

      const result = await service.syncMarket(mockProviderMarket, 1);

      expect(result.created).toBe(false);
      expect(result.tokensUpdated).toBe(2);
    });

    it('should rollback on market sync error', async () => {
      queryRunner.manager.findOne.mockResolvedValue(null);
      queryRunner.manager.save.mockRejectedValue(new Error('Save failed'));

      await expect(service.syncMarket(mockProviderMarket, 1)).rejects.toThrow('Save failed');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('updateMarketPrices', () => {
    it('should update prices for active markets', async () => {
      const activeMarket = {
        id: 1,
        conditionId: 'condition-123',
        externalId: 'market-123',
      } as Market;

      marketRepository.findActiveMarketsWithPriceInfo.mockResolvedValue([activeMarket]);
      marketProvider.getMarketPrice.mockResolvedValue({
        marketId: 'condition-123',
        yesPrice: '0.70',
        noPrice: '0.30',
        timestamp: new Date(),
      });

      const result = await service.updateMarketPrices();

      expect(result.updated).toBe(1);
      expect(marketRepository.update).toHaveBeenCalledWith(1, {
        outcomeYesPrice: '0.70',
        outcomeNoPrice: '0.30',
      });
      expect(tokenRepository.updatePriceByMarketIdAndOutcome).toHaveBeenCalledTimes(2);
    });

    it('should skip markets not found on provider', async () => {
      const activeMarket = { id: 1, conditionId: 'c1', externalId: 'm1' } as Market;
      marketRepository.findActiveMarketsWithPriceInfo.mockResolvedValue([activeMarket]);
      marketProvider.getMarketPrice.mockResolvedValue(null);

      const result = await service.updateMarketPrices();

      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(marketRepository.update).not.toHaveBeenCalled();
    });

    it('should handle price update errors', async () => {
      const activeMarket = { id: 1, conditionId: 'c1', externalId: 'm1' } as Market;
      marketRepository.findActiveMarketsWithPriceInfo.mockResolvedValue([activeMarket]);
      marketProvider.getMarketPrice.mockRejectedValue(new Error('Price fetch failed'));

      const result = await service.updateMarketPrices();

      expect(result.errors).toHaveLength(1);
      expect(result.updated).toBe(0);
    });

    it('should handle errors when fetching active markets', async () => {
      marketRepository.findActiveMarketsWithPriceInfo.mockRejectedValue(
        new Error('DB connection failed'),
      );

      const result = await service.updateMarketPrices();

      expect(result.errors).toContain('Price update failed: DB connection failed');
      expect(result.updated).toBe(0);
    });
  });

  describe('syncMarketsForEvent', () => {
    it('should handle individual market sync errors', async () => {
      marketProvider.getMarkets.mockResolvedValue([mockProviderMarket]);
      queryRunner.manager.findOne.mockRejectedValue(new Error('DB Error'));

      const result = await service.syncMarketsForEvent('poly-event-123', 1);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to sync market');
    });

    it('should handle getMarkets errors', async () => {
      marketProvider.getMarkets.mockRejectedValue(new Error('API Error'));

      const result = await service.syncMarketsForEvent('poly-event-123', 1);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to fetch markets');
    });
  });
});

