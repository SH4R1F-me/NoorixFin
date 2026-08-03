/**
 * Global HTTP Exception Filter — Blueprint §11.1
 * Returns consistent error format with request ID.
 * Never leaks sensitive financial data in error responses.
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
  timestamp: string;
  path: string;
  fieldErrors?: Record<string, string[]>;
}

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let fieldErrors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        const obj = exResponse as Record<string, unknown>;
        message = (obj.message as string) || message;
        code = (obj.code as string) || this.statusToCode(status);

        // Handle class-validator errors
        if (Array.isArray(obj.message)) {
          message = 'Validation failed';
          fieldErrors = this.parseValidationErrors(obj.message as string[]);
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Ensure code is set from status if not already
    if (code === 'INTERNAL_ERROR' && status !== HttpStatus.INTERNAL_SERVER_ERROR) {
      code = this.statusToCode(status);
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      code,
      message,
      requestId: (request.headers['x-request-id'] as string) || 'unknown',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (fieldErrors) {
      errorResponse.fieldErrors = fieldErrors;
    }

    // Log error without sensitive financial data
    this.logger.error(
      `[${errorResponse.requestId}] ${request.method} ${request.url} → ${status}`,
      status >= 500 && exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(errorResponse);
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMITED',
    };
    return map[status] || 'ERROR';
  }

  private parseValidationErrors(messages: string[]): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    for (const msg of messages) {
      // class-validator format: "property — constraint message"
      const parts = msg.split(' ');
      const field = parts[0] || 'general';
      if (!errors[field]) {
        errors[field] = [];
      }
      errors[field].push(msg);
    }
    return errors;
  }
}
