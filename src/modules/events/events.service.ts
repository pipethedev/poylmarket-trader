import { Injectable } from '@nestjs/common';
import { EventRepository, MarketRepository } from '@database/repositories/index';
import { Event } from '@database/entities/event.entity';
import { Market } from '@database/entities/market.entity';
import { AppLogger, LogPrefix } from '@common/logger/index';
import { EventNotFoundException } from '@common/exceptions/index';
import { QueryEventsDto } from './dto/query-events.dto';
import {
  EventResponseDto,
  EventListResponseDto,
  EventDetailResponseDto,
  MarketSummaryDto,
} from './dto/event-response.dto';
import { SyncResult, SyncService } from '@modules/sync/sync.service';

export type { SyncResult };

@Injectable()
export class EventsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly eventRepository: EventRepository,
    private readonly marketRepository: MarketRepository,
    private readonly syncService: SyncService,
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
      size: query.pageSize ?? 20,
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

    this.logger.log(`Event found with ${markets.length} markets`);

    return {
      ...this.mapToResponse(event),
      markets: markets.map((market) => this.mapMarketToSummary(market)),
    };
  }

  async syncEvents(limit = 100): Promise<SyncResult> {
    this.logger.log(`Starting manual sync with limit: ${limit}`);
    return this.syncService.syncEvents(limit);
  }

  private mapToResponse(event: Event): EventResponseDto {
    return {
      id: event.id,
      polymarketId: event.polymarketId,
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
