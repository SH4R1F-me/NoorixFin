/**
 * Health Controller — public probes.
 * Blueprint §11.1; audit gaps R5, R6.
 *
 * Three routes, because an orchestrator asks three different questions and the
 * previous single `/health` could only answer the easiest one:
 *
 *   GET /health       cheap liveness. Unchanged, and deliberately so — it is
 *                     the documented contract and existing deployments,
 *                     `ARCHITECTURE.md` and the e2e suite all point at it.
 *   GET /health/live  the same answer under the conventional name.
 *   GET /health/ready dependency probes; **503 when not ready**, so a load
 *                     balancer stops routing instead of sending traffic into
 *                     a replica that cannot serve it.
 *
 * All three are `@Public()`. A probe that needs a token is a probe that fails
 * during exactly the incident it exists to detect.
 */
import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ReadinessService } from './readiness.service';

const VERSION = process.env.npm_package_version || '0.1.0';

@ApiTags('Health')
@Controller('health')
// Infrastructure probes must remain observable during request floods. Applying
// a per-IP user budget here can make a healthy replica look dead to a cluster
// with several concurrent probes and prevents meaningful baseline load gates.
@SkipThrottle({ short: true, medium: true, long: true })
export class HealthController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Liveness probe — process is up. Touches no dependency.',
  })
  @ApiOkResponse({
    description: 'Service is alive',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2026-08-01T00:00:00.000Z' },
        version: { type: 'string', example: '0.1.0' },
      },
    },
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: VERSION,
    };
  }

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness probe (alias of GET /health)' })
  live() {
    return this.check();
  }

  @Get('ready')
  @Public()
  @ApiOperation({
    summary: 'Readiness probe — checks database and auth. 503 when not ready.',
  })
  @ApiOkResponse({ description: 'Every dependency answered' })
  @ApiServiceUnavailableResponse({
    description: 'A dependency is failing, or the process is draining',
  })
  async ready(@Res({ passthrough: true }) response: Response) {
    const report = await this.readiness.check();

    // The status CODE is the part orchestrators read; the body is for humans
    // reading a terminal. Returning 200 with `status: "not_ready"` would be a
    // probe that never fails, which is worse than having no probe at all.
    response.status(
      report.status === 'ready'
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return { ...report, version: VERSION };
  }
}
