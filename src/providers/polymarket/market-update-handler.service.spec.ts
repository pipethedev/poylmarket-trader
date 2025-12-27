import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';
import { MarketUpdateHandlerService } from './market-update-handler.service';
import { PolymarketWebSocketService } from './polymarket-websocket.service';
import { MarketRepository, TokenRepository, EventRepository } from '@database/repositories/index';
import { Market } from '@database/entities/market.entity';
import { Token, TokenOutcome } from '@database/entities/token.entity';
import { AppLogger } from '@common/logger/app-logger.service';
import { MARKET_PROVIDER } from '@providers/market-provider.interface';
import { SyncService } from '@modules/sync/sync.service';

describe('MarketUpdateHandlerService', () => {
  let service: MarketUpdateHandlerService;
  let wsService: jest.Mocked<PolymarketWebSocketService>;
  let marketRepository: jest.Mocked<MarketRepository>;
  let tokenRepository: jest.Mocked<TokenRepository>;
  let eventRepository: jest.Mocked<EventRepository>;
  let dataSource: jest.Mocked<DataSource>;
  let queryRunner: jest.Mocked<QueryRunner>;
  let marketProvider: any;
  let syncService: jest.Mocked<SyncService>;

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
    marketId: 1,
    tokenId: 'token-123',
    outcome: TokenOutcome.YES,
    price: '0.65',
  } as Token;

  const mockMarket: Market = {
    id: 1,
    conditionId: 'condition-123',
    outcomeYesPrice: '0.65',
    outcomeNoPrice: '0.35',
    metadata: {},
  } as Market;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        find: jest.fn(),
        update: jest.fn(),
      } as any,
    } as unknown as jest.Mocked<QueryRunner>;

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as jest.Mocked<DataSource>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketUpdateHandlerService,
        {
          provide: PolymarketWebSocketService,
          useValue: {
            setMessageHandler: jest.fn(),
            subscribeToTokenIds: jest.fn(),
            unsubscribeFromTokenIds: jest.fn(),
          },
        },
        {
          provide: MarketRepository,
          useValue: {
            findOneBy: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: TokenRepository,
          useValue: {
            findByTokenId: jest.fn(),
            findByMarketId: jest.fn(),
          },
        },
        {
          provide: EventRepository,
          useValue: {
            findByExternalId: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: MARKET_PROVIDER,
          useValue: {
            getEvents: jest.fn(),
            getMarkets: jest.fn(),
          },
        },
        {
          provide: SyncService,
          useValue: {
            syncEvent: jest.fn(),
            syncMarket: jest.fn(),
          },
        },
        {
          provide: AppLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<MarketUpdateHandlerService>(MarketUpdateHandlerService);
    wsService = module.get(PolymarketWebSocketService);
    marketRepository = module.get(MarketRepository);
    tokenRepository = module.get(TokenRepository);
    eventRepository = module.get(EventRepository);
    marketProvider = module.get(MARKET_PROVIDER);
    syncService = module.get(SyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should set message handler on module init', () => {
      service.onModuleInit();

      expect(wsService.setMessageHandler).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('handleBookMessage', () => {
    it('should update market prices from book message', async () => {
      const yesToken = { ...mockToken, id: 1, outcome: TokenOutcome.YES };
      const noToken = { ...mockToken, id: 2, outcome: TokenOutcome.NO };

      tokenRepository.findByTokenId.mockResolvedValue(yesToken);
      queryRunner.manager.findOne.mockResolvedValue(mockMarket);
      queryRunner.manager.find.mockResolvedValue([yesToken, noToken]);

      const bookMessage = {
        event_type: 'book',
        asset_id: 'token-123',
        market: 'condition-123',
        bids: [{ price: '0.60', size: '100' }],
        asks: [{ price: '0.70', size: '50' }],
        timestamp: '2024-01-01T00:00:00Z',
        hash: 'hash123',
      };

      service.onModuleInit();
      const messageHandler = (wsService.setMessageHandler as jest.Mock).mock.calls[0][0];
      await messageHandler(bookMessage);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(tokenRepository.findByTokenId).toHaveBeenCalledWith('token-123');
      expect(queryRunner.manager.update).toHaveBeenCalledWith(Market, 1, {
        outcomeYesPrice: expect.any(String),
        outcomeNoPrice: expect.any(String),
      });
    });

    it('should skip update if token not found', async () => {
      tokenRepository.findByTokenId.mockResolvedValue(null);

      const bookMessage = {
        event_type: 'book',
        asset_id: 'unknown-token',
        market: 'condition-123',
        bids: [],
        asks: [],
        timestamp: '2024-01-01T00:00:00Z',
        hash: 'hash123',
      };

      service.onModuleInit();
      const messageHandler = (wsService.setMessageHandler as jest.Mock).mock.calls[0][0];
      await messageHandler(bookMessage);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Token not found for asset_id'),
      );
      expect(queryRunner.connect).not.toHaveBeenCalled();
    });
  });

  describe('handlePriceChangeMessage', () => {
    it('should handle price changes for multiple tokens', async () => {
      const yesToken = { ...mockToken, id: 1, outcome: TokenOutcome.YES };
      const noToken = { ...mockToken, id: 2, outcome: TokenOutcome.NO };

      tokenRepository.findByTokenId.mockResolvedValueOnce(yesToken);
      queryRunner.manager.findOne.mockResolvedValue(mockMarket);
      queryRunner.manager.find.mockResolvedValue([yesToken, noToken]);

      const priceChangeMessage = {
        event_type: 'price_change',
        market: 'condition-123',
        price_changes: [
          {
            asset_id: 'token-123',
            price: '0.70',
            size: '100',
            side: 'BUY' as const,
            hash: 'hash123',
            best_bid: '0.68',
            best_ask: '0.72',
          },
        ],
        timestamp: '2024-01-01T00:00:00Z',
      };

      service.onModuleInit();
      const messageHandler = (wsService.setMessageHandler as jest.Mock).mock.calls[0][0];
      await messageHandler(priceChangeMessage);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(tokenRepository.findByTokenId).toHaveBeenCalledWith('token-123');
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should skip tokens that are not found', async () => {
      tokenRepository.findByTokenId.mockResolvedValue(null);

      const priceChangeMessage = {
        event_type: 'price_change',
        market: 'condition-123',
        price_changes: [
          {
            asset_id: 'unknown-token',
            price: '0.70',
            size: '100',
            side: 'BUY' as const,
            hash: 'hash123',
            best_bid: '0.68',
            best_ask: '0.72',
          },
        ],
        timestamp: '2024-01-01T00:00:00Z',
      };

      service.onModuleInit();
      const messageHandler = (wsService.setMessageHandler as jest.Mock).mock.calls[0][0];
      await messageHandler(priceChangeMessage);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('handleLastTradePriceMessage', () => {
    it('should update market metadata with last trade info', async () => {
      tokenRepository.findByTokenId.mockResolvedValue(mockToken);
      marketRepository.findOneBy.mockResolvedValue(mockMarket);

      const lastTradeMessage = {
        event_type: 'last_trade_price',
        asset_id: 'token-123',
        market: 'condition-123',
        price: '0.68',
        side: 'BUY' as const,
        size: '100',
        timestamp: '2024-01-01T00:00:00Z',
      };

      service.onModuleInit();
      const messageHandler = (wsService.setMessageHandler as jest.Mock).mock.calls[0][0];
      await messageHandler(lastTradeMessage);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(marketRepository.update).toHaveBeenCalledWith(1, {
        metadata: {
          lastTradePrice: '0.68',
          lastTradeSize: '100',
          lastTradeSide: 'BUY',
          lastTradeTimestamp: '2024-01-01T00:00:00Z',
        },
      });
    });

    it('should skip if token not found', async () => {
      tokenRepository.findByTokenId.mockResolvedValue(null);

      const lastTradeMessage = {
        event_type: 'last_trade_price',
        asset_id: 'unknown-token',
        market: 'condition-123',
        price: '0.68',
        side: 'BUY' as const,
        size: '100',
        timestamp: '2024-01-01T00:00:00Z',
      };

      service.onModuleInit();
      const messageHandler = (wsService.setMessageHandler as jest.Mock).mock.calls[0][0];
      await messageHandler(lastTradeMessage);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(marketRepository.findOneBy).not.toHaveBeenCalled();
    });
  });

  describe('handleBestBidAskMessage', () => {
    it('should update market prices from best bid/ask', async () => {
      const yesToken = { ...mockToken, id: 1, outcome: TokenOutcome.YES };
      const noToken = { ...mockToken, id: 2, outcome: TokenOutcome.NO };

      tokenRepository.findByTokenId.mockResolvedValue(yesToken);
      queryRunner.manager.findOne.mockResolvedValue(mockMarket);
      queryRunner.manager.find.mockResolvedValue([yesToken, noToken]);

      const bidAskMessage = {
        event_type: 'best_bid_ask',
        market: 'condition-123',
        asset_id: 'token-123',
        best_bid: '0.65',
        best_ask: '0.70',
        spread: '0.05',
        timestamp: '2024-01-01T00:00:00Z',
      };

      service.onModuleInit();
      const messageHandler = (wsService.setMessageHandler as jest.Mock).mock.calls[0][0];
      await messageHandler(bidAskMessage);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(tokenRepository.findByTokenId).toHaveBeenCalledWith('token-123');
    });

    it('should skip if token not found', async () => {
      tokenRepository.findByTokenId.mockResolvedValue(null);

      const bidAskMessage = {
        event_type: 'best_bid_ask',
        market: 'condition-123',
        asset_id: 'unknown-token',
        best_bid: '0.65',
        best_ask: '0.70',
        spread: '0.05',
        timestamp: '2024-01-01T00:00:00Z',
      };

      service.onModuleInit();
      const messageHandler = (wsService.setMessageHandler as jest.Mock).mock.calls[0][0];
      await messageHandler(bidAskMessage);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(queryRunner.connect).not.toHaveBeenCalled();
    });
  });

  describe('handleNewMarketMessage', () => {
    it('should sync new market if not found in database', async () => {
      marketRepository.findOneBy.mockResolvedValue(null);
      eventRepository.findByExternalId.mockResolvedValue({ id: 1 } as any);
      marketProvider.getEvents.mockResolvedValue([{ id: 'event-123' }]);
      marketProvider.getMarkets.mockResolvedValue([
        {
          conditionId: 'new-condition-123',
          question: 'Test question?',
        },
      ]);
      syncService.syncMarket.mockResolvedValue({ created: true } as any);

      const newMarketMessage = {
        event_type: 'new_market',
        id: 'new-market-123',
        question: 'Test question?',
        market: 'new-condition-123',
        slug: 'test-market',
        description: 'Test description',
        assets_ids: ['token-new-1', 'token-new-2'],
        outcomes: ['YES', 'NO'],
        timestamp: '2024-01-01T00:00:00Z',
      };

      service.onModuleInit();
      const messageHandler = (wsService.setMessageHandler as jest.Mock).mock.calls[0][0];
      await messageHandler(newMarketMessage);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('New market detected'));
      expect(wsService.subscribeToTokenIds).toHaveBeenCalledWith(['token-new-1', 'token-new-2']);
    });

    it('should subscribe to tokens if market exists', async () => {
      marketRepository.findOneBy.mockResolvedValue(mockMarket);

      const newMarketMessage = {
        event_type: 'new_market',
        id: 'market-123',
        question: 'Test question?',
        market: 'condition-123',
        slug: 'test-market',
        description: 'Test description',
        assets_ids: ['token-1', 'token-2'],
        outcomes: ['YES', 'NO'],
        timestamp: '2024-01-01T00:00:00Z',
      };

      service.onModuleInit();
      const messageHandler = (wsService.setMessageHandler as jest.Mock).mock.calls[0][0];
      await messageHandler(newMarketMessage);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(wsService.subscribeToTokenIds).toHaveBeenCalledWith(['token-1', 'token-2']);
    });
  });

  describe('handleMarketResolvedMessage', () => {
    it('should mark market as closed and unsubscribe from tokens', async () => {
      const tokens = [
        { ...mockToken, tokenId: 'token-1' },
        { ...mockToken, tokenId: 'token-2' },
      ];

      const cleanMarket = {
        ...mockMarket,
        metadata: {},
      };

      queryRunner.manager.findOne.mockResolvedValue(cleanMarket);
      tokenRepository.findByMarketId.mockResolvedValue(tokens);

      const resolvedMessage = {
        event_type: 'market_resolved',
        id: 'market-123',
        question: 'Test question?',
        market: 'condition-123',
        winning_asset_id: 'token-1',
        winning_outcome: 'YES',
        timestamp: '2024-01-01T00:00:00Z',
      };

      service.onModuleInit();
      const messageHandler = (wsService.setMessageHandler as jest.Mock).mock.calls[0][0];
      await messageHandler(resolvedMessage);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(queryRunner.manager.update).toHaveBeenCalledWith(Market, 1, {
        closed: true,
        metadata: {
          winningAssetId: 'token-1',
          winningOutcome: 'YES',
          resolvedAt: '2024-01-01T00:00:00Z',
        },
      });
      expect(wsService.unsubscribeFromTokenIds).toHaveBeenCalledWith(['token-1', 'token-2']);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback if market not found', async () => {
      queryRunner.manager.findOne.mockResolvedValue(null);

      const resolvedMessage = {
        event_type: 'market_resolved',
        id: 'unknown-market',
        question: 'Test question?',
        market: 'unknown-condition',
        winning_asset_id: 'token-1',
        winning_outcome: 'YES',
        timestamp: '2024-01-01T00:00:00Z',
      };

      service.onModuleInit();
      const messageHandler = (wsService.setMessageHandler as jest.Mock).mock.calls[0][0];
      await messageHandler(resolvedMessage);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Market unknown-condition not found'),
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('handleTickSizeChange', () => {
    it('should log debug message for tick size change', async () => {
      const tickSizeMessage = {
        event_type: 'tick_size_change',
        market: 'condition-123',
      };

      service.onModuleInit();
      const messageHandler = (wsService.setMessageHandler as jest.Mock).mock.calls[0][0];
      await messageHandler(tickSizeMessage);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Tick size change message received (not processed)',
      );
    });
  });

  describe('handleUnknownMessage', () => {
    it('should log unknown event types', async () => {
      const unknownMessage = {
        event_type: 'unknown_event_type',
        data: 'test',
      };

      service.onModuleInit();
      const messageHandler = (wsService.setMessageHandler as jest.Mock).mock.calls[0][0];
      await messageHandler(unknownMessage);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Unknown event_type: unknown_event_type'),
      );
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      tokenRepository.findByTokenId.mockRejectedValue(new Error('Database error'));

      const bookMessage = {
        event_type: 'book',
        asset_id: 'token-123',
        market: 'condition-123',
        bids: [],
        asks: [],
        timestamp: '2024-01-01T00:00:00Z',
        hash: 'hash123',
      };

      service.onModuleInit();
      const messageHandler = (wsService.setMessageHandler as jest.Mock).mock.calls[0][0];
      await messageHandler(bookMessage);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error handling message'),
      );
    });
  });
});
