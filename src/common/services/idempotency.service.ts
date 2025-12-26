import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { RedisService } from '@common/redis/index';
import { AppLogger, LogPrefix } from '@common/logger/index';
import { IdempotencyKeyConflictException } from '@common/exceptions/index';
import type { IdempotencyResult } from '@app-types/index';

export type { IdempotencyResult };

interface StoredIdempotencyData {
  requestHash: string;
  locked: boolean;
  response?: {
    status: number;
    body: Record<string, unknown>;
  };
}

const KEY_PREFIX = 'idempotency:';

@Injectable()
export class IdempotencyService {
  private readonly logger: AppLogger;

  constructor(
    private readonly redis: RedisService,
    logger: AppLogger,
  ) {
    this.logger = logger.setPrefix(LogPrefix.API).setContext(IdempotencyService.name);
  }

  async checkAndLock(
    key: string,
    requestBody: unknown,
    expiresInSeconds: number,
  ): Promise<IdempotencyResult> {
    const requestHash = this.hashRequest(requestBody);
    const redisKey = this.buildKey(key);

    this.logger.setContextData({ idempotencyKey: key }).log('Checking idempotency key');

    const existingData = await this.redis.get(redisKey);

    if (existingData) {
      const parsed = JSON.parse(existingData) as StoredIdempotencyData;

      if (parsed.locked) {
        this.logger.warn('Idempotency key is locked');
        throw new IdempotencyKeyConflictException(key);
      }

      if (parsed.requestHash !== requestHash) {
        this.logger.warn('Request hash mismatch');
        throw new IdempotencyKeyConflictException(key);
      }

      if (parsed.response) {
        this.logger.log('Returning cached response');
        return {
          isNew: false,
          cachedResponse: parsed.response,
        };
      }
    }

    const newData: StoredIdempotencyData = {
      requestHash,
      locked: true,
    };

    await this.redis.set(redisKey, JSON.stringify(newData), expiresInSeconds);

    this.logger.log('New idempotency key created and locked');
    return { isNew: true };
  }

  async storeResponse(
    key: string,
    status: number,
    response: Record<string, unknown>,
    expiresInSeconds = 86400,
  ): Promise<void> {
    const redisKey = this.buildKey(key);

    this.logger.setContextData({ idempotencyKey: key }).log('Storing response');

    const existingData = await this.redis.get(redisKey);

    if (!existingData) {
      return;
    }

    const parsed = JSON.parse(existingData) as StoredIdempotencyData;

    const updatedData: StoredIdempotencyData = {
      ...parsed,
      locked: false,
      response: { status, body: response },
    };

    const ttl = await this.redis.ttl(redisKey);
    const finalTtl = ttl > 0 ? ttl : expiresInSeconds;

    await this.redis.set(redisKey, JSON.stringify(updatedData), finalTtl);
  }

  async releaseLock(key: string): Promise<void> {
    const redisKey = this.buildKey(key);
    this.logger.setContextData({ idempotencyKey: key }).log('Releasing lock');
    await this.redis.del(redisKey);
  }

  private buildKey(key: string): string {
    return `${KEY_PREFIX}${key}`;
  }

  private hashRequest(body: unknown): string {
    const content = JSON.stringify(body || {});
    return createHash('sha256').update(content).digest('hex');
  }
}
