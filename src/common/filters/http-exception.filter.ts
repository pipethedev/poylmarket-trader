import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception';
import type { ExceptionResponse } from '../../types';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: ExceptionResponse = {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (exception instanceof AppException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const responseBody =
        typeof exceptionResponse === 'object' ? (exceptionResponse as Record<string, unknown>) : {};
      errorResponse = {
        code: exception.code,
        message: (responseBody.message as string) || 'An error occurred',
        details: exception.details,
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errorResponse = {
          code: 'HTTP_ERROR',
          message: exceptionResponse,
          timestamp: new Date().toISOString(),
          path: request.url,
        };
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        errorResponse = {
          code: (resp.error as string)?.toUpperCase().replace(/ /g, '_') || 'HTTP_ERROR',
          message: (resp.message as string) || 'An error occurred',
          details: resp.details as Record<string, unknown>,
          timestamp: new Date().toISOString(),
          path: request.url,
        };

        if (Array.isArray(resp.message)) {
          errorResponse.code = 'VALIDATION_ERROR';
          errorResponse.message = 'Validation failed';
          errorResponse.details = { errors: resp.message };
        }
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      this.logger.error(`Unexpected error: ${exception.message}`, exception.stack);
    } else {
      this.logger.error('Unknown error type', exception);
    }

    response.status(status).json(errorResponse);
  }
}
