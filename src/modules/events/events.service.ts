import { Injectable, Inject, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventRepository, MarketRepository, TokenRepository } from '@database/repositories/index';
import { Event } from '@database/entities/event.entity';
import { Market } from '@database/entities/market.entity';
import { Token } from '@database/entities/token.entity';
import { AppLogger, LogPrefix } from '@common/logger/index';
import { EventNotFoundException } from '@common/exceptions/index';
import { QueryEventsDto } from './dto/query-events.dto';
import {
  EventResponseDto,
  EventListResponseDto,
  EventDetailResponseDto,
  MarketSummaryDto,
} from './dto/event-response.dto';
import type { SyncJobData } from '@modules/sync/sync.processor';
import { MARKET_PROVIDER } from '@providers/market-provider.interface';
import type { MarketProvider } from '@app-types/index';
import { SyncService } from '@modules/sync/sync.service';

@Injectable()
export class EventsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly eventRepository: EventRepository,
    private readonly marketRepository: MarketRepository,
    private readonly tokenRepository: TokenRepository,
    @InjectQueue('sync')
    private readonly syncQueue: Queue<SyncJobData>,
    @Inject(MARKET_PROVIDER)
    @Optional()
    private readonly marketProvider?: MarketProvider,
    @Optional()
    private readonly syncService?: SyncService,
    logger?: AppLogger,
  ) {
    this.logger = (logger || new AppLogger())
      .setPrefix(LogPrefix.API)
      .setContext(EventsService.name);
  }

  async getEvents(query: QueryEventsDto): Promise<EventListResponseDto> {
    this.logger.log('Fetching events list');

    const qb = this.eventRepository.createQueryBuilder('event');

    if (query.active !== undefined) {
      qb.andWhere('event.active = :active', { active: query.active });
    }

    if (query.featured !== undefined) {
      qb.andWhere('event.featured = :featured', { featured: query.featured });
    }

    if (query.search) {
      qb.andWhere('event.title ILIKE :search', { search: `%${query.search}%` });
    }

    qb.orderBy('event.active', 'DESC');
    qb.addOrderBy('event.updatedAt', 'DESC');

    const result = await this.eventRepository.paginate(qb, {
      page: query.page ?? 1,
      size: query.limit ?? query.pageSize ?? 20,
    });

    const eventIds = result.data.map((e) => e.id);
    const marketCounts = await this.marketRepository.getMarketCountsByEventIds(eventIds);

    this.logger.log(`Found ${result.meta.total} events in database`);

    if (result.meta.total === 0 && query.search && this.marketProvider && this.syncService) {
      this.logger.log(
        `No events found in database for search "${query.search}", attempting API fallback`,
      );

      try {
        const providerEvents = await this.marketProvider.getEvents({
          limit: 100,
          active: query.active,
        });

        let matchingEvents = providerEvents.filter((event) =>
          event.title.toLowerCase().includes(query.search!.toLowerCase()),
        );

        if (query.featured !== undefined) {
          matchingEvents = matchingEvents.filter((event) => {
            const isFeatured = (event.metadata as any)?.featured === true;
            return query.featured ? isFeatured : !isFeatured;
          });
        }

        if (matchingEvents.length > 0) {
          this.logger.log(`Found ${matchingEvents.length} matching events from API, syncing...`);

          for (const providerEvent of matchingEvents) {
            try {
              const eventResult = await this.syncService.syncEvent(providerEvent);
              await this.syncService.syncMarketsForEvent(providerEvent.id, eventResult.event.id);
            } catch (error) {
              this.logger.warn(
                `Failed to sync event ${providerEvent.id} from API: ${(error as Error).message}`,
              );
            }
          }

          const retryResult = await this.eventRepository.paginate(qb, {
            page: query.page ?? 1,
            size: query.limit ?? query.pageSize ?? 20,
          });

          const retryEventIds = retryResult.data.map((e) => e.id);
          const retryMarketCounts =
            await this.marketRepository.getMarketCountsByEventIds(retryEventIds);

          this.logger.log(`After API sync, found ${retryResult.meta.total} events`);

          return {
            data: retryResult.data.map((event) => ({
              ...this.mapToResponse(event),
              marketCount: retryMarketCounts[event.id] || 0,
            })),
            meta: retryResult.meta,
          };
        }
      } catch (error) {
        this.logger.warn(`API fallback failed: ${(error as Error).message}`);
      }
    }

    return {
      data: result.data.map((event) => ({
        ...this.mapToResponse(event),
        marketCount: marketCounts[event.id] || 0,
      })),
      meta: result.meta,
    };
  }

  async getEvent(id: number): Promise<EventDetailResponseDto> {
    this.logger.setContextData({ eventId: id }).log('Fetching event details');

    const event = await this.eventRepository.findById(id);

    if (!event) {
      this.logger.warn('Event not found');
      throw new EventNotFoundException(String(id));
    }

    const markets = await this.marketRepository.findMany({
      where: { eventId: id },
      order: { updatedAt: 'DESC' },
    });

    const marketIds = markets.map((m) => m.id);
    const tokensByMarket = await this.tokenRepository.findByMarketIds(marketIds);
    const tokensMap = new Map<number, Token[]>();
    for (const token of tokensByMarket) {
      const existing = tokensMap.get(token.marketId) || [];
      existing.push(token);
      tokensMap.set(token.marketId, existing);
    }

    this.logger.log(`Event found with ${markets.length} markets`);

    return {
      ...this.mapToResponse(event),
      markets: markets.map((market) => {
        const summary = this.mapMarketToSummary(market);
        summary.tokens = (tokensMap.get(market.id) || []).map((token) => ({
          id: token.id,
          tokenId: token.tokenId,
          outcome: token.outcome,
          price: token.price,
        }));
        return summary;
      }),
    };
  }

  async getEventMarkets(eventId: number): Promise<MarketSummaryDto[]> {
    this.logger.setContextData({ eventId }).log('Fetching markets for event');

    const event = await this.eventRepository.findById(eventId);

    if (!event) {
      this.logger.warn('Event not found');
      throw new EventNotFoundException(String(eventId));
    }

    const markets = await this.marketRepository.findMany({
      where: { eventId },
      order: { updatedAt: 'DESC' },
    });

    this.logger.log(`Found ${markets.length} markets for event`);

    return markets.map((market) => this.mapMarketToSummary(market));
  }

  async syncEvents(limit = 100): Promise<{ message: string }> {
    this.logger.log(`Queuing sync job with limit: ${limit}`);

    const job = await this.syncQueue.add(
      'sync-events',
      { limit },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        removeOnFail: false,
      },
    );

    this.logger.log(`Sync job queued with ID: ${job.id}`);

    return {
      message: 'Sync job has been queued and will be processed in the background',
    };
  }

  private mapToResponse(event: Event): EventResponseDto {
    return {
      id: event.id,
      externalId: event.externalId,
      title: event.title,
      description: event.description,
      slug: event.slug,
      image: event.image,
      startDate: event.startDate,
      endDate: event.endDate,
      active: event.active,
      featured: event.featured,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  private mapMarketToSummary(market: Market): MarketSummaryDto {
    return {
      id: market.id,
      question: market.question,
      outcomeYesPrice: market.outcomeYesPrice,
      outcomeNoPrice: market.outcomeNoPrice,
      active: market.active,
    };
  }
}
