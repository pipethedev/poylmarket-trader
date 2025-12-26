import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventRepository } from './event.repository';
import { Event } from '@database/entities/event.entity';

describe('EventRepository', () => {
  let eventRepository: EventRepository;
  let repository: jest.Mocked<Repository<Event>>;

  const mockEvent: Event = {
    id: 1,
    polymarketId: 'poly-123',
    title: 'Test Event',
    description: 'Test Description',
    slug: 'test-event',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    active: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    markets: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventRepository,
        {
          provide: getRepositoryToken(Event),
          useValue: {
            findOneBy: jest.fn(),
            findBy: jest.fn(),
            createQueryBuilder: jest.fn(),
            manager: {},
          },
        },
      ],
    }).compile();

    eventRepository = module.get<EventRepository>(EventRepository);
    repository = module.get(getRepositoryToken(Event));
  });

  describe('findByPolymarketId', () => {
    it('should find event by polymarket id', async () => {
      repository.findOneBy.mockResolvedValue(mockEvent);

      const result = await eventRepository.findByPolymarketId('poly-123');

      expect(result).toEqual(mockEvent);
      expect(repository.findOneBy).toHaveBeenCalledWith({ polymarketId: 'poly-123' });
    });

    it('should return null if not found', async () => {
      repository.findOneBy.mockResolvedValue(null);

      const result = await eventRepository.findByPolymarketId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findActiveEvents', () => {
    it('should find active events', async () => {
      repository.findBy.mockResolvedValue([mockEvent]);

      const result = await eventRepository.findActiveEvents();

      expect(result).toHaveLength(1);
      expect(repository.findBy).toHaveBeenCalledWith({ active: true });
    });
  });

  describe('findWithMarketCounts', () => {
    it('should return events with market counts', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [mockEvent],
          raw: [{ marketCount: '5' }],
        }),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);

      const result = await eventRepository.findWithMarketCounts();

      expect(result).toHaveLength(1);
      expect(result[0].marketCount).toBe(5);
    });

    it('should default to 0 if marketCount is undefined', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [mockEvent],
          raw: [{}],
        }),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as never);

      const result = await eventRepository.findWithMarketCounts();

      expect(result[0].marketCount).toBe(0);
    });
  });
});
