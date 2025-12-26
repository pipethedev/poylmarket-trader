import { SetMetadata } from '@nestjs/common';

export interface IdempotencyOptions {
  expiresInSeconds?: number;
  required?: boolean;
}

export const IDEMPOTENCY_KEY = 'idempotency';

export const Idempotent = (options?: IdempotencyOptions) =>
  SetMetadata(IDEMPOTENCY_KEY, {
    expiresInSeconds: options?.expiresInSeconds ?? 86400,
    required: options?.required ?? true,
  });
