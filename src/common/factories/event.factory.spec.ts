import { EventFactory } from './event.factory';
import { Event } from '@database/entities/event.entity';
import type { ProviderEvent } from '@app-types/index';

describe('EventFactory', () => {
  const mockProviderEvent: ProviderEvent = {
    id: 'polymarket-123',
    title: 'Test Event',
    description: 'Test Description',
    slug: 'test-event',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    active: true,
    metadata: { featured: true },
  };

  describe('create', () => {
    it('should create event data from provider event', () => {
      const result = EventFactory.create(mockProviderEvent, 'polymarket');

      expect(result.externalId).toBe('polymarket-123');
      expect(result.provider).toBe('polymarket');
      expect(result.title).toBe('Test Event');
      expect(result.description).toBe('Test Description');
      expect(result.slug).toBe('test-event');
      expect(result.startDate).toEqual(new Date('2024-01-01'));
      expect(result.endDate).toEqual(new Date('2024-12-31'));
      expect(result.active).toBe(true);
      expect(result.metadata).toEqual({ featured: true });
    });

    it('should handle null optional fields', () => {
      const minimalEvent: ProviderEvent = {
        id: 'polymarket-456',
        title: 'Minimal Event',
        active: false,
      };

      const result = EventFactory.create(minimalEvent, 'polymarket');

      expect(result.externalId).toBe('polymarket-456');
      expect(result.provider).toBe('polymarket');
      expect(result.title).toBe('Minimal Event');
      expect(result.description).toBeNull();
      expect(result.slug).toBeNull();
      expect(result.startDate).toBeNull();
      expect(result.endDate).toBeNull();
      expect(result.active).toBe(false);
      expect(result.metadata).toBeNull();
    });
  });

  describe('update', () => {
    it('should update existing event with provider data', () => {
      const existingEvent = new Event();
      existingEvent.id = 1;
      existingEvent.externalId = 'polymarket-123';
      existingEvent.title = 'Old Title';
      existingEvent.active = false;

      const result = EventFactory.update(existingEvent, mockProviderEvent);

      expect(result.id).toBe(1);
      expect(result.externalId).toBe('polymarket-123');
      expect(result.title).toBe('Test Event');
      expect(result.description).toBe('Test Description');
      expect(result.slug).toBe('test-event');
      expect(result.active).toBe(true);
    });

    it('should set null for undefined optional fields', () => {
      const existingEvent = new Event();
      existingEvent.id = 1;
      existingEvent.description = 'Old Description';

      const minimalEvent: ProviderEvent = {
        id: 'polymarket-456',
        title: 'New Title',
        active: true,
      };

      const result = EventFactory.update(existingEvent, minimalEvent);

      expect(result.title).toBe('New Title');
      expect(result.description).toBeNull();
      expect(result.slug).toBeNull();
      expect(result.metadata).toBeNull();
    });
  });
});

