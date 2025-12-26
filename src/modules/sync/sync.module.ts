import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SyncService } from './sync.service';
import { SyncProcessor } from './sync.processor';
import { ProvidersModule } from '@providers/providers.module';

@Module({
  imports: [
    ProvidersModule,
    BullModule.registerQueue({
      name: 'sync',
    }),
  ],
  providers: [SyncService, SyncProcessor],
  exports: [SyncService, BullModule],
})
export class SyncModule {}
