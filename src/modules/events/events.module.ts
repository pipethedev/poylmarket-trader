import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { SyncModule } from '@modules/sync/sync.module';
import { ProvidersModule } from '@providers/providers.module';

@Module({
  imports: [SyncModule, ProvidersModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
