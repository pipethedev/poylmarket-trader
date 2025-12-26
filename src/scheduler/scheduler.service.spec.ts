import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SchedulerService } from './scheduler.service';
import { SyncService } from '@modules/sync/sync.service';
import { AppLogger } from '@common/logger/app-logger.service';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let syncService: jest.Mocked<SyncService>;
  let schedulerRegistry: jest.Mocked<SchedulerRegistry>;

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
        SchedulerService,
        {
          provide: SyncService,
          useValue: {
            syncEvents: jest.fn(),
            updateMarketPrices: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'scheduler.syncCron') return '*/15 * * * *';
              if (key === 'scheduler.priceUpdateCron') return '*/5 * * * *';
              return undefined;
            }),
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: {
            addCronJob: jest.fn(),
          },
        },
        {
          provide: AppLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
    syncService = module.get(SyncService);
    schedulerRegistry = module.get(SchedulerRegistry);
  });

  describe('onModuleInit', () => {
    it('should register cron jobs', () => {
      service.onModuleInit();

      expect(schedulerRegistry.addCronJob).toHaveBeenCalledTimes(2);
      expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith('syncEvents', expect.any(Object));
      expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith('updatePrices', expect.any(Object));
    });
  });

  describe('handleEventSync', () => {
    it('should sync events successfully', async () => {
      syncService.syncEvents.mockResolvedValue({
        eventsCreated: 5,
        eventsUpdated: 10,
        marketsCreated: 20,
        marketsUpdated: 15,
        tokensCreated: 40,
        tokensUpdated: 30,
        errors: [],
      });

      await service.handleEventSync();

      expect(syncService.syncEvents).toHaveBeenCalledWith(100);
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it('should log warnings for sync errors', async () => {
      syncService.syncEvents.mockResolvedValue({
        eventsCreated: 0,
        eventsUpdated: 0,
        marketsCreated: 0,
        marketsUpdated: 0,
        tokensCreated: 0,
        tokensUpdated: 0,
        errors: ['Error 1', 'Error 2'],
      });

      await service.handleEventSync();

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle sync failure', async () => {
      syncService.syncEvents.mockRejectedValue(new Error('Sync failed'));

      await service.handleEventSync();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('handlePriceUpdate', () => {
    it('should update prices successfully', async () => {
      syncService.updateMarketPrices.mockResolvedValue({
        updated: 10,
        errors: [],
      });

      await service.handlePriceUpdate();

      expect(syncService.updateMarketPrices).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it('should log warnings for price update errors', async () => {
      syncService.updateMarketPrices.mockResolvedValue({
        updated: 5,
        errors: ['Error 1'],
      });

      await service.handlePriceUpdate();

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle price update failure', async () => {
      syncService.updateMarketPrices.mockRejectedValue(new Error('Price update failed'));

      await service.handlePriceUpdate();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
