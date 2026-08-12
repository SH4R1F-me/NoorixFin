/**
 * Client Context Middleware — audit gap R3.
 *
 * Every API client (web, iOS, Android, raw API) sends a structured header so
 * the monitoring layer can distinguish them:
 *
 *   X-Client-Info: platform=ios; app_version=1.4.2; build=142; os=17.4; device_id=<uuid>
 *
 * `device_id` is an opaque, app-generated UUID stored in SecureStore on mobile
 * and in sessionStorage on web. It is NOT an advertising ID or hardware serial
 * — it is rotated on reinstall and on explicit "reset device identity". The
 * operator sees it as a join key; it has no meaning outside NoorixFin.
 *
 * If the header is absent the context is `null`. Every downstream consumer
 * (LoggingInterceptor, AuditService) handles the null case by leaving the
 * corresponding columns empty — there is no breaking change to existing clients
 * that do not yet send the header.
 *
 * Platform is also inferred from User-Agent as a fallback so the web app does
 * not need to send the header explicitly on every SSR request.
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export type ClientPlatform = 'web' | 'ios' | 'android' | 'api';

export interface ClientContext {
  platform: ClientPlatform;
  appVersion: string | null;
  buildNumber: string | null;
  osVersion: string | null;
  deviceId: string | null;
  userAgent: string | null;
}

/** Widened request that carries the parsed context for downstream consumers. */
export interface ClientContextRequest extends Request {
  clientContext: ClientContext | null;
}

/** Semver-ish: digits, dots, hyphens. Anything else is discarded. */
const VERSION_RE = /^[\d.\-a-zA-Z]+$/;
/** UUID v4 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitise(value: string | undefined, maxLen: number): string | null {
  if (!value) return null;
  const v = value.slice(0, maxLen).trim();
  return v || null;
}

/**
 * Parse `X-Client-Info: key=value; key=value; ...`
 * Unknown keys are silently ignored so future clients can add fields without
 * breaking older API versions.
 */
function parseClientInfo(raw: string): Partial<{
  platform: string;
  app_version: string;
  build: string;
  os: string;
  device_id: string;
}> {
  const result: Record<string, string> = {};
  for (const segment of raw.split(';')) {
    const eq = segment.indexOf('=');
    if (eq < 1) continue;
    const key = segment.slice(0, eq).trim().toLowerCase();
    const val = segment.slice(eq + 1).trim();
    if (key && val) result[key] = val;
  }
  return result;
}

function inferPlatform(
  declared: string | undefined,
  userAgent: string | null,
): ClientPlatform {
  const d = declared?.toLowerCase();
  if (d === 'ios') return 'ios';
  if (d === 'android') return 'android';
  if (d === 'web') return 'web';
  if (d === 'api') return 'api';

  // UA fallback for web app server-side requests that do not send the header.
  if (userAgent) {
    const ua = userAgent.toLowerCase();
    if (
      ua.includes('iphone') ||
      ua.includes('ipad') ||
      ua.includes('cfnetwork')
    )
      return 'ios';
    if (ua.includes('android')) return 'android';
    if (
      ua.includes('mozilla') ||
      ua.includes('chrome') ||
      ua.includes('safari')
    )
      return 'web';
  }
  return 'api';
}

@Injectable()
export class ClientContextMiddleware implements NestMiddleware {
  use(req: ClientContextRequest, _res: Response, next: NextFunction) {
    const raw = req.headers['x-client-info'] as string | undefined;
    const ua = req.headers['user-agent'] ?? null;

    if (!raw) {
      // Still infer platform from UA so SSR web requests are tagged 'web'.
      req.clientContext = {
        platform: inferPlatform(undefined, ua),
        appVersion: null,
        buildNumber: null,
        osVersion: null,
        deviceId: null,
        userAgent: ua,
      };
    } else {
      const parsed = parseClientInfo(raw);
      const rawDeviceId = sanitise(parsed.device_id, 36);
      const deviceId =
        rawDeviceId && UUID_RE.test(rawDeviceId) ? rawDeviceId : null;
      const rawVersion = sanitise(parsed.app_version, 32);
      const appVersion =
        rawVersion && VERSION_RE.test(rawVersion) ? rawVersion : null;

      req.clientContext = {
        platform: inferPlatform(parsed.platform, ua),
        appVersion,
        buildNumber: sanitise(parsed.build, 16),
        osVersion: sanitise(parsed.os, 16),
        deviceId,
        userAgent: ua ? ua.slice(0, 512) : null,
      };
    }

    next();
  }
}
