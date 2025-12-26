import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisService } from '@common/redis/redis.service';

describe('AppController', () => {
  let appController: AppController;

  const mockDataSource = {
    query: jest.fn().mockResolvedValue([{ 1: 1 }]),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue({
      ping: jest.fn().mockResolvedValue('PONG'),
    }),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return system status', () => {
      const result = appController.getStatus();
      expect(result.status).toBe('running');
      expect(result.name).toBe('polymarket-trader');
    });
  });

  describe('health', () => {
    it('should return healthy status', async () => {
      const result = await appController.getHealth();
      expect(result.status).toBe('healthy');
      expect(result.services.app.status).toBe('up');
      expect(result.services.database.status).toBe('up');
      expect(result.services.redis.status).toBe('up');
    });
  });
});
