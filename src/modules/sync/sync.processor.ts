import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SyncService } from './sync.service';
import { AppLogger, LogPrefix } from '@common/logger/index';

export interface SyncJobData {
  limit: number;
  jobId?: string;
}

@Processor('sync')
export class SyncProcessor extends WorkerHost {
  private readonly logger: AppLogger;

  constructor(
    private readonly syncService: SyncService,
    logger: AppLogger,
  ) {
    super();
    this.logger = logger.setPrefix(LogPrefix.QUEUE).setContext(SyncProcessor.name);
  }

  async process(job: Job<SyncJobData>): Promise<{
    eventsCreated: number;
    eventsUpdated: number;
    marketsCreated: number;
    marketsUpdated: number;
  }> {
    const { limit } = job.data;
    const jobLogger = this.logger.child({ limit, jobId: job.id });

    jobLogger.log('Processing sync job');

    try {
      const result = await this.syncService.syncEvents(limit);

      jobLogger.log(
        `Sync completed - Events: ${result.eventsCreated} created, ${result.eventsUpdated} updated | ` +
          `Markets: ${result.marketsCreated} created, ${result.marketsUpdated} updated | ` +
          `Tokens: ${result.tokensCreated} created, ${result.tokensUpdated} updated`,
      );

      if (result.errors.length > 0) {
        jobLogger.warn(`Sync completed with ${result.errors.length} errors`);
      }

      return {
        eventsCreated: result.eventsCreated,
        eventsUpdated: result.eventsUpdated,
        marketsCreated: result.marketsCreated,
        marketsUpdated: result.marketsUpdated,
      };
    } catch (error) {
      jobLogger.error(`Sync job failed: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<SyncJobData>) {
    this.logger.child({ jobId: job.id }).log('Sync job completed successfully');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SyncJobData>, error: Error) {
    this.logger.child({ jobId: job.id }).error(`Sync job failed: ${error.message}`, error.stack);
  }
}
