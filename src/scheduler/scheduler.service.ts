import { Injectable, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { SyncService } from '@modules/sync/sync.service';
import { AppLogger, LogPrefix } from '@common/logger';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger: AppLogger;

  constructor(
    private readonly syncService: SyncService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    logger: AppLogger,
  ) {
    this.logger = logger.setPrefix(LogPrefix.SCHEDULER).setContext(SchedulerService.name);
  }

  onModuleInit(): void {
    this.registerCronJobs();
  }

  private registerCronJobs(): void {
    const syncCron = this.configService.get<string>('scheduler.syncCron')!;
    const priceUpdateCron = this.configService.get<string>('scheduler.priceUpdateCron')!;

    const syncJob = CronJob.from({
      cronTime: syncCron,
      onTick: () => {
        void this.handleEventSync();
      },
      start: false,
    });

    const priceJob = CronJob.from({
      cronTime: priceUpdateCron,
      onTick: () => {
        void this.handlePriceUpdate();
      },
      start: false,
    });

    this.schedulerRegistry.addCronJob('syncEvents', syncJob);
    this.schedulerRegistry.addCronJob('updatePrices', priceJob);

    syncJob.start();
    priceJob.start();

    this.logger.log(`Registered cron job: syncEvents (${syncCron})`);
    this.logger.log(`Registered cron job: updatePrices (${priceUpdateCron})`);
  }

  async handleEventSync(): Promise<void> {
    this.logger.log('Starting scheduled event sync');

    try {
      const result = await this.syncService.syncEvents(100);

      if (result.errors.length > 0) {
        this.logger.warn(`Sync completed with ${result.errors.length} errors`);
        result.errors.forEach((error) => this.logger.error(error));
      }
    } catch (error) {
      this.logger.error(`Scheduled sync failed: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  async handlePriceUpdate(): Promise<void> {
    this.logger.log('Starting scheduled price update (polling fallback)');

    try {
      const result = await this.syncService.updateMarketPrices();

      if (result.errors.length > 0) {
        this.logger.warn(`Price update failed with ${result.errors.length} errors`);
      }
    } catch (error) {
      this.logger.error(`Scheduled price update failed: ${(error as Error).message}`, (error as Error).stack);
    }
  }
}
