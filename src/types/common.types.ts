export type ExceptionResponse = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  path?: string;
};

export type IdempotencyResult = {
  isNew: boolean;
  cachedResponse?: {
    status: number;
    body: Record<string, unknown>;
  };
};
