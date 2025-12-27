import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SyncService } from './sync.service';
import { SyncProcessor } from './sync.processor';
import { ProvidersModule } from '@providers/providers.module';
import { PolymarketWebSocketModule } from '@providers/polymarket/polymarket-websocket.module';

@Module({
  imports: [
    ProvidersModule,
    PolymarketWebSocketModule,
    BullModule.registerQueue({
      name: 'sync',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        removeOnFail: false,
      },
    }),
  ],
  providers: [SyncService, SyncProcessor],
  exports: [SyncService, BullModule],
})
export class SyncModule {}
