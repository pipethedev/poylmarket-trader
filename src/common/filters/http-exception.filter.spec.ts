import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './http-exception.filter';
import { AppException } from '@common/exceptions/app.exception';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let mockRequest: { url: string };
  let mockArgumentsHost: {
    switchToHttp: () => {
      getResponse: () => typeof mockResponse;
      getRequest: () => typeof mockRequest;
    };
  };

  beforeEach(() => {
    filter = new GlobalExceptionFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockRequest = { url: '/test/path' };

    mockArgumentsHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  it('should handle HttpException', () => {
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockArgumentsHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Not Found',
        path: '/test/path',
      }),
    );
  });

  it('should handle AppException', () => {
    const exception = new AppException('CUSTOM_ERROR', 'Custom error message', HttpStatus.BAD_REQUEST, {
      field: 'value',
    });

    filter.catch(exception, mockArgumentsHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'CUSTOM_ERROR',
        message: 'Custom error message',
        details: { field: 'value' },
        path: '/test/path',
      }),
    );
  });

  it('should handle HttpException with object response', () => {
    const exception = new HttpException({ message: 'Validation failed', error: 'Bad Request' }, HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Validation failed',
      }),
    );
  });

  it('should handle unknown exceptions as 500', () => {
    const exception = new Error('Unknown error');

    filter.catch(exception as never, mockArgumentsHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      }),
    );
  });

  it('should include timestamp in response', () => {
    const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost as never);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(String),
      }),
    );
  });

  it('should handle validation errors with array message', () => {
    const exception = new HttpException(
      { message: ['field is required', 'field is invalid'], error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockArgumentsHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: { errors: ['field is required', 'field is invalid'] },
      }),
    );
  });
});
