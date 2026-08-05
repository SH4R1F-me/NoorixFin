/**
 * IdentityThrottlerGuard — the tracker, which is the whole point of the class.
 *
 * The case that matters is the third one. Keying on an UNVERIFIED `sub` would
 * hand every caller an unlimited budget: mint a new token, get a new bucket.
 * That is worse than the IP default it replaces, so a regression here is not a
 * degraded limit — it is no limit at all, and it would look identical from the
 * outside to a working one.
 */
import { Reflector } from '@nestjs/core';
import { IdentityThrottlerGuard } from './identity-throttler.guard';
import type {
  JwtVerifierService,
  SupabaseJwtClaims,
} from '../../auth/jwt-verifier.service';
import type { ThrottlerStorage } from '@nestjs/throttler';

/** Exposes the protected tracker without loosening it in the class itself. */
class Probe extends IdentityThrottlerGuard {
  track(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
}

function makeGuard(verify: (token: string) => Promise<SupabaseJwtClaims>) {
  return new Probe([], {} as ThrottlerStorage, new Reflector(), {
    verify,
  } as unknown as JwtVerifierService);
}

const request = (authorization?: string, ip = '10.0.0.1') => ({
  ip,
  headers: authorization ? { authorization } : {},
});

describe('IdentityThrottlerGuard', () => {
  it('keys on the user when the token verifies', async () => {
    const guard = makeGuard(() =>
      Promise.resolve({ sub: 'user-1' } as SupabaseJwtClaims),
    );
    await expect(guard.track(request('Bearer good'))).resolves.toBe(
      'user:user-1',
    );
  });

  it('gives two users behind one IP separate buckets', async () => {
    const guard = makeGuard((token) =>
      Promise.resolve({
        sub: token === 'a' ? 'user-a' : 'user-b',
      } as SupabaseJwtClaims),
    );
    const a = await guard.track(request('Bearer a'));
    const b = await guard.track(request('Bearer b'));
    expect(a).not.toBe(b);
  });

  it('falls back to the IP when the token does not verify', async () => {
    // A forged token must NOT buy a fresh bucket, however plausible its claims.
    const guard = makeGuard(() => Promise.reject(new Error('bad signature')));
    await expect(guard.track(request('Bearer forged'))).resolves.toBe(
      'ip:10.0.0.1',
    );
  });

  it('falls back to the IP for an unauthenticated request', async () => {
    const guard = makeGuard(() => Promise.reject(new Error('never called')));
    await expect(guard.track(request())).resolves.toBe('ip:10.0.0.1');
  });

  it('ignores a non-Bearer scheme rather than treating it as a token', async () => {
    const guard = makeGuard(() => Promise.reject(new Error('never called')));
    await expect(guard.track(request('Basic abc'))).resolves.toBe(
      'ip:10.0.0.1',
    );
  });

  it('falls back to the IP when a verified token somehow carries no subject', async () => {
    const guard = makeGuard(() => Promise.resolve({} as SupabaseJwtClaims));
    await expect(guard.track(request('Bearer subjectless'))).resolves.toBe(
      'ip:10.0.0.1',
    );
  });

  it('does not crash when express reports no ip at all', async () => {
    const guard = makeGuard(() => Promise.reject(new Error('anonymous')));
    await expect(guard.track({ headers: {} })).resolves.toBe('ip:unknown');
  });
});
