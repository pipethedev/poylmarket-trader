import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyService } from './idempotency.service';
import { RedisService } from '@common/redis/redis.service';
import { AppLogger } from '@common/logger/app-logger.service';
import { IdempotencyKeyConflictException } from '@common/exceptions';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let redisService: jest.Mocked<RedisService>;

  const mockLogger = {
    setPrefix: jest.fn().mockReturnThis(),
    setContext: jest.fn().mockReturnThis(),
    setContextData: jest.fn().mockReturnThis(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            ttl: jest.fn(),
          },
        },
        {
          provide: AppLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    redisService = module.get(RedisService);
  });

  describe('checkAndLock', () => {
    it('should create new lock for new key', async () => {
      redisService.get.mockResolvedValue(null);
      redisService.set.mockResolvedValue(undefined);

      const result = await service.checkAndLock('new-key', { data: 'test' }, 3600);

      expect(result.isNew).toBe(true);
      expect(result.cachedResponse).toBeUndefined();
      expect(redisService.set).toHaveBeenCalled();
    });

    it('should return cached response if exists', async () => {
      const emptyObjectHash = '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a';
      const cachedData = {
        requestHash: emptyObjectHash,
        locked: false,
        response: { status: 200, body: { success: true } },
      };
      redisService.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.checkAndLock('existing-key', {}, 3600);

      expect(result.isNew).toBe(false);
      expect(result.cachedResponse).toEqual({ status: 200, body: { success: true } });
    });

    it('should throw conflict if key is locked', async () => {
      // SHA256 hash of '{}'
      const emptyObjectHash = '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a';
      const lockedData = {
        requestHash: emptyObjectHash,
        locked: true,
      };
      redisService.get.mockResolvedValue(JSON.stringify(lockedData));

      await expect(service.checkAndLock('locked-key', {}, 3600)).rejects.toThrow(
        IdempotencyKeyConflictException,
      );
    });

    it('should throw conflict if request hash mismatch', async () => {
      const existingData = {
        requestHash: 'different-hash',
        locked: false,
      };
      redisService.get.mockResolvedValue(JSON.stringify(existingData));

      await expect(service.checkAndLock('key', { different: 'body' }, 3600)).rejects.toThrow(
        IdempotencyKeyConflictException,
      );
    });
  });

  describe('storeResponse', () => {
    it('should store response with existing TTL', async () => {
      const existingData = { requestHash: 'hash', locked: true };
      redisService.get.mockResolvedValue(JSON.stringify(existingData));
      redisService.ttl.mockResolvedValue(1800);
      redisService.set.mockResolvedValue(undefined);

      await service.storeResponse('key', 200, { result: 'success' });

      expect(redisService.set).toHaveBeenCalledWith(
        'idempotency:key',
        expect.stringContaining('"locked":false'),
        1800,
      );
    });

    it('should use default TTL if key has no TTL', async () => {
      const existingData = { requestHash: 'hash', locked: true };
      redisService.get.mockResolvedValue(JSON.stringify(existingData));
      redisService.ttl.mockResolvedValue(-1);
      redisService.set.mockResolvedValue(undefined);

      await service.storeResponse('key', 201, { id: 1 }, 7200);

      expect(redisService.set).toHaveBeenCalledWith('idempotency:key', expect.any(String), 7200);
    });

    it('should do nothing if key does not exist', async () => {
      redisService.get.mockResolvedValue(null);

      await service.storeResponse('missing-key', 200, {});

      expect(redisService.set).not.toHaveBeenCalled();
    });
  });

  describe('releaseLock', () => {
    it('should delete the key', async () => {
      redisService.del.mockResolvedValue(undefined);

      await service.releaseLock('key');

      expect(redisService.del).toHaveBeenCalledWith('idempotency:key');
    });
  });
});
