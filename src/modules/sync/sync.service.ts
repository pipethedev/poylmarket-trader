import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MarketRepository, TokenRepository } from '@database/repositories/index';
import { Event } from '@database/entities/event.entity';
import { Market } from '@database/entities/market.entity';
import { Token, TokenOutcome } from '@database/entities/token.entity';
import { MARKET_PROVIDER } from '@providers/market-provider.interface';
import { AppLogger, LogPrefix } from '@common/logger/index';
import { EventFactory, MarketFactory, TokenFactory } from '@common/factories/index';
import type { MarketProvider, ProviderEvent, ProviderMarket, SyncResult } from '@app-types/index';

export type { SyncResult };

@Injectable()
export class SyncService {
  private readonly logger: AppLogger;

  constructor(
    @Inject(MARKET_PROVIDER)
    private readonly marketProvider: MarketProvider,
    private readonly marketRepository: MarketRepository,
    private readonly tokenRepository: TokenRepository,
    private readonly dataSource: DataSource,
    logger: AppLogger,
  ) {
    this.logger = logger.setPrefix(LogPrefix.SYNC).setContext(SyncService.name);
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

      const providerEvents = await this.marketProvider.getEvents({
        limit,
        active: true,
      });
      this.logger.log(`Fetched ${providerEvents.length} events from provider`);

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
      }

      await queryRunner.commitTransaction();

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
        try {
          const marketId = market.conditionId || market.externalId;
          const price = await this.marketProvider.getMarketPrice(marketId);

          if (!price) {
            continue;
          }

          await Promise.all([
            this.marketRepository.update(market.id, {
              outcomeYesPrice: price.yesPrice,
              outcomeNoPrice: price.noPrice,
            }),
            this.tokenRepository.updatePriceByMarketIdAndOutcome(
              market.id,
              TokenOutcome.YES,
              price.yesPrice,
            ),
            this.tokenRepository.updatePriceByMarketIdAndOutcome(
              market.id,
              TokenOutcome.NO,
              price.noPrice,
            ),
          ]);

          result.updated++;
        } catch (error) {
          result.errors.push(
            `Failed to update price for market ${market.id}: ${(error as Error).message}`,
          );
        }
      }

      this.logger.log(`Price update completed - ${result.updated} markets updated`);
    } catch (error) {
      result.errors.push(`Price update failed: ${(error as Error).message}`);
    }

    return result;
  }
}
