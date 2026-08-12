/**
 * The OpenAPI document, built in one place.
 *
 * Two callers need it and they must not drift: `main.ts` serves it at
 * `/api/docs`, and `scripts/generate-openapi.ts` writes it to disk for
 * `@noorixfin/api-client` to generate from. If each built its own document,
 * the generated client would eventually describe an API the running server
 * does not serve — which is worse than the hand-written clients it replaces,
 * because it would look authoritative.
 */
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { API_ERROR_CODES } from '@noorixfin/domain';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('NoorixFin API')
    .setDescription(
      'Personal and household finance management API. ' +
        'All financial amounts are minor-unit decimal strings. ' +
        'All timestamps are ISO 8601 UTC. ' +
        'Every failure body matches the `ApiErrorBody` schema; branch on its ' +
        '`code`, never on `message`.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase access token',
      },
      'supabase-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Publish the error catalogue into the document (audit gap A5).
  //
  // Without this, `code` generates as a bare `string` in every client, so the
  // one field a caller most wants to branch on carries no type information at
  // all. Injected after createDocument rather than declared per-route: these
  // codes are cross-cutting, and repeating an @ApiResponse on ~70 handlers
  // would be a list that goes stale the first time someone forgets one.
  document.components = document.components ?? {};
  document.components.schemas = {
    ...document.components.schemas,
    ApiErrorBody: {
      type: 'object',
      description:
        'The shape of every failure, produced by GlobalHttpExceptionFilter. ' +
        '`code` is the stable identifier — branch on it, not on `message`, ' +
        'which is prose and may be reworded or translated.',
      required: [
        'statusCode',
        'code',
        'message',
        'requestId',
        'timestamp',
        'path',
      ],
      properties: {
        statusCode: { type: 'integer', example: 404 },
        code: {
          type: 'string',
          enum: [...API_ERROR_CODES],
          example: 'TRANSACTION_NOT_FOUND',
        },
        message: { type: 'string' },
        requestId: {
          type: 'string',
          description:
            'Echo of X-Request-ID — quote it when reporting a failure.',
        },
        timestamp: { type: 'string', format: 'date-time' },
        path: { type: 'string' },
        fieldErrors: {
          type: 'object',
          nullable: true,
          additionalProperties: { type: 'array', items: { type: 'string' } },
          description: 'Present only on validation failures.',
        },
      },
    },
  };

  return document;
}
