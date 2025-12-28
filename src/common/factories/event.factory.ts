import { Event } from '@database/entities/event.entity';
import { Market } from '@database/entities/market.entity';
import type { ProviderEvent } from '@app-types/index';
import { EventResponseDto, MarketSummaryDto } from '@modules/events/dto/event-response.dto';

export class EventFactory {
  static create(data: ProviderEvent, providerName: string): Partial<Event> {
    let featured = false;
    if (data.metadata?.featured !== undefined) {
      if (typeof data.metadata.featured === 'boolean') {
        featured = data.metadata.featured;
      } else if (typeof data.metadata.featured === 'string') {
        featured = data.metadata.featured === 'true' || data.metadata.featured === '1';
      } else if (typeof data.metadata.featured === 'number') {
        featured = data.metadata.featured === 1;
      }
    }

    return {
      externalId: data.id,
      provider: providerName,
      title: data.title,
      description: data.description ?? null,
      slug: data.slug ?? null,
      image: data.image ?? null,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      active: data.active,
      featured: featured,
      metadata: data.metadata ?? null,
    };
  }

  static update(entity: Event, data: ProviderEvent): Event {
    let featured = false;
    if (data.metadata?.featured !== undefined) {
      if (typeof data.metadata.featured === 'boolean') {
        featured = data.metadata.featured;
      } else if (typeof data.metadata.featured === 'string') {
        featured = data.metadata.featured === 'true' || data.metadata.featured === '1';
      } else if (typeof data.metadata.featured === 'number') {
        featured = data.metadata.featured === 1;
      }
    }

    entity.title = data.title;
    entity.description = data.description ?? null;
    entity.slug = data.slug ?? null;
    if (data.image !== undefined) {
      entity.image = data.image ?? null;
    }
    entity.startDate = data.startDate ?? null;
    entity.endDate = data.endDate ?? null;
    entity.active = data.active;
    entity.featured = featured;
    entity.metadata = data.metadata ?? null;
    return entity;
  }

  static toResponse(event: Event): EventResponseDto {
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

  static mapMarketToSummary(market: Market): MarketSummaryDto {
    return {
      id: market.id,
      question: market.question,
      outcomeYesPrice: market.outcomeYesPrice,
      outcomeNoPrice: market.outcomeNoPrice,
      active: market.active,
    };
  }
}
