import { Event } from '@database/entities/event.entity';
import type { ProviderEvent } from '@app-types/index';

export class EventFactory {
  static create(data: ProviderEvent): Partial<Event> {
    return {
      polymarketId: data.id,
      title: data.title,
      description: data.description ?? null,
      slug: data.slug ?? null,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      active: data.active,
      metadata: data.metadata ?? null,
    };
  }

  static update(entity: Event, data: ProviderEvent): Event {
    entity.title = data.title;
    entity.description = data.description ?? null;
    entity.slug = data.slug ?? null;
    entity.startDate = data.startDate ?? null;
    entity.endDate = data.endDate ?? null;
    entity.active = data.active;
    entity.metadata = data.metadata ?? null;
    return entity;
  }
}
