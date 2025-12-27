import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { PolymarketWebSocketService } from './polymarket-websocket.service';
import { MarketRepository } from '@database/repositories/index';
import { AppLogger } from '@common/logger/app-logger.service';

jest.mock('ws');

describe('PolymarketWebSocketService', () => {
  let service: PolymarketWebSocketService;
  let marketRepository: jest.Mocked<MarketRepository>;
  let configService: jest.Mocked<ConfigService>;
  let mockWs: jest.Mocked<WebSocket>;

  const mockLogger = {
    setPrefix: jest.fn().mockReturnThis(),
    setContext: jest.fn().mockReturnThis(),
    setContextData: jest.fn().mockReturnThis(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    mockWs = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      removeAllListeners: jest.fn(),
      readyState: WebSocket.OPEN,
    } as unknown as jest.Mocked<WebSocket>;

    (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolymarketWebSocketService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'polymarket.clobWebSocketUrl':
                  return 'wss://test.polymarket.com';
                case 'polymarket.websocketEnabled':
                  return true;
                case 'polymarket.websocketReconnectDelay':
                  return 5000;
                default:
                  return undefined;
              }
            }),
          },
        },
        {
          provide: MarketRepository,
          useValue: {
            findActiveMarketsWithTokens: jest.fn(),
          },
        },
        {
          provide: AppLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<PolymarketWebSocketService>(PolymarketWebSocketService);
    marketRepository = module.get(MarketRepository);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with correct configuration', () => {
      expect(configService.get).toHaveBeenCalledWith('polymarket.clobWebSocketUrl');
      expect(configService.get).toHaveBeenCalledWith('polymarket.websocketEnabled');
      expect(configService.get).toHaveBeenCalledWith('polymarket.websocketReconnectDelay');
    });

    it('should not connect when disabled', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'polymarket.websocketEnabled') return false;
        return 'wss://test.polymarket.com';
      });

      const disabledService = new PolymarketWebSocketService(configService, marketRepository, mockLogger as any);

      await disabledService.onModuleInit();

      expect(mockLogger.log).toHaveBeenCalledWith('WebSocket is disabled via configuration');
      expect(WebSocket).not.toHaveBeenCalled();
    });
  });

  describe('connection management', () => {
    it('should connect on module init', async () => {
      marketRepository.findActiveMarketsWithTokens.mockResolvedValue([]);

      await service.onModuleInit();

      expect(WebSocket).toHaveBeenCalledWith('wss://test.polymarket.com/ws/market');
      expect(mockWs.on).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should handle connection open event', async () => {
      marketRepository.findActiveMarketsWithTokens.mockResolvedValue([
        {
          id: 1,
          tokenIds: ['token-1', 'token-2'],
        },
      ] as any);

      await service.onModuleInit();

      const openHandler = (mockWs.on as jest.Mock).mock.calls.find((call) => call[0] === 'open')?.[1];

      expect(openHandler).toBeDefined();
      openHandler();

      expect(mockLogger.log).toHaveBeenCalledWith('WebSocket connected');
      expect(service.getConnectionState()).toBe('connected');
    });

    it('should handle connection error event', async () => {
      await service.onModuleInit();

      const errorHandler = (mockWs.on as jest.Mock).mock.calls.find((call) => call[0] === 'error')?.[1];

      const testError = new Error('Connection failed');
      errorHandler(testError);

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('WebSocket error: Connection failed'));
      expect(service.getConnectionState()).toBe('error');
    });

    it('should handle connection close event', async () => {
      await service.onModuleInit();

      const closeHandler = (mockWs.on as jest.Mock).mock.calls.find((call) => call[0] === 'close')?.[1];

      closeHandler(1000, Buffer.from('Normal close'));

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('WebSocket closed: code=1000'));
      expect(service.getConnectionState()).toBe('disconnected');
    });
  });

  describe('message handling', () => {
    it('should handle incoming JSON messages', async () => {
      const messageHandler = jest.fn();
      service.setMessageHandler(messageHandler);

      await service.onModuleInit();

      const messageCallback = (mockWs.on as jest.Mock).mock.calls.find((call) => call[0] === 'message')?.[1];

      const testMessage = { event_type: 'price_change', data: 'test' };
      messageCallback(Buffer.from(JSON.stringify(testMessage)));

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(messageHandler).toHaveBeenCalledWith(testMessage);
    });

    it('should handle PONG messages', async () => {
      const messageHandler = jest.fn();
      service.setMessageHandler(messageHandler);

      await service.onModuleInit();

      const messageCallback = (mockWs.on as jest.Mock).mock.calls.find((call) => call[0] === 'message')?.[1];

      messageCallback(Buffer.from('PONG'));

      expect(mockLogger.debug).toHaveBeenCalledWith('Received PONG from server');
      expect(messageHandler).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON messages', async () => {
      await service.onModuleInit();

      const messageCallback = (mockWs.on as jest.Mock).mock.calls.find((call) => call[0] === 'message')?.[1];

      messageCallback(Buffer.from('invalid json'));

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to parse WebSocket message'));
    });
  });

  describe('subscription management', () => {
    beforeEach(async () => {
      await service.onModuleInit();
      const openHandler = (mockWs.on as jest.Mock).mock.calls.find((call) => call[0] === 'open')?.[1];
      openHandler();
    });

    it('should subscribe to active markets on connection', async () => {
      marketRepository.findActiveMarketsWithTokens.mockResolvedValue([
        {
          id: 1,
          tokenIds: ['token-1', 'token-2'],
        },
        {
          id: 2,
          tokenIds: ['token-3'],
        },
      ] as any);

      await service.onModuleInit();
      const openHandler = (mockWs.on as jest.Mock).mock.calls.find((call) => call[0] === 'open')?.[1];
      openHandler();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(marketRepository.findActiveMarketsWithTokens).toHaveBeenCalled();
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'MARKET',
          assets_ids: ['token-1', 'token-2', 'token-3'],
        }),
      );
    });

    it('should subscribe to new token IDs', () => {
      service.subscribeToTokenIds(['token-new-1', 'token-new-2']);

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          operation: 'subscribe',
          assets_ids: ['token-new-1', 'token-new-2'],
        }),
      );
      expect(service.getSubscribedTokenCount()).toBe(2);
    });

    it('should not subscribe to already subscribed tokens', () => {
      service.subscribeToTokenIds(['token-1']);
      (mockWs.send as jest.Mock).mockClear();

      service.subscribeToTokenIds(['token-1']);

      expect(mockWs.send).not.toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('All token IDs already subscribed');
    });

    it('should unsubscribe from token IDs', () => {
      service.subscribeToTokenIds(['token-1', 'token-2']);
      (mockWs.send as jest.Mock).mockClear();

      service.unsubscribeFromTokenIds(['token-1']);

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          operation: 'unsubscribe',
          assets_ids: ['token-1'],
        }),
      );
      expect(service.getSubscribedTokenCount()).toBe(1);
    });

    it('should not unsubscribe from non-subscribed tokens', () => {
      service.unsubscribeFromTokenIds(['token-unknown']);

      expect(mockLogger.log).toHaveBeenCalledWith('No token IDs to unsubscribe');
    });

    it('should warn when subscribing while disconnected', () => {
      Object.defineProperty(mockWs, 'readyState', {
        value: WebSocket.CLOSED,
        writable: true,
      });

      service.subscribeToTokenIds(['token-1']);

      expect(mockLogger.warn).toHaveBeenCalledWith('Cannot subscribe: WebSocket not connected');
    });
  });

  describe('ping/pong mechanism', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should send PING messages periodically', async () => {
      await service.onModuleInit();
      const openHandler = (mockWs.on as jest.Mock).mock.calls.find((call) => call[0] === 'open')?.[1];
      openHandler();

      jest.advanceTimersByTime(10000);

      expect(mockWs.send).toHaveBeenCalledWith('PING');
      expect(mockLogger.debug).toHaveBeenCalledWith('PING dispatched to keep connection alive');
    });

    it('should stop ping interval on close', async () => {
      await service.onModuleInit();
      const openHandler = (mockWs.on as jest.Mock).mock.calls.find((call) => call[0] === 'open')?.[1];
      openHandler();

      const closeHandler = (mockWs.on as jest.Mock).mock.calls.find((call) => call[0] === 'close')?.[1];
      closeHandler(1000, Buffer.from(''));

      (mockWs.send as jest.Mock).mockClear();
      jest.advanceTimersByTime(10000);

      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('connection state', () => {
    it('should return connection state', () => {
      expect(service.getConnectionState()).toBe('disconnected');
    });

    it('should return correct isConnected status', async () => {
      expect(service.isConnected()).toBe(false);

      await service.onModuleInit();
      const openHandler = (mockWs.on as jest.Mock).mock.calls.find((call) => call[0] === 'open')?.[1];
      openHandler();

      expect(service.isConnected()).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup on module destroy', async () => {
      await service.onModuleInit();

      await service.onModuleDestroy();

      expect(mockWs.removeAllListeners).toHaveBeenCalled();
      expect(mockWs.close).toHaveBeenCalled();
      expect(service.getConnectionState()).toBe('disconnected');
    });

    it('should clear timers on destroy', async () => {
      jest.useFakeTimers();

      await service.onModuleInit();
      const openHandler = (mockWs.on as jest.Mock).mock.calls.find((call) => call[0] === 'open')?.[1];
      openHandler();

      await service.onModuleDestroy();

      (mockWs.send as jest.Mock).mockClear();
      jest.advanceTimersByTime(10000);

      expect(mockWs.send).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});
