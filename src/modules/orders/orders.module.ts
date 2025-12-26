import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersProcessor } from './orders.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'orders',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersProcessor],
  exports: [OrdersService],
})
export class OrdersModule {}
