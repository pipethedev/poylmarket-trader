import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersProcessor } from './orders.processor';
import { ProvidersModule } from '@providers/providers.module';
import { UsdcTokenService } from '@common/services/usdc-token.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'orders',
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 86400,
        },
        attempts: 10,
        backoff: {
          type: 'exponential',
          delay: 300000,
        },
      },
    }),
    ProvidersModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersProcessor, UsdcTokenService],
  exports: [OrdersService],
})
export class OrdersModule {}
