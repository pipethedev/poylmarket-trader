import { Injectable, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MarketRepository, TokenRepository, EventRepository } from '@database/repositories/index';
import { Market } from '@database/entities/market.entity';
import { Token, TokenOutcome } from '@database/entities/token.entity';
import { AppLogger, LogPrefix } from '@common/logger/index';
import { PolymarketWebSocketService } from './polymarket-websocket.service';
import { MARKET_PROVIDER, IMarketProvider } from '@providers/market-provider.interface';
import { SyncService } from '@modules/sync/sync.service';

interface WebSocketMessage {
  event_type: string;
  [key: string]: unknown;
}

interface PriceChange {
  asset_id: string;
  price: string;
  size: string;
  side: 'BUY' | 'SELL';
  hash: string;
  best_bid: string;
  best_ask: string;
}

interface BookMessage {
  event_type: 'book';
  asset_id: string;
  market: string;
  timestamp: string;
  hash: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
}

interface PriceChangeMessage {
  event_type: 'price_change';
  market: string;
  price_changes: PriceChange[];
  timestamp: string;
}

interface LastTradePriceMessage {
  event_type: 'last_trade_price';
  asset_id: string;
  market: string;
  price: string;
  side: 'BUY' | 'SELL';
  size: string;
  timestamp: string;
}

interface BestBidAskMessage {
  event_type: 'best_bid_ask';
  market: string;
  asset_id: string;
  best_bid: string;
  best_ask: string;
  spread: string;
  timestamp: string;
}

interface NewMarketMessage {
  event_type: 'new_market';
  id: string;
  question: string;
  market: string;
  slug: string;
  description: string;
  assets_ids: string[];
  outcomes: string[];
  timestamp: string;
}

interface MarketResolvedMessage {
  event_type: 'market_resolved';
  id: string;
  question: string;
  market: string;
  winning_asset_id: string;
  winning_outcome: string;
  timestamp: string;
}

@Injectable()
export class MarketUpdateHandlerService implements OnModuleInit {
  private readonly logger: AppLogger;

  constructor(
    private readonly wsService: PolymarketWebSocketService,
    private readonly marketRepository: MarketRepository,
    private readonly tokenRepository: TokenRepository,
    private readonly eventRepository: EventRepository,
    private readonly dataSource: DataSource,
    @Inject(MARKET_PROVIDER)
    @Optional()
    private readonly marketProvider?: IMarketProvider,
    @Optional()
    private readonly syncService?: SyncService,
    logger?: AppLogger,
  ) {
    this.logger = (logger || new AppLogger())
      .setPrefix(LogPrefix.PROVIDER)
      .setContext(MarketUpdateHandlerService.name);
  }

  onModuleInit(): void {
    this.wsService.setMessageHandler((message) => {
      void this.handleMessage(message);
    });
  }

  private async handleMessage(message: WebSocketMessage): Promise<void> {
    try {
      switch (message.event_type) {
        case 'book':
          await this.handleBookMessage(message as unknown as BookMessage);
          break;
        case 'price_change':
          await this.handlePriceChangeMessage(message as unknown as PriceChangeMessage);
          break;
        case 'last_trade_price':
          await this.handleLastTradePriceMessage(message as unknown as LastTradePriceMessage);
          break;
        case 'best_bid_ask':
          await this.handleBestBidAskMessage(message as unknown as BestBidAskMessage);
          break;
        case 'new_market':
          await this.handleNewMarketMessage(message as unknown as NewMarketMessage);
          break;
        case 'market_resolved':
          await this.handleMarketResolvedMessage(message as unknown as MarketResolvedMessage);
          break;
        case 'tick_size_change':
          this.logger.debug('Tick size change message received (not processed)');
          break;
        default:
          this.logger.debug(`Unknown event_type: ${message.event_type}`);
      }
    } catch (error) {
      this.logger.error(
        `Error handling message (event_type=${message.event_type}): ${(error as Error).message}`,
      );
    }
  }

  private async handleBookMessage(message: BookMessage): Promise<void> {
    const token = await this.tokenRepository.findByTokenId(message.asset_id);
    if (!token) {
      this.logger.debug(`Token not found for asset_id: ${message.asset_id}`);
      return;
    }

    const bestBid = message.bids.length > 0 ? parseFloat(message.bids[0].price) : 0;
    const bestAsk = message.asks.length > 0 ? parseFloat(message.asks[0].price) : 0;

    if (bestBid > 0 || bestAsk > 0) {
      await this.updateMarketPrices(token.marketId, bestBid, bestAsk);
    }
  }

  private async handlePriceChangeMessage(message: PriceChangeMessage): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      for (const priceChange of message.price_changes) {
        const token = await this.tokenRepository.findByTokenId(priceChange.asset_id);
        if (!token) {
          continue;
        }

        const bestBid = parseFloat(priceChange.best_bid) || 0;
        const bestAsk = parseFloat(priceChange.best_ask) || 0;

        if (bestBid > 0 || bestAsk > 0) {
          await this.updateMarketPrices(token.marketId, bestBid, bestAsk);
        }
      }
    } finally {
      await queryRunner.release();
    }
  }

  private async handleLastTradePriceMessage(message: LastTradePriceMessage): Promise<void> {
    const token = await this.tokenRepository.findByTokenId(message.asset_id);
    if (!token) {
      return;
    }

    const market = await this.marketRepository.findOneBy({ id: token.marketId });
    if (market) {
      const metadata = market.metadata || {};
      metadata.lastTradePrice = message.price;
      metadata.lastTradeSize = message.size;
      metadata.lastTradeSide = message.side;
      metadata.lastTradeTimestamp = message.timestamp;

      await this.marketRepository.update(market.id, { metadata });
    }
  }

  private async handleBestBidAskMessage(message: BestBidAskMessage): Promise<void> {
    const token = await this.tokenRepository.findByTokenId(message.asset_id);
    if (!token) {
      return;
    }

    const bestBid = parseFloat(message.best_bid) || 0;
    const bestAsk = parseFloat(message.best_ask) || 0;

    if (bestBid > 0 || bestAsk > 0) {
      await this.updateMarketPrices(token.marketId, bestBid, bestAsk);
    }
  }

  private async handleNewMarketMessage(message: NewMarketMessage): Promise<void> {
    this.logger.log(`New market detected: ${message.market} - ${message.question}`);

    const existingMarket = await this.marketRepository.findOneBy({ conditionId: message.market });

    if (!existingMarket) {
      this.logger.log(
        `New market ${message.market} not found in database. Attempting to fetch and save...`,
      );

      if (this.marketProvider && this.syncService) {
        try {
          this.logger.log(`Searching for parent event containing market ${message.market}...`);
          const providerEvents = await this.marketProvider.getEvents({ limit: 200 });

          let matchingMarket: any = null;
          let matchingEvent: any = null;

          for (const event of providerEvents) {
            const markets = await this.marketProvider.getMarkets(event.id);
            const market = markets.find((m) => m.conditionId === message.market);

            if (market) {
              matchingMarket = market;
              matchingEvent = event;
              break;
            }
          }

          if (matchingMarket && matchingEvent) {
            this.logger.log(
              `Found market ${message.market} in event ${matchingEvent.id}, syncing...`,
            );

            let event = await this.eventRepository.findByExternalId(matchingEvent.id);

            if (!event) {
              this.logger.log(`Parent event ${matchingEvent.id} not found in DB, syncing...`);
              const eventResult = await this.syncService.syncEvent(matchingEvent);
              event = eventResult.event;
              this.logger.log(`Synced parent event ${event.id} for new market`);
            }

            await this.syncService.syncMarket(matchingMarket, event.id);
            this.logger.log(`Successfully synced new market ${message.market}`);
          } else {
            this.logger.warn(`Market ${message.market} not found in provider API events`);
          }
        } catch (error) {
          this.logger.error(
            `Failed to sync new market ${message.market}: ${(error as Error).message}`,
          );
        }
      } else {
        this.logger.warn(
          `MarketProvider or SyncService not available, cannot auto-sync new market`,
        );
      }

      if (message.assets_ids && message.assets_ids.length > 0) {
        await this.wsService.subscribeToTokenIds(message.assets_ids);
      }
    } else {
      if (message.assets_ids && message.assets_ids.length > 0) {
        await this.wsService.subscribeToTokenIds(message.assets_ids);
      }
    }
  }

  private async handleMarketResolvedMessage(message: MarketResolvedMessage): Promise<void> {
    this.logger.log(`Market resolved: ${message.market} - Winning: ${message.winning_outcome}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const market = await queryRunner.manager.findOne(Market, {
        where: { conditionId: message.market },
        lock: { mode: 'pessimistic_write' },
      });

      if (!market) {
        this.logger.warn(`Market ${message.market} not found in database`);
        await queryRunner.rollbackTransaction();
        return;
      }

      await queryRunner.manager.update(Market, market.id, {
        closed: true,
        metadata: {
          ...(market.metadata || {}),
          winningAssetId: message.winning_asset_id,
          winningOutcome: message.winning_outcome,
          resolvedAt: message.timestamp,
        },
      });

      await queryRunner.commitTransaction();

      const tokens = await this.tokenRepository.findByMarketId(market.id);
      const tokenIds = tokens.map((token) => token.tokenId);
      if (tokenIds.length > 0) {
        await this.wsService.unsubscribeFromTokenIds(tokenIds);
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to handle market resolved message: ${(error as Error).message}`);
    } finally {
      await queryRunner.release();
    }
  }

  private async updateMarketPrices(
    marketId: number,
    bestBid: number,
    bestAsk: number,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const market = await queryRunner.manager.findOne(Market, {
        where: { id: marketId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!market) {
        await queryRunner.rollbackTransaction();
        return;
      }

      const tokens = await queryRunner.manager.find(Token, {
        where: { marketId },
        lock: { mode: 'pessimistic_write' },
      });

      const yesToken = tokens.find((t) => t.outcome === TokenOutcome.YES);
      const noToken = tokens.find((t) => t.outcome === TokenOutcome.NO);

      const yesPrice = bestAsk > 0 ? bestAsk.toFixed(8) : market.outcomeYesPrice;
      const noPrice = bestBid > 0 ? (1 - bestBid).toFixed(8) : market.outcomeNoPrice;

      await queryRunner.manager.update(Market, marketId, {
        outcomeYesPrice: yesPrice,
        outcomeNoPrice: noPrice,
      });

      if (yesToken) {
        await queryRunner.manager.update(Token, yesToken.id, { price: yesPrice });
      }
      if (noToken) {
        await queryRunner.manager.update(Token, noToken.id, { price: noPrice });
      }

      await queryRunner.commitTransaction();
      this.logger.debug(`Updated prices for market ${marketId}: YES=${yesPrice}, NO=${noPrice}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to update market prices: ${(error as Error).message}`);
    } finally {
      await queryRunner.release();
    }
  }
}
