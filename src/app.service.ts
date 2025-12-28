import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '@common/redis/redis.service';

export type SystemStatus = {
  status: string;
  name: string;
  version: string;
  timestamp: string;
};

export type HealthCheck = {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    app: ServiceHealth;
    database: ServiceHealth;
    redis: ServiceHealth;
  };
};

export type ServiceHealth = {
  status: 'up' | 'down';
  latency?: number;
  error?: string;
};

@Injectable()
export class AppService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  getStatus(): SystemStatus {
    return {
      status: 'running',
      name: 'polymarket-trader',
      version: '0.0.1',
      timestamp: new Date().toISOString(),
    };
  }

  async getHealth(): Promise<HealthCheck> {
    const [dbHealth, redisHealth] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    const allHealthy = dbHealth.status === 'up' && redisHealth.status === 'up';

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        app: { status: 'up' },
        database: dbHealth,
        redis: redisHealth,
      },
    };
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up', latency: Date.now() - start };
    } catch (error) {
      return { status: 'down', error: (error as Error).message };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await this.redisService.getClient().ping();
      return { status: 'up', latency: Date.now() - start };
    } catch (error) {
      return { status: 'down', error: (error as Error).message };
    }
  }
}
