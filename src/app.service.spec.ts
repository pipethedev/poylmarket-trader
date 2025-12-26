import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';
import { RedisService } from '@common/redis/redis.service';

describe('AppService', () => {
  let service: AppService;
  let dataSource: jest.Mocked<DataSource>;
  let mockRedisClient: { ping: jest.Mock };

  beforeEach(async () => {
    mockRedisClient = {
      ping: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockRedisClient),
          },
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    dataSource = module.get(DataSource);
  });

  describe('getStatus', () => {
    it('should return system status', () => {
      const result = service.getStatus();

      expect(result.status).toBe('running');
      expect(result.name).toBe('polymarket-trader');
      expect(result.version).toBe('0.0.1');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('getHealth', () => {
    it('should return healthy status when all services are connected', async () => {
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisClient.ping.mockResolvedValue('PONG');

      const result = await service.getHealth();

      expect(result.status).toBe('healthy');
      expect(result.services.app.status).toBe('up');
      expect(result.services.database.status).toBe('up');
      expect(result.services.redis.status).toBe('up');
    });

    it('should return unhealthy status when database is disconnected', async () => {
      dataSource.query.mockRejectedValue(new Error('Connection refused'));
      mockRedisClient.ping.mockResolvedValue('PONG');

      const result = await service.getHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.services.database.status).toBe('down');
      expect(result.services.database.error).toBe('Connection refused');
      expect(result.services.redis.status).toBe('up');
    });

    it('should return unhealthy status when redis is disconnected', async () => {
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisClient.ping.mockRejectedValue(new Error('Redis error'));

      const result = await service.getHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.services.database.status).toBe('up');
      expect(result.services.redis.status).toBe('down');
      expect(result.services.redis.error).toBe('Redis error');
    });

    it('should return unhealthy status when both services are disconnected', async () => {
      dataSource.query.mockRejectedValue(new Error('DB error'));
      mockRedisClient.ping.mockRejectedValue(new Error('Redis error'));

      const result = await service.getHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.services.database.status).toBe('down');
      expect(result.services.redis.status).toBe('down');
    });

    it('should include latency when services are healthy', async () => {
      dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      mockRedisClient.ping.mockResolvedValue('PONG');

      const result = await service.getHealth();

      expect(result.services.database.latency).toBeDefined();
      expect(result.services.redis.latency).toBeDefined();
    });
  });
});
