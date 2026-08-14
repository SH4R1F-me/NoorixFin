import request from 'supertest';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080';

/**
 * Black-box tests against the built, bootstrapped Nest application. This is
 * deliberately not a TestingModule: the production body parser, versioning,
 * middleware, filters, guards, and graceful-start path are the contract under
 * test, and recreating them in Jest was the stale scaffold's original flaw.
 */
describe('NoorixFin application boundary (e2e)', () => {
  it('serves the real versioned liveness contract and trace headers', async () => {
    const response = await request(API_URL)
      .get('/v1/health')
      .set('X-Request-ID', 'api-e2e-health')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('api-e2e-health');
    expect(response.headers.traceparent).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/,
    );
    const body = response.body as unknown as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(typeof body.version).toBe('string');
    expect(typeof body.timestamp).toBe('string');
  });

  it('protects authenticated routes with the production error envelope', async () => {
    const response = await request(API_URL)
      .get('/v1/me')
      .set('X-Request-ID', 'api-e2e-auth')
      .expect(401);

    expect(response.body as unknown).toEqual(
      expect.objectContaining({
        statusCode: 401,
        code: 'MISSING_TOKEN',
        requestId: 'api-e2e-auth',
        path: '/v1/me',
      }),
    );
    expect(response.body as unknown).not.toHaveProperty('stack');
  });

  it('does not expose the removed Nest starter route', async () => {
    await request(API_URL).get('/').expect(404);
  });
});
