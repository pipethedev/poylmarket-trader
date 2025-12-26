import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { SyncModule } from '@modules/sync/sync.module';

@Module({
  imports: [ScheduleModule.forRoot(), SyncModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
