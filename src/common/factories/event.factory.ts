import { Event } from '@database/entities/event.entity';
import type { ProviderEvent } from '@app-types/index';

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
}
