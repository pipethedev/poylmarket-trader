import { Test, TestingModule } from '@nestjs/testing';
import { PolymarketProvider } from './polymarket.provider';
import { PolymarketHttpService } from './polymarket-http.service';
import { PolymarketClobService } from './polymarket-clob.service';
import { AppLogger } from '@common/logger/app-logger.service';
import { ProviderException, ProviderUnavailableException } from '@common/exceptions';
import { AxiosError, AxiosResponse } from 'axios';

describe('PolymarketProvider', () => {
  let provider: PolymarketProvider;
  let httpService: jest.Mocked<PolymarketHttpService>;
  let clobService: jest.Mocked<PolymarketClobService>;

  const mockLogger = {
    setPrefix: jest.fn().mockReturnThis(),
    setContext: jest.fn().mockReturnThis(),
    setContextData: jest.fn().mockReturnThis(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockGammaEvent = {
    id: 'event-123',
    title: 'Test Event',
    description: 'Description',
    slug: 'test-event',
    ticker: 'TEST',
    startDate: '2024-01-01T00:00:00Z',
    endDate: '2024-12-31T00:00:00Z',
    active: true,
    closed: false,
    archived: false,
    featured: true,
    restricted: false,
    liquidity: 10000,
    volume: 50000,
    markets: [],
  };

  const mockGammaMarket = {
    id: 'market-456',
    conditionId: 'condition-789',
    question: 'Test question?',
    slug: 'test-market',
    resolutionSource: 'https://source.com',
    fee: '0.02',
    volume: '10000',
    liquidity: '5000',
    outcomePrices: '["0.65","0.35"]',
    clobTokenIds: '["token-yes","token-no"]',
    active: true,
    closed: false,
    acceptingOrders: true,
    tokens: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolymarketProvider,
        {
          provide: PolymarketHttpService,
          useValue: {
            gammaGet: jest.fn(),
          },
        },
        {
          provide: PolymarketClobService,
          useValue: {
            getMarkets: jest.fn(),
            getMarket: jest.fn(),
            healthCheck: jest.fn(),
          },
        },
        {
          provide: AppLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    provider = module.get<PolymarketProvider>(PolymarketProvider);
    httpService = module.get(PolymarketHttpService);
    clobService = module.get(PolymarketClobService);
  });

  describe('providerName', () => {
    it('should return polymarket', () => {
      expect(provider.providerName).toBe('polymarket');
    });
  });

  describe('getEvents', () => {
    it('should fetch and map events from Gamma API', async () => {
      httpService.gammaGet.mockResolvedValue({
        data: [mockGammaEvent],
      } as AxiosResponse);

      const result = await provider.getEvents({ limit: 100 });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('event-123');
      expect(result[0].title).toBe('Test Event');
      expect(result[0].active).toBe(true);
    });

    it('should handle connection errors', async () => {
      const axiosError = new AxiosError('Connection refused');
      axiosError.code = 'ECONNREFUSED';
      httpService.gammaGet.mockRejectedValue(axiosError);

      await expect(provider.getEvents()).rejects.toThrow(ProviderUnavailableException);
    });

    it('should handle API errors', async () => {
      const axiosError = new AxiosError('Bad Request');
      axiosError.response = { status: 400, data: { error: 'Invalid params' } } as AxiosResponse;
      httpService.gammaGet.mockRejectedValue(axiosError);

      await expect(provider.getEvents()).rejects.toThrow(ProviderException);
    });
  });

  describe('getMarkets', () => {
    it('should fetch and map markets for an event', async () => {
      httpService.gammaGet.mockResolvedValue({
        data: { ...mockGammaEvent, markets: [mockGammaMarket] },
      } as AxiosResponse);

      const result = await provider.getMarkets('event-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('condition-789');
      expect(result[0].question).toBe('Test question?');
      expect(result[0].tokens).toHaveLength(2);
    });

    it('should handle empty markets', async () => {
      httpService.gammaGet.mockResolvedValue({
        data: { ...mockGammaEvent, markets: [] },
      } as AxiosResponse);

      const result = await provider.getMarkets('event-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('getAllMarkets', () => {
    it('should fetch markets from CLOB API', async () => {
      const mockClobMarket = {
        condition_id: 'cond-123',
        question: 'CLOB question?',
        description: 'CLOB description',
        active: true,
        closed: false,
        tokens: [
          { token_id: 'yes-token', outcome: 'Yes', price: 0.65 },
          { token_id: 'no-token', outcome: 'No', price: 0.35 },
        ],
      };

      clobService.getMarkets.mockResolvedValue({ data: [mockClobMarket] });

      const result = await provider.getAllMarkets();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cond-123');
    });

    it('should filter by active status', async () => {
      const markets = [
        { condition_id: 'c1', active: true, closed: false, tokens: [] },
        { condition_id: 'c2', active: false, closed: false, tokens: [] },
      ];
      clobService.getMarkets.mockResolvedValue({ data: markets });

      const result = await provider.getAllMarkets({ active: true });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
    });
  });

  describe('getMarketPrice', () => {
    it('should fetch market price', async () => {
      const mockMarket = {
        condition_id: 'cond-123',
        tokens: [
          { token_id: 'yes', outcome: 'Yes', price: 0.7 },
          { token_id: 'no', outcome: 'No', price: 0.3 },
        ],
      };
      clobService.getMarket.mockResolvedValue(mockMarket);

      const result = await provider.getMarketPrice('cond-123');

      expect(result.marketId).toBe('cond-123');
      expect(result.yesPrice).toBe('0.7');
      expect(result.noPrice).toBe('0.3');
    });
  });

  describe('healthCheck', () => {
    it('should return true when healthy', async () => {
      clobService.healthCheck.mockResolvedValue(true);

      const result = await provider.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when unhealthy', async () => {
      clobService.healthCheck.mockResolvedValue(false);

      const result = await provider.healthCheck();

      expect(result).toBe(false);
    });
  });
});

