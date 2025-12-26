import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { ProvidersModule } from '@providers/providers.module';

@Module({
  imports: [ProvidersModule],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
