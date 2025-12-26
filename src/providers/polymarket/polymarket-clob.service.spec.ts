import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PolymarketClobService } from './polymarket-clob.service';

jest.mock('@polymarket/clob-client', () => ({
  ClobClient: jest.fn().mockImplementation(() => ({
    getOk: jest.fn(),
    getMarkets: jest.fn(),
    getMarket: jest.fn(),
    getOrderBook: jest.fn(),
    getMidpoint: jest.fn(),
    getPrice: jest.fn(),
    getLastTradePrice: jest.fn(),
    getTickSize: jest.fn(),
  })),
  Chain: {
    POLYGON: 137,
  },
}));

describe('PolymarketClobService', () => {
  let service: PolymarketClobService;
  let mockClient: {
    getOk: jest.Mock;
    getMarkets: jest.Mock;
    getMarket: jest.Mock;
    getOrderBook: jest.Mock;
    getMidpoint: jest.Mock;
    getPrice: jest.Mock;
    getLastTradePrice: jest.Mock;
    getTickSize: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolymarketClobService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'polymarket.clobApiUrl') return 'https://clob.polymarket.com';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PolymarketClobService>(PolymarketClobService);
    mockClient = service.getClient() as typeof mockClient;
  });

  describe('healthCheck', () => {
    it('should return true when API is healthy', async () => {
      mockClient.getOk.mockResolvedValue('OK');

      const result = await service.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when API is unhealthy', async () => {
      mockClient.getOk.mockRejectedValue(new Error('Connection failed'));

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('getMarkets', () => {
    it('should fetch markets', async () => {
      const mockMarkets = { data: [{ condition_id: 'cond-1' }], next_cursor: null };
      mockClient.getMarkets.mockResolvedValue(mockMarkets);

      const result = await service.getMarkets();

      expect(result).toEqual(mockMarkets);
      expect(mockClient.getMarkets).toHaveBeenCalled();
    });

    it('should fetch markets with cursor', async () => {
      mockClient.getMarkets.mockResolvedValue({ data: [], next_cursor: null });

      await service.getMarkets('cursor-123');

      expect(mockClient.getMarkets).toHaveBeenCalledWith('cursor-123');
    });
  });

  describe('getMarket', () => {
    it('should fetch a single market', async () => {
      const mockMarket = { condition_id: 'cond-1', question: 'Test?' };
      mockClient.getMarket.mockResolvedValue(mockMarket);

      const result = await service.getMarket('cond-1');

      expect(result).toEqual(mockMarket);
      expect(mockClient.getMarket).toHaveBeenCalledWith('cond-1');
    });
  });

  describe('getOrderBook', () => {
    it('should fetch order book for a token', async () => {
      const mockOrderBook = { bids: [], asks: [] };
      mockClient.getOrderBook.mockResolvedValue(mockOrderBook);

      const result = await service.getOrderBook('token-1');

      expect(result).toEqual(mockOrderBook);
      expect(mockClient.getOrderBook).toHaveBeenCalledWith('token-1');
    });
  });

  describe('getMidpoint', () => {
    it('should fetch midpoint price', async () => {
      mockClient.getMidpoint.mockResolvedValue({ mid: '0.50' });

      const result = await service.getMidpoint('token-1');

      expect(result).toEqual({ mid: '0.50' });
    });
  });

  describe('getPrice', () => {
    it('should fetch price for BUY side', async () => {
      mockClient.getPrice.mockResolvedValue({ price: '0.65' });

      const result = await service.getPrice('token-1', 'BUY');

      expect(result).toEqual({ price: '0.65' });
      expect(mockClient.getPrice).toHaveBeenCalledWith('token-1', 'BUY');
    });

    it('should fetch price for SELL side', async () => {
      mockClient.getPrice.mockResolvedValue({ price: '0.35' });

      const result = await service.getPrice('token-1', 'SELL');

      expect(result).toEqual({ price: '0.35' });
    });
  });

  describe('getLastTradePrice', () => {
    it('should fetch last trade price', async () => {
      mockClient.getLastTradePrice.mockResolvedValue({ price: '0.55' });

      const result = await service.getLastTradePrice('token-1');

      expect(result).toEqual({ price: '0.55' });
    });
  });

  describe('getTickSize', () => {
    it('should fetch tick size', async () => {
      mockClient.getTickSize.mockResolvedValue({ minimum_tick_size: '0.01' });

      const result = await service.getTickSize('token-1');

      expect(result).toEqual({ minimum_tick_size: '0.01' });
    });
  });

  describe('getClient', () => {
    it('should return the CLOB client', () => {
      const client = service.getClient();
      expect(client).toBeDefined();
    });
  });
});

