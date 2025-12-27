import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, throwError, from } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { IdempotencyService } from '@common/services/idempotency.service';
import { AppLogger, LogPrefix } from '@common/logger';
import { IDEMPOTENCY_KEY, IdempotencyOptions } from '@common/decorators/idempotency.decorator';
import { IdempotencyKeyRequiredException } from '@common/exceptions';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger: AppLogger;

  constructor(
    private readonly reflector: Reflector,
    private readonly idempotencyService: IdempotencyService,
    logger: AppLogger,
  ) {
    this.logger = logger.setPrefix(LogPrefix.API).setContext(IdempotencyInterceptor.name);
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const options = this.reflector.get<IdempotencyOptions>(IDEMPOTENCY_KEY, context.getHandler());

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const idempotencyKey = request.headers['x-idempotency-key'] as string;

    if (!idempotencyKey) {
      if (options.required) {
        throw new IdempotencyKeyRequiredException();
      }
      return next.handle();
    }

    this.logger.setContextData({ idempotencyKey }).debug('Processing idempotent request');

    const result = await this.idempotencyService.checkAndLock(
      idempotencyKey,
      request.body,
      options.expiresInSeconds ?? 86400,
    );

    if (!result.isNew && result.cachedResponse) {
      this.logger.debug('Returning cached response');
      response.status(result.cachedResponse.status ?? 200);
      return of(result.cachedResponse.body);
    }

    return next.handle().pipe(
      switchMap((data) =>
        from(
          this.idempotencyService.storeResponse(idempotencyKey, response.statusCode, data as Record<string, unknown>),
        ).pipe(switchMap(() => of(data))),
      ),
      catchError((error: Error) =>
        from(this.idempotencyService.releaseLock(idempotencyKey)).pipe(switchMap(() => throwError(() => error))),
      ),
    );
  }
}
