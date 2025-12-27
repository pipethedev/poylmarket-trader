import { Module, Global } from '@nestjs/common';
import { RedisModule } from './redis/redis.module';
import { LoggerModule } from './logger/logger.module';
import { IdempotencyService } from './services/idempotency.service';
import { SignatureValidationService } from './services/signature-validation.service';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';

@Global()
@Module({
  imports: [RedisModule, LoggerModule],
  providers: [IdempotencyService, SignatureValidationService, IdempotencyInterceptor],
  exports: [
    RedisModule,
    LoggerModule,
    IdempotencyService,
    SignatureValidationService,
    IdempotencyInterceptor,
  ],
})
export class CommonModule {}
