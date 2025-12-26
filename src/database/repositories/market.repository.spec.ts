import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketRepository } from './market.repository';
import { Market } from '@database/entities/market.entity';
import { ProviderManagerService } from '@providers/provider-manager.service';

describe('MarketRepository', () => {
  let marketRepository: MarketRepository;
  let repository: jest.Mocked<Repository<Market>>;

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
    tokens: [],
    orders: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketRepository,
        {
          provide: getRepositoryToken(Market),
          useValue: {
            findOneBy: jest.fn(),
            findBy: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
            count: jest.fn(),
            manager: {},
          },
        },
        {
          provide: ProviderManagerService,
          useValue: {
            getCurrentProviderName: jest.fn().mockReturnValue('polymarket'),
          },
        },
      ],
    }).compile();

    marketRepository = module.get<MarketRepository>(MarketRepository);
    repository = module.get(getRepositoryToken(Market));
  });

  describe('findByExternalId', () => {
    it('should find market by external id', async () => {
      repository.findOneBy.mockResolvedValue(mockMarket);

      const result = await marketRepository.findByExternalId('market-123');

      expect(result).toEqual(mockMarket);
      expect(repository.findOneBy).toHaveBeenCalledWith({
        externalId: 'market-123',
        provider: 'polymarket',
      });
    });
  });

  describe('findByEventId', () => {
    it('should find markets by event id', async () => {
      repository.findBy.mockResolvedValue([mockMarket]);

      const result = await marketRepository.findByEventId(1);

      expect(result).toHaveLength(1);
      expect(repository.findBy).toHaveBeenCalledWith({ eventId: 1 });
    });
  });

  describe('findActiveMarkets', () => {
    it('should find active markets', async () => {
      repository.findBy.mockResolvedValue([mockMarket]);

      const result = await marketRepository.findActiveMarkets();

      expect(result).toHaveLength(1);
      expect(repository.findBy).toHaveBeenCalledWith({ active: true, closed: false });
    });
  });

  describe('findActiveMarketsWithPriceInfo', () => {
    it('should return active markets with price info', async () => {
      repository.find.mockResolvedValue([mockMarket]);

      const result = await marketRepository.findActiveMarketsWithPriceInfo();

      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: { active: true },
        select: ['id', 'externalId', 'conditionId'],
      });
    });
  });

  describe('countByEventId', () => {
    it('should count markets by event id', async () => {
      repository.count.mockResolvedValue(5);

      const result = await marketRepository.countByEventId(1);

      expect(result).toBe(5);
      expect(repository.count).toHaveBeenCalledWith({ where: { eventId: 1 } });
    });
  });

  describe('getMarketCountsByEventIds', () => {
    it('should return empty object for empty eventIds', async () => {
      const result = await marketRepository.getMarketCountsByEventIds([]);

      expect(result).toEqual({});
    });

    it('should return market counts by event ids', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { eventId: 1, count: '5' },
          { eventId: 2, count: '3' },
        ]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);

      const result = await marketRepository.getMarketCountsByEventIds([1, 2]);

      expect(result).toEqual({ 1: 5, 2: 3 });
    });
  });
});
