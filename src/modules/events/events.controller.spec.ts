import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

describe('EventsController', () => {
  let controller: EventsController;
  let service: jest.Mocked<EventsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: EventsService,
          useValue: {
            getEvent: jest.fn(),
            getEvents: jest.fn(),
            syncEvents: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
    service = module.get(EventsService);
  });

  describe('getEvent', () => {
    it('should return event by id', async () => {
      const eventResponse = {
        id: 1,
        externalId: 'poly-123',
        title: 'Test Event',
        description: 'Test Description',
        slug: 'test-event',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      service.getEvent.mockResolvedValue(eventResponse);

      const result = await controller.getEvent(1);

      expect(result.id).toBe(1);
      expect(service.getEvent).toHaveBeenCalledWith(1);
    });
  });

  describe('getEvents', () => {
    it('should return paginated events', async () => {
      const eventsResponse = {
        data: [
          {
            id: 1,
            externalId: 'poly-123',
            title: 'Test Event',
            description: null,
            slug: null,
            startDate: null,
            endDate: null,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        meta: { page: 1, size: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
      };
      service.getEvents.mockResolvedValue(eventsResponse);

      const result = await controller.getEvents({ page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(service.getEvents).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    });
  });

  describe('syncEvents', () => {
    it('should trigger sync and return result', async () => {
      const syncResult = {
        eventsCreated: 5,
        eventsUpdated: 10,
        marketsCreated: 20,
        marketsUpdated: 15,
        tokensCreated: 40,
        tokensUpdated: 30,
        errors: [],
      };
      service.syncEvents.mockResolvedValue(syncResult);

      const result = await controller.syncEvents();

      expect(result.eventsCreated).toBe(5);
      expect(service.syncEvents).toHaveBeenCalled();
    });
  });
});

