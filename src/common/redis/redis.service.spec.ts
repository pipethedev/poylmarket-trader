import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let mockRedisClient: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    ttl: jest.Mock;
    exists: jest.Mock;
    quit: jest.Mock;
    ping: jest.Mock;
  };

  beforeEach(async () => {
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      ttl: jest.fn(),
      exists: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
      ping: jest.fn().mockResolvedValue('PONG'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'redis.host') return 'localhost';
              if (key === 'redis.port') return 6379;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    (service as unknown as { client: typeof mockRedisClient }).client = mockRedisClient;
  });

  describe('get', () => {
    it('should return value for existing key', async () => {
      mockRedisClient.get.mockResolvedValue('test-value');

      const result = await service.get('test-key');

      expect(result).toBe('test-value');
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null for non-existing key', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.get('missing-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value without TTL', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('test-key', 'test-value');

      expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should set value with TTL', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('test-key', 'test-value', 3600);

      expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', 'test-value', 'EX', 3600);
    });
  });

  describe('del', () => {
    it('should delete key', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await service.del('test-key');

      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
    });
  });

  describe('ttl', () => {
    it('should return TTL for key', async () => {
      mockRedisClient.ttl.mockResolvedValue(3600);

      const result = await service.ttl('test-key');

      expect(result).toBe(3600);
      expect(mockRedisClient.ttl).toHaveBeenCalledWith('test-key');
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await service.exists('test-key');

      expect(result).toBe(true);
    });

    it('should return false for non-existing key', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await service.exists('missing-key');

      expect(result).toBe(false);
    });
  });

  describe('getClient', () => {
    it('should return the redis client', () => {
      const client = service.getClient();
      expect(client).toBe(mockRedisClient);
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit the redis client', async () => {
      await service.onModuleDestroy();
      expect(mockRedisClient.quit).toHaveBeenCalled();
    });
  });
});

