import { Module, Global } from '@nestjs/common';
import { RedisModule } from './redis/redis.module';
import { LoggerModule } from './logger/logger.module';
import { IdempotencyService } from './services/idempotency.service';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';

@Global()
@Module({
  imports: [RedisModule, LoggerModule],
  providers: [IdempotencyService, IdempotencyInterceptor],
  exports: [RedisModule, LoggerModule, IdempotencyService, IdempotencyInterceptor],
})
export class CommonModule {}
