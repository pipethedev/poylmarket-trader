import { Injectable, Inject, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MarketRepository, EventRepository } from '@database/repositories/index';
import { Event } from '@database/entities/event.entity';
import { Market } from '@database/entities/market.entity';
import { Token, TokenOutcome } from '@database/entities/token.entity';
import { MARKET_PROVIDER } from '@providers/market-provider.interface';
import { AppLogger, LogPrefix } from '@common/logger/index';
import { EventFactory, MarketFactory, TokenFactory } from '@common/factories/index';
import type { MarketProvider, ProviderEvent, ProviderMarket, SyncResult } from '@app-types/index';
import { PolymarketWebSocketService } from '@providers/polymarket/polymarket-websocket.service';

export type { SyncResult };

@Injectable()
export class SyncService {
  private readonly logger: AppLogger;

  constructor(
    @Inject(MARKET_PROVIDER)
    private readonly marketProvider: MarketProvider,
    private readonly marketRepository: MarketRepository,
    private readonly eventRepository: EventRepository,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @Optional()
    private readonly wsService?: PolymarketWebSocketService,
    logger?: AppLogger,
  ) {
    this.logger = (logger || new AppLogger())
      .setPrefix(LogPrefix.SYNC)
      .setContext(SyncService.name);
  }

  async syncEvents(limit = 100): Promise<SyncResult> {
    const result: SyncResult = {
      eventsCreated: 0,
      eventsUpdated: 0,
      marketsCreated: 0,
      marketsUpdated: 0,
      tokensCreated: 0,
      tokensUpdated: 0,
      errors: [],
    };

    try {
      this.logger.log(`Starting event sync (limit: ${limit})`);

      const syncDaysBack = this.configService.get<number>('scheduler.syncDaysBack') ?? 60;

      const dateThreshold = new Date();

      dateThreshold.setDate(dateThreshold.getDate() - syncDaysBack);

      const startDateMin = dateThreshold.toISOString();

      this.logger.log(`Filtering events from past ${syncDaysBack} days (since ${startDateMin})`);

      const providerEvents = await this.marketProvider.getEvents({
        limit,
        featured: true,
        startDateMin,
      });

      this.logger.log(`Fetched ${providerEvents.length} events from provider (past month)`);

      for (const providerEvent of providerEvents) {
        try {
          const eventResult = await this.syncEvent(providerEvent);
          if (eventResult.created) {
            result.eventsCreated++;
          } else {
            result.eventsUpdated++;
          }

          const marketsResult = await this.syncMarketsForEvent(
            providerEvent.id,
            eventResult.event.id,
          );
          result.marketsCreated += marketsResult.marketsCreated;
          result.marketsUpdated += marketsResult.marketsUpdated;
          result.tokensCreated += marketsResult.tokensCreated;
          result.tokensUpdated += marketsResult.tokensUpdated;
          result.errors.push(...marketsResult.errors);
        } catch (error) {
          const errorMsg = `Failed to sync event ${providerEvent.id}: ${(error as Error).message}`;
          this.logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      await this.updateAllEventStatuses();

      this.logger.log(
        `Sync completed - Events: ${result.eventsCreated} created, ${result.eventsUpdated} updated | Markets: ${result.marketsCreated} created, ${result.marketsUpdated} updated`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Event sync failed: ${(error as Error).message}`);
      result.errors.push(`Sync failed: ${(error as Error).message}`);
      return result;
    }
  }

  async syncEvent(providerEvent: ProviderEvent): Promise<{ event: Event; created: boolean }> {
    const providerName = this.marketProvider.getName();
    const eventLogger = this.logger.child({
      polymarketEventId: providerEvent.id,
      provider: providerName,
    });
    eventLogger.log('Syncing event');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let event: Event | null = await queryRunner.manager.findOne(Event, {
        where: { externalId: providerEvent.id, provider: providerName },
      });

      const created = !event;

      if (event) {
        EventFactory.update(event, providerEvent);
        eventLogger.log('Updating existing event');
      } else {
        event = queryRunner.manager.create(Event, EventFactory.create(providerEvent, providerName));
        eventLogger.log('Creating new event');
      }

      event = await queryRunner.manager.save(Event, event);
      await queryRunner.commitTransaction();

      return { event, created };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async syncMarketsForEvent(
    providerEventId: string,
    localEventId: number,
  ): Promise<Omit<SyncResult, 'eventsCreated' | 'eventsUpdated'>> {
    const result = {
      marketsCreated: 0,
      marketsUpdated: 0,
      tokensCreated: 0,
      tokensUpdated: 0,
      errors: [] as string[],
    };

    const eventLogger = this.logger.child({
      eventId: localEventId,
      polymarketEventId: providerEventId,
    });

    try {
      const providerMarkets = await this.marketProvider.getMarkets(providerEventId);
      eventLogger.log(`Syncing ${providerMarkets.length} markets`);

      for (const providerMarket of providerMarkets) {
        try {
          const marketResult = await this.syncMarket(providerMarket, localEventId);
          if (marketResult.created) {
            result.marketsCreated++;
          } else {
            result.marketsUpdated++;
          }
          result.tokensCreated += marketResult.tokensCreated;
          result.tokensUpdated += marketResult.tokensUpdated;
        } catch (error) {
          const errorMsg = `Failed to sync market ${providerMarket.id}: ${(error as Error).message}`;
          eventLogger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }
    } catch (error) {
      result.errors.push(
        `Failed to fetch markets for event ${providerEventId}: ${(error as Error).message}`,
      );
    }

    return result;
  }

  async syncMarket(
    providerMarket: ProviderMarket,
    localEventId: number,
  ): Promise<{
    market: Market;
    created: boolean;
    tokensCreated: number;
    tokensUpdated: number;
  }> {
    const providerName = this.marketProvider.getName();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let market: Market | null = await queryRunner.manager.findOne(Market, {
        where: { externalId: providerMarket.id, provider: providerName },
      });

      const created = !market;
      let tokensCreated = 0;
      let tokensUpdated = 0;

      if (market) {
        MarketFactory.update(market, providerMarket);
      } else {
        market = queryRunner.manager.create(
          Market,
          MarketFactory.create(providerMarket, localEventId, providerName),
        );
      }

      market = await queryRunner.manager.save(Market, market);

      const tokenIds: string[] = [];

      for (const providerToken of providerMarket.tokens) {
        let token: Token | null = await queryRunner.manager.findOne(Token, {
          where: { tokenId: providerToken.tokenId },
        });

        if (token) {
          TokenFactory.update(token, providerToken);
          tokensUpdated++;
        } else {
          token = queryRunner.manager.create(Token, TokenFactory.create(providerToken, market.id));
          tokensCreated++;
        }

        await queryRunner.manager.save(Token, token);
        tokenIds.push(token.tokenId);
      }

      await queryRunner.commitTransaction();

      if (created && tokenIds.length > 0 && this.wsService && market.active && !market.closed) {
        try {
          await this.wsService.subscribeToTokenIds(tokenIds);
          this.logger.log(`Subscribed to ${tokenIds.length} token IDs for market ${market.id}`);
        } catch (error) {
          this.logger.warn(
            `Failed to subscribe to token IDs for market ${market.id}: ${(error as Error).message}`,
          );
        }
      }

      await this.updateEventStatusIfAllMarketsClosed(localEventId);

      return { market, created, tokensCreated, tokensUpdated };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateMarketPrices(): Promise<{ updated: number; errors: string[] }> {
    const result = { updated: 0, errors: [] as string[] };

    this.logger.log('Updating market prices');

    try {
      const activeMarkets = await this.marketRepository.findActiveMarketsWithPriceInfo();

      for (const market of activeMarkets) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const lockedMarket = await queryRunner.manager.findOne(Market, {
            where: { id: market.id },
            lock: { mode: 'pessimistic_write' },
          });

          if (!lockedMarket) {
            await queryRunner.rollbackTransaction();
            continue;
          }

          const marketId = market.conditionId || market.externalId;
          const price = await this.marketProvider.getMarketPrice(marketId);

          if (!price) {
            await queryRunner.rollbackTransaction();
            continue;
          }

          const tokens = await queryRunner.manager.find(Token, {
            where: { marketId: market.id },
            lock: { mode: 'pessimistic_write' },
          });

          await queryRunner.manager.update(Market, market.id, {
            outcomeYesPrice: price.yesPrice,
            outcomeNoPrice: price.noPrice,
          });

          const yesToken = tokens.find((t) => t.outcome === TokenOutcome.YES);
          const noToken = tokens.find((t) => t.outcome === TokenOutcome.NO);

          if (yesToken) {
            await queryRunner.manager.update(Token, yesToken.id, { price: price.yesPrice });
          }
          if (noToken) {
            await queryRunner.manager.update(Token, noToken.id, { price: price.noPrice });
          }

          await queryRunner.commitTransaction();
          result.updated++;
        } catch (error) {
          await queryRunner.rollbackTransaction();
          result.errors.push(
            `Failed to update price for market ${market.id}: ${(error as Error).message}`,
          );
        } finally {
          await queryRunner.release();
        }
      }

      this.logger.log(`Price update completed - ${result.updated} markets updated`);
    } catch (error) {
      result.errors.push(`Price update failed: ${(error as Error).message}`);
    }

    return result;
  }

  private async updateEventStatusIfAllMarketsClosed(eventId: number): Promise<void> {
    try {
      const markets = await this.marketRepository.findByEventId(eventId);

      if (markets.length === 0) {
        return;
      }

      const hasActiveMarkets = markets.some((market) => market.active && !market.closed);
      const allMarketsClosed = markets.every((market) => market.closed);

      if (hasActiveMarkets) {
        const event = await this.eventRepository.findOneBy({ id: eventId });
        if (event && !event.active) {
          await this.eventRepository.update(eventId, { active: true });
          this.logger.log(
            `Marked event ${eventId} as active (has ${markets.filter((m) => m.active && !m.closed).length} active markets)`,
          );
        }
      } else if (allMarketsClosed) {
        await this.eventRepository.update(eventId, { active: false });
        this.logger.log(
          `Marked event ${eventId} as inactive (all ${markets.length} markets closed)`,
        );
      } else {
        const event = await this.eventRepository.findOneBy({ id: eventId });
        if (event && event.active) {
          await this.eventRepository.update(eventId, { active: false });
          this.logger.log(`Marked event ${eventId} as inactive (no active markets)`);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to update event status for event ${eventId}: ${(error as Error).message}`,
      );
    }
  }

  private async updateAllEventStatuses(): Promise<void> {
    try {
      this.logger.log('Updating event statuses based on market statuses');

      const allEvents = await this.eventRepository.findMany({});
      let updatedCount = 0;

      for (const event of allEvents) {
        const markets = await this.marketRepository.findByEventId(event.id);

        if (markets.length === 0) {
          continue;
        }

        const hasActiveMarkets = markets.some((market) => market.active && !market.closed);

        if (hasActiveMarkets && !event.active) {
          await this.eventRepository.update(event.id, { active: true });
          updatedCount++;
          this.logger.debug(`Marked event ${event.id} as active (has active markets)`);
        } else if (!hasActiveMarkets && event.active) {
          await this.eventRepository.update(event.id, { active: false });
          updatedCount++;
          this.logger.debug(`Marked event ${event.id} as inactive (no active markets)`);
        }
      }

      if (updatedCount > 0) {
        this.logger.log(`Updated status for ${updatedCount} events`);
      }
    } catch (error) {
      this.logger.warn(`Failed to update all event statuses: ${(error as Error).message}`);
    }
  }
}
