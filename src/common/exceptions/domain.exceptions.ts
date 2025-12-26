import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';

export class OrderNotFoundException extends AppException {
  constructor(orderId: string) {
    super('ORDER_NOT_FOUND', `Order with ID ${orderId} not found`, HttpStatus.NOT_FOUND, {
      orderId,
    });
  }
}

export class DuplicateOrderException extends AppException {
  constructor(idempotencyKey: string) {
    super(
      'DUPLICATE_ORDER',
      `Order with idempotency key ${idempotencyKey} already exists`,
      HttpStatus.CONFLICT,
      { idempotencyKey },
    );
  }
}

export class OrderNotCancellableException extends AppException {
  constructor(orderId: string, currentStatus: string) {
    super(
      'ORDER_NOT_CANCELLABLE',
      `Order ${orderId} cannot be cancelled in status ${currentStatus}`,
      HttpStatus.BAD_REQUEST,
      { orderId, currentStatus },
    );
  }
}

export class OrderProcessingException extends AppException {
  constructor(orderId: string, reason: string) {
    super(
      'ORDER_PROCESSING_ERROR',
      `Failed to process order ${orderId}: ${reason}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { orderId, reason },
    );
  }
}

export class MarketNotFoundException extends AppException {
  constructor(marketId: string) {
    super('MARKET_NOT_FOUND', `Market with ID ${marketId} not found`, HttpStatus.NOT_FOUND, {
      marketId,
    });
  }
}

export class MarketNotActiveException extends AppException {
  constructor(marketId: string) {
    super(
      'MARKET_NOT_ACTIVE',
      `Market ${marketId} is not active for trading`,
      HttpStatus.BAD_REQUEST,
      { marketId },
    );
  }
}

export class EventNotFoundException extends AppException {
  constructor(eventId: string) {
    super('EVENT_NOT_FOUND', `Event with ID ${eventId} not found`, HttpStatus.NOT_FOUND, {
      eventId,
    });
  }
}

export class ProviderException extends AppException {
  constructor(provider: string, message: string, details?: Record<string, unknown>) {
    super('PROVIDER_ERROR', `Provider ${provider} error: ${message}`, HttpStatus.BAD_GATEWAY, {
      provider,
      ...details,
    });
  }
}

export class ProviderUnavailableException extends AppException {
  constructor(provider: string) {
    super(
      'PROVIDER_UNAVAILABLE',
      `Provider ${provider} is currently unavailable`,
      HttpStatus.SERVICE_UNAVAILABLE,
      { provider },
    );
  }
}

export class IdempotencyKeyRequiredException extends AppException {
  constructor() {
    super(
      'IDEMPOTENCY_KEY_REQUIRED',
      'Idempotency-Key header is required for this operation',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class IdempotencyKeyConflictException extends AppException {
  constructor(key: string) {
    super(
      'IDEMPOTENCY_KEY_CONFLICT',
      `Request with idempotency key ${key} is already being processed`,
      HttpStatus.CONFLICT,
      { idempotencyKey: key },
    );
  }
}

export class InvalidOrderParametersException extends AppException {
  constructor(details: Record<string, unknown>) {
    super(
      'INVALID_ORDER_PARAMETERS',
      'Invalid order parameters provided',
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}

export class OptimisticLockException extends AppException {
  constructor(entity: string, id: string) {
    super(
      'OPTIMISTIC_LOCK_ERROR',
      `${entity} ${id} was modified by another process`,
      HttpStatus.CONFLICT,
      { entity, id },
    );
  }
}
