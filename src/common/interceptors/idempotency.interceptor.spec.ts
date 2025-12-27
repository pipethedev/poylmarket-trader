import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from '@common/services/idempotency.service';
import { AppLogger } from '@common/logger/app-logger.service';
import { IdempotencyKeyRequiredException } from '@common/exceptions';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let reflector: jest.Mocked<Reflector>;
  let idempotencyService: jest.Mocked<IdempotencyService>;

  const mockLogger = {
    setPrefix: jest.fn().mockReturnThis(),
    setContext: jest.fn().mockReturnThis(),
    setContextData: jest.fn().mockReturnThis(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const createMockExecutionContext = (idempotencyKey: string | undefined = undefined, body = {}) => {
    const headers: Record<string, string | undefined> = {
      'x-idempotency-key': idempotencyKey,
    };
    const mockRequest = { headers, body };
    const mockResponse = { statusCode: 200, status: jest.fn().mockReturnThis() };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = {
      get: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    idempotencyService = {
      checkAndLock: jest.fn(),
      storeResponse: jest.fn(),
      releaseLock: jest.fn(),
    } as unknown as jest.Mocked<IdempotencyService>;

    interceptor = new IdempotencyInterceptor(reflector, idempotencyService, mockLogger as unknown as AppLogger);
  });

  describe('intercept', () => {
    it('should pass through if no idempotency options', async () => {
      reflector.get.mockReturnValue(undefined);
      const context = createMockExecutionContext();
      const next: CallHandler = { handle: () => of({ result: 'success' }) };

      const result = await interceptor.intercept(context, next);
      const data = await result.toPromise();

      expect(data).toEqual({ result: 'success' });
      expect(idempotencyService.checkAndLock).not.toHaveBeenCalled();
    });

    it('should pass through if no idempotency key and not required', async () => {
      reflector.get.mockReturnValue({ required: false, expiresInSeconds: 3600 });
      const context = createMockExecutionContext(undefined);
      const next: CallHandler = { handle: () => of({ result: 'success' }) };

      const result = await interceptor.intercept(context, next);
      const data = await result.toPromise();

      expect(data).toEqual({ result: 'success' });
    });

    it('should throw if no idempotency key and required', async () => {
      reflector.get.mockReturnValue({ required: true, expiresInSeconds: 3600 });
      const context = createMockExecutionContext(undefined);
      const next: CallHandler = { handle: () => of({}) };

      await expect(interceptor.intercept(context, next)).rejects.toThrow(IdempotencyKeyRequiredException);
    });

    it('should return cached response if exists', async () => {
      reflector.get.mockReturnValue({ required: true, expiresInSeconds: 3600 });
      const context = createMockExecutionContext('test-key');
      const next: CallHandler = { handle: () => of({}) };

      idempotencyService.checkAndLock.mockResolvedValue({
        isNew: false,
        cachedResponse: { status: 200, body: { cached: true } },
      });

      const result = await interceptor.intercept(context, next);
      const data = await result.toPromise();

      expect(data).toEqual({ cached: true });
    });

    it('should process request and store response for new key', async () => {
      reflector.get.mockReturnValue({ required: true, expiresInSeconds: 3600 });
      const context = createMockExecutionContext('new-key', { data: 'test' });
      const next: CallHandler = { handle: () => of({ created: true }) };

      idempotencyService.checkAndLock.mockResolvedValue({ isNew: true });
      idempotencyService.storeResponse.mockResolvedValue(undefined);

      const result = await interceptor.intercept(context, next);
      const data = await result.toPromise();

      expect(data).toEqual({ created: true });
      expect(idempotencyService.storeResponse).toHaveBeenCalledWith('new-key', 200, {
        created: true,
      });
    });

    it('should release lock on error', async () => {
      reflector.get.mockReturnValue({ required: true, expiresInSeconds: 3600 });
      const context = createMockExecutionContext('error-key');
      const testError = new Error('Test error');
      const next: CallHandler = { handle: () => throwError(() => testError) };

      idempotencyService.checkAndLock.mockResolvedValue({ isNew: true });
      idempotencyService.releaseLock.mockResolvedValue(undefined);

      const result = await interceptor.intercept(context, next);

      await expect(result.toPromise()).rejects.toThrow('Test error');
      expect(idempotencyService.releaseLock).toHaveBeenCalledWith('error-key');
    });
  });
});
