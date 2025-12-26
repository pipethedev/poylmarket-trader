import { Injectable } from '@nestjs/common';
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

@Injectable()
export class EventsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly eventRepository: EventRepository,
    private readonly marketRepository: MarketRepository,
    private readonly tokenRepository: TokenRepository,
    @InjectQueue('sync')
    private readonly syncQueue: Queue<SyncJobData>,
    logger: AppLogger,
  ) {
    this.logger = logger.setPrefix(LogPrefix.API).setContext(EventsService.name);
  }

  async getEvents(query: QueryEventsDto): Promise<EventListResponseDto> {
    this.logger.log('Fetching events list');

    const qb = this.eventRepository.createQueryBuilder('event');

    if (query.active !== undefined) {
      qb.andWhere('event.active = :active', { active: query.active });
    }

    if (query.search) {
      qb.andWhere('event.title ILIKE :search', { search: `%${query.search}%` });
    }

    qb.orderBy('event.updatedAt', 'DESC');

    const result = await this.eventRepository.paginate(qb, {
      page: query.page ?? 1,
      size: query.limit ?? query.pageSize ?? 20,
    });

    const eventIds = result.data.map((e) => e.id);
    const marketCounts = await this.marketRepository.getMarketCountsByEventIds(eventIds);

    this.logger.log(`Found ${result.meta.total} events`);

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
      markets: await Promise.all(
        markets.map((market) => {
          const summary = this.mapMarketToSummary(market);
          summary.tokens = (tokensMap.get(market.id) || []).map((token) => ({
            id: token.id,
            tokenId: token.tokenId,
            outcome: token.outcome,
            price: token.price,
          }));
          return summary;
        }),
      ),
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

  async syncEvents(limit = 100): Promise<{ jobId: string; message: string; syncedEvents: number; syncedMarkets: number }> {
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
      jobId: job.id!,
      message: 'Sync job has been queued and will be processed in the background',
      syncedEvents: 0,
      syncedMarkets: 0,
    };
  }

  private mapToResponse(event: Event): EventResponseDto {
    return {
      id: event.id,
      externalId: event.externalId,
      title: event.title,
      description: event.description,
      slug: event.slug,
      startDate: event.startDate,
      endDate: event.endDate,
      active: event.active,
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
