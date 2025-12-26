import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { SyncProcessor, SyncJobData } from './sync.processor';
import { SyncService } from './sync.service';
import { AppLogger } from '@common/logger/app-logger.service';

describe('SyncProcessor', () => {
  let processor: SyncProcessor;
  let syncService: jest.Mocked<SyncService>;

  const mockLogger = {
    setPrefix: jest.fn().mockReturnThis(),
    setContext: jest.fn().mockReturnThis(),
    setContextData: jest.fn().mockReturnThis(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  };

  const mockSyncResult = {
    eventsCreated: 5,
    eventsUpdated: 3,
    marketsCreated: 10,
    marketsUpdated: 7,
    tokensCreated: 20,
    tokensUpdated: 14,
    errors: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncProcessor,
        {
          provide: SyncService,
          useValue: {
            syncEvents: jest.fn(),
          },
        },
        {
          provide: AppLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    processor = module.get<SyncProcessor>(SyncProcessor);
    syncService = module.get(SyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(processor).toBeDefined();
    });

    it('should initialize logger with correct prefix and context', () => {
      expect(mockLogger.setPrefix).toHaveBeenCalled();
      expect(mockLogger.setContext).toHaveBeenCalledWith('SyncProcessor');
    });
  });

  describe('process', () => {
    it('should successfully process a sync job', async () => {
      const jobData: SyncJobData = { limit: 100 };
      const job = {
        id: 'job-123',
        data: jobData,
      } as Job<SyncJobData>;

      syncService.syncEvents.mockResolvedValue(mockSyncResult);

      await processor.process(job);

      expect(syncService.syncEvents).toHaveBeenCalledWith(100);
      expect(mockLogger.child).toHaveBeenCalledWith({
        limit: 100,
        jobId: 'job-123',
      });
      expect(mockLogger.log).toHaveBeenCalledWith('Processing sync job');
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Sync completed'));
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Events: 5 created, 3 updated'),
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Markets: 10 created, 7 updated'),
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Tokens: 20 created, 14 updated'),
      );
    });

    it('should log warning when sync completes with errors', async () => {
      const jobData: SyncJobData = { limit: 50 };
      const job = {
        id: 'job-456',
        data: jobData,
      } as Job<SyncJobData>;

      const resultWithErrors = {
        ...mockSyncResult,
        errors: ['Error 1', 'Error 2', 'Error 3'],
      };

      syncService.syncEvents.mockResolvedValue(resultWithErrors);

      await processor.process(job);

      expect(mockLogger.warn).toHaveBeenCalledWith('Sync completed with 3 errors');
    });

    it('should handle sync service errors and rethrow', async () => {
      const jobData: SyncJobData = { limit: 75 };
      const job = {
        id: 'job-789',
        data: jobData,
      } as Job<SyncJobData>;

      const error = new Error('Sync service failed');
      syncService.syncEvents.mockRejectedValue(error);

      await expect(processor.process(job)).rejects.toThrow('Sync service failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Sync job failed: Sync service failed',
        expect.any(String),
      );
    });

    it('should create child logger with correct context', async () => {
      const jobData: SyncJobData = { limit: 200, jobId: 'custom-job-id' };
      const job = {
        id: 'job-abc',
        data: jobData,
      } as Job<SyncJobData>;

      syncService.syncEvents.mockResolvedValue(mockSyncResult);

      await processor.process(job);

      expect(mockLogger.child).toHaveBeenCalledWith({
        limit: 200,
        jobId: 'job-abc',
      });
    });

    it('should handle different limit values', async () => {
      const testCases = [10, 50, 100, 500, 1000];

      for (const limit of testCases) {
        const job = {
          id: `job-${limit}`,
          data: { limit },
        } as Job<SyncJobData>;

        syncService.syncEvents.mockResolvedValue(mockSyncResult);

        await processor.process(job);

        expect(syncService.syncEvents).toHaveBeenCalledWith(limit);
      }
    });

    it('should handle zero events/markets/tokens created', async () => {
      const jobData: SyncJobData = { limit: 100 };
      const job = {
        id: 'job-empty',
        data: jobData,
      } as Job<SyncJobData>;

      const emptyResult = {
        eventsCreated: 0,
        eventsUpdated: 0,
        marketsCreated: 0,
        marketsUpdated: 0,
        tokensCreated: 0,
        tokensUpdated: 0,
        errors: [],
      };

      syncService.syncEvents.mockResolvedValue(emptyResult);

      await processor.process(job);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Sync completed - Events: 0 created, 0 updated | Markets: 0 created, 0 updated | Tokens: 0 created, 0 updated',
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle large sync results', async () => {
      const jobData: SyncJobData = { limit: 1000 };
      const job = {
        id: 'job-large',
        data: jobData,
      } as Job<SyncJobData>;

      const largeResult = {
        eventsCreated: 500,
        eventsUpdated: 300,
        marketsCreated: 1000,
        marketsUpdated: 700,
        tokensCreated: 2000,
        tokensUpdated: 1400,
        errors: [],
      };

      syncService.syncEvents.mockResolvedValue(largeResult);

      await processor.process(job);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Events: 500 created, 300 updated'),
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Markets: 1000 created, 700 updated'),
      );
    });

    it('should handle errors without stack trace', async () => {
      const jobData: SyncJobData = { limit: 100 };
      const job = {
        id: 'job-no-stack',
        data: jobData,
      } as Job<SyncJobData>;

      const error = new Error('Error without stack');
      error.stack = undefined;

      syncService.syncEvents.mockRejectedValue(error);

      await expect(processor.process(job)).rejects.toThrow('Error without stack');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Sync job failed: Error without stack',
        undefined,
      );
    });
  });

  describe('onCompleted', () => {
    it('should log job completion', () => {
      const job = {
        id: 'job-completed',
        data: { limit: 100 },
      } as Job<SyncJobData>;

      processor.onCompleted(job);

      expect(mockLogger.child).toHaveBeenCalledWith({ jobId: 'job-completed' });
      expect(mockLogger.log).toHaveBeenCalledWith('Sync job completed successfully');
    });

    it('should handle multiple job completions', () => {
      const jobs = [
        { id: 'job-1', data: { limit: 50 } },
        { id: 'job-2', data: { limit: 100 } },
        { id: 'job-3', data: { limit: 150 } },
      ];

      jobs.forEach((job) => {
        processor.onCompleted(job as Job<SyncJobData>);
      });

      expect(mockLogger.child).toHaveBeenCalledTimes(3);
      expect(mockLogger.log).toHaveBeenCalledTimes(3);
    });
  });

  describe('onFailed', () => {
    it('should log job failure with error details', () => {
      const job = {
        id: 'job-failed',
        data: { limit: 100 },
      } as Job<SyncJobData>;

      const error = new Error('Job processing failed');
      error.stack = 'Error: Job processing failed\n    at ...';

      processor.onFailed(job, error);

      expect(mockLogger.child).toHaveBeenCalledWith({ jobId: 'job-failed' });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Sync job failed: Job processing failed',
        error.stack,
      );
    });

    it('should handle errors without stack trace', () => {
      const job = {
        id: 'job-failed-no-stack',
        data: { limit: 100 },
      } as Job<SyncJobData>;

      const error = new Error('Error without stack');
      error.stack = undefined;

      processor.onFailed(job, error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Sync job failed: Error without stack',
        undefined,
      );
    });

    it('should handle multiple job failures', () => {
      const jobs = [
        { id: 'job-fail-1', data: { limit: 50 } },
        { id: 'job-fail-2', data: { limit: 100 } },
      ];

      jobs.forEach((job, index) => {
        const error = new Error(`Error ${index + 1}`);
        processor.onFailed(job as Job<SyncJobData>, error);
      });

      expect(mockLogger.child).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledTimes(2);
    });

    it('should handle error with custom message', () => {
      const job = {
        id: 'job-custom-error',
        data: { limit: 100 },
      } as Job<SyncJobData>;

      const error = new Error('Custom error message with details');

      processor.onFailed(job, error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Sync job failed: Custom error message with details',
        expect.any(String),
      );
    });
  });

  describe('logger integration', () => {
    it('should use child logger for all log messages', async () => {
      const jobData: SyncJobData = { limit: 100 };
      const job = {
        id: 'job-logger-test',
        data: jobData,
      } as Job<SyncJobData>;

      syncService.syncEvents.mockResolvedValue(mockSyncResult);

      await processor.process(job);

      expect(mockLogger.child).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it('should maintain logger context across multiple operations', async () => {
      const jobs = [
        { id: 'job-1', data: { limit: 50 } },
        { id: 'job-2', data: { limit: 100 } },
      ];

      syncService.syncEvents.mockResolvedValue(mockSyncResult);

      for (const job of jobs) {
        await processor.process(job as Job<SyncJobData>);
      }

      expect(mockLogger.child).toHaveBeenCalled();
    });
  });
});
