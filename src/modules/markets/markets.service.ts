import { Injectable, Inject, Optional } from '@nestjs/common';
import { MarketRepository, TokenRepository, EventRepository } from '@database/repositories/index';
import { Market } from '@database/entities/market.entity';
import { Token } from '@database/entities/token.entity';
import { AppLogger, LogPrefix } from '@common/logger/index';
import { MarketNotFoundException } from '@common/exceptions/index';
import { QueryMarketsDto } from './dto/query-markets.dto';
import {
  MarketResponseDto,
  MarketListResponseDto,
  MarketDetailResponseDto,
  TokenResponseDto,
} from './dto/market-response.dto';
import { MARKET_PROVIDER } from '@providers/market-provider.interface';
import type { MarketProvider } from '@app-types/index';
import { SyncService } from '@modules/sync/sync.service';

@Injectable()
export class MarketsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly marketRepository: MarketRepository,
    private readonly tokenRepository: TokenRepository,
    private readonly eventRepository: EventRepository,
    @Inject(MARKET_PROVIDER)
    @Optional()
    private readonly marketProvider?: MarketProvider,
    @Optional()
    private readonly syncService?: SyncService,
    logger?: AppLogger,
  ) {
    this.logger = (logger || new AppLogger()).setPrefix(LogPrefix.API).setContext(MarketsService.name);
  }

  async getMarkets(query: QueryMarketsDto): Promise<MarketListResponseDto> {
    this.logger.log('Fetching markets list', {
      active: query.active,
      closed: query.closed,
      closedType: typeof query.closed,
    });

    const qb = this.marketRepository.createQueryBuilder('market');

    if (query.eventId) {
      qb.andWhere('market.event_id = :eventId', { eventId: query.eventId });
    }

    if (query.active !== undefined) {
      qb.andWhere('market.active = :active', { active: query.active });
    }

    if (query.closed !== undefined) {
      this.logger.debug(`Applying closed filter: ${query.closed} (type: ${typeof query.closed})`);
      qb.andWhere('market.closed = :closed', { closed: query.closed });
    }

    if (query.search) {
      qb.andWhere('market.question ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    if (query.volumeMin !== undefined) {
      qb.andWhere('market.volume >= :volumeMin', { volumeMin: query.volumeMin.toString() });
    }

    if (query.volumeMax !== undefined) {
      qb.andWhere('market.volume <= :volumeMax', { volumeMax: query.volumeMax.toString() });
    }

    if (query.liquidityMin !== undefined) {
      qb.andWhere('market.liquidity >= :liquidityMin', {
        liquidityMin: query.liquidityMin.toString(),
      });
    }

    if (query.liquidityMax !== undefined) {
      qb.andWhere('market.liquidity <= :liquidityMax', {
        liquidityMax: query.liquidityMax.toString(),
      });
    }

    if (query.createdAtMin) {
      qb.andWhere('market.created_at >= :createdAtMin', { createdAtMin: query.createdAtMin });
    }

    if (query.createdAtMax) {
      qb.andWhere('market.created_at <= :createdAtMax', { createdAtMax: query.createdAtMax });
    }

    if (query.updatedAtMin) {
      qb.andWhere('market.updated_at >= :updatedAtMin', { updatedAtMin: query.updatedAtMin });
    }

    if (query.updatedAtMax) {
      qb.andWhere('market.updated_at <= :updatedAtMax', { updatedAtMax: query.updatedAtMax });
    }

    qb.orderBy('market.active', 'DESC');
    qb.addOrderBy('market.closed', 'ASC');
    qb.addOrderBy('market.updatedAt', 'DESC');

    const result = await this.marketRepository.paginate(qb, {
      page: query.page ?? 1,
      size: query.limit ?? query.pageSize ?? 20,
    });

    this.logger.log(`Found ${result.meta.total} markets in database`);

    if (result.meta.total === 0 && query.search && this.marketProvider && this.syncService) {
      this.logger.log(`No markets found in database for search "${query.search}", attempting API fallback`);

      try {
        const providerMarkets = await this.marketProvider.getAllMarkets({
          limit: 200,
          active: query.active,
        });

        let matchingMarkets = providerMarkets.filter((market) =>
          market.question.toLowerCase().includes(query.search!.toLowerCase()),
        );

        if (query.closed !== undefined) {
          matchingMarkets = matchingMarkets.filter((market) => market.closed === query.closed);
        }

        if (matchingMarkets.length > 0) {
          this.logger.log(`Found ${matchingMarkets.length} matching markets from API, syncing...`);

          for (const providerMarket of matchingMarkets) {
            try {
              let event = await this.eventRepository.findByExternalId(providerMarket.eventId);

              if (!event && this.marketProvider) {
                try {
                  const providerEvents = await this.marketProvider.getEvents({ limit: 200 });
                  const matchingEvent = providerEvents.find((e) => e.id === providerMarket.eventId);

                  if (matchingEvent) {
                    const eventResult = await this.syncService.syncEvent(matchingEvent);
                    event = eventResult.event;
                    await this.syncService.syncMarketsForEvent(providerMarket.eventId, event.id);
                  } else {
                    this.logger.warn(
                      `Event ${providerMarket.eventId} not found in API results, skipping market ${providerMarket.id}`,
                    );
                    continue;
                  }
                } catch (error) {
                  this.logger.warn(
                    `Failed to fetch event ${providerMarket.eventId} from API: ${(error as Error).message}`,
                  );
                  continue;
                }
              } else if (event) {
                await this.syncService.syncMarket(providerMarket, event.id);
              }
            } catch (error) {
              this.logger.warn(`Failed to sync market ${providerMarket.id} from API: ${(error as Error).message}`);
            }
          }

          const retryResult = await this.marketRepository.paginate(qb, {
            page: query.page ?? 1,
            size: query.limit ?? query.pageSize ?? 20,
          });

          const retryMarketIds = retryResult.data.map((m) => m.id);
          const retryTokensByMarket = await this.tokenRepository.findByMarketIds(retryMarketIds);
          const retryTokensMap = new Map<number, Token[]>();

          retryTokensByMarket.forEach((token) => {
            const existing = retryTokensMap.get(token.marketId) || [];
            existing.push(token);
            retryTokensMap.set(token.marketId, existing);
          });

          this.logger.log(`After API sync, found ${retryResult.meta.total} markets`);

          return {
            data: retryResult.data.map((market) => ({
              ...this.mapToResponse(market),
              tokens: (retryTokensMap.get(market.id) || []).map((token) => this.mapTokenToResponse(token)),
            })),
            meta: retryResult.meta,
          };
        }
      } catch (error) {
        this.logger.warn(`API fallback failed: ${(error as Error).message}`);
      }
    }

    const marketIds = result.data.map((m) => m.id);

    const tokensByMarket = await this.tokenRepository.findByMarketIds(marketIds);

    const tokensMap = new Map<number, Token[]>();

    tokensByMarket.forEach((token) => {
      const existing = tokensMap.get(token.marketId) || [];
      existing.push(token);
      tokensMap.set(token.marketId, existing);
    });

    return {
      data: result.data.map((market) => ({
        ...this.mapToResponse(market),
        tokens: (tokensMap.get(market.id) || []).map((token) => this.mapTokenToResponse(token)),
      })),
      meta: result.meta,
    };
  }

  async getMarket(id: number): Promise<MarketDetailResponseDto> {
    this.logger.setContextData({ marketId: id }).log('Fetching market details');

    const market = await this.marketRepository.findById(id);

    if (!market) {
      this.logger.warn('Market not found');
      throw new MarketNotFoundException(String(id));
    }

    const [tokens, event] = await Promise.all([
      this.tokenRepository.findByMarketId(id),
      this.eventRepository.findById(market.eventId),
    ]);

    this.logger.log(`Market found with ${tokens.length} tokens`);

    const response: MarketDetailResponseDto = {
      ...this.mapToResponse(market),
      tokens: tokens.map((token) => this.mapTokenToResponse(token)),
      eventTitle: event?.title,
    };

    if (event) {
      response.event = {
        id: event.id,
        title: event.title,
        slug: event.slug,
        description: event.description,
        active: event.active,
        startDate: event.startDate,
        endDate: event.endDate,
      };
    }

    return response;
  }

  async getMarketByExternalId(externalId: string, provider = 'polymarket'): Promise<MarketDetailResponseDto> {
    this.logger.setContextData({ externalId, provider }).log('Fetching market by external ID');

    const market = await this.marketRepository.findByExternalId(externalId, provider);

    if (!market) {
      this.logger.warn('Market not found');
      throw new MarketNotFoundException(externalId);
    }

    return this.getMarket(market.id);
  }

  private mapToResponse(market: Market): MarketResponseDto {
    return {
      id: market.id,
      externalId: market.externalId,
      conditionId: market.conditionId,
      eventId: market.eventId,
      question: market.question,
      description: market.description,
      image: market.image,
      outcomeYesPrice: market.outcomeYesPrice,
      outcomeNoPrice: market.outcomeNoPrice,
      volume: market.volume,
      liquidity: market.liquidity,
      active: market.active,
      closed: market.closed,
      createdAt: market.createdAt,
      updatedAt: market.updatedAt,
    };
  }

  private mapTokenToResponse(token: Token): TokenResponseDto {
    return {
      id: token.id,
      tokenId: token.tokenId,
      outcome: token.outcome,
      price: token.price,
    };
  }
}
