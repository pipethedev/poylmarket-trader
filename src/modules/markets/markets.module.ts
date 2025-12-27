import { Module } from '@nestjs/common';
import { MarketsController } from './markets.controller';
import { MarketsService } from './markets.service';
import { ProvidersModule } from '@providers/providers.module';
import { SyncModule } from '@modules/sync/sync.module';

@Module({
  imports: [ProvidersModule, SyncModule],
  controllers: [MarketsController],
  providers: [MarketsService],
  exports: [MarketsService],
})
export class MarketsModule {}
