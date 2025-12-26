import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProviderManagerService } from './provider-manager.service';
import { MARKET_PROVIDER, type IMarketProvider } from './market-provider.interface';
import type { AppConfig } from '@app-types/index';

describe('ProviderManagerService', () => {
  let service: ProviderManagerService;
  let marketProvider: jest.Mocked<IMarketProvider>;
  let configService: jest.Mocked<ConfigService<AppConfig>>;

  const mockMarketProvider: jest.Mocked<IMarketProvider> = {
    getName: jest.fn().mockReturnValue('polymarket'),
    getEvents: jest.fn(),
    getMarkets: jest.fn(),
    getMarketPrice: jest.fn(),
    placeOrder: jest.fn(),
    cancelOrder: jest.fn(),
    getOrderStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderManagerService,
        {
          provide: MARKET_PROVIDER,
          useValue: mockMarketProvider,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('polymarket'),
          },
        },
      ],
    }).compile();

    service = module.get<ProviderManagerService>(ProviderManagerService);
    marketProvider = module.get(MARKET_PROVIDER);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with default provider from config', () => {
      expect(configService.get).toHaveBeenCalledWith('defaultProvider', {
        infer: true,
      });
      expect(service.getDefaultProviderName()).toBe('polymarket');
    });
  });

  describe('getProvider', () => {
    it('should return the injected market provider', () => {
      const provider = service.getProvider();

      expect(provider).toBe(mockMarketProvider);
      expect(provider).toBeDefined();
    });

    it('should return a provider with all required methods', () => {
      const provider = service.getProvider();

      expect(provider.getName).toBeDefined();
      expect(provider.getEvents).toBeDefined();
      expect(provider.getMarkets).toBeDefined();
      expect(provider.getMarketPrice).toBeDefined();
      expect(provider.placeOrder).toBeDefined();
      expect(provider.cancelOrder).toBeDefined();
      expect(provider.getOrderStatus).toBeDefined();
    });
  });

  describe('getDefaultProviderName', () => {
    it('should return the default provider name', () => {
      const providerName = service.getDefaultProviderName();

      expect(providerName).toBe('polymarket');
    });

    it('should return value set during initialization', () => {
      const result = service.getDefaultProviderName();

      expect(result).toBe('polymarket');
      expect(configService.get).toHaveBeenCalledTimes(1); // Only called once during init
    });
  });

  describe('getCurrentProviderName', () => {
    it('should return the current provider name from the provider', () => {
      const providerName = service.getCurrentProviderName();

      expect(providerName).toBe('polymarket');
      expect(marketProvider.getName).toHaveBeenCalled();
    });

    it('should call getName on the provider each time', () => {
      service.getCurrentProviderName();
      service.getCurrentProviderName();

      expect(marketProvider.getName).toHaveBeenCalledTimes(2);
    });
  });

  describe('isCurrentProvider', () => {
    it('should return true when provider name matches current provider', () => {
      const result = service.isCurrentProvider('polymarket');

      expect(result).toBe(true);
      expect(marketProvider.getName).toHaveBeenCalled();
    });

    it('should return false when provider name does not match', () => {
      const result = service.isCurrentProvider('other-provider');

      expect(result).toBe(false);
      expect(marketProvider.getName).toHaveBeenCalled();
    });

    it('should be case sensitive', () => {
      const result = service.isCurrentProvider('Polymarket');

      expect(result).toBe(false);
    });

    it('should handle empty string', () => {
      const result = service.isCurrentProvider('');

      expect(result).toBe(false);
    });
  });

  describe('provider consistency', () => {
    it('should maintain consistency between default and current provider', () => {
      const defaultName = service.getDefaultProviderName();
      const currentName = service.getCurrentProviderName();

      expect(defaultName).toBe(currentName);
    });

    it('should correctly identify if using default provider', () => {
      const defaultName = service.getDefaultProviderName();
      const isDefault = service.isCurrentProvider(defaultName);

      expect(isDefault).toBe(true);
    });
  });
});
