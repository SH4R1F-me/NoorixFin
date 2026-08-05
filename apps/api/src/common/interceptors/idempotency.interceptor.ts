/**
 * Idempotency for operator writes — §8.3, audit item 16.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────────
 * A user's ledger writes have been replay-safe since 00002: same key twice
 * yields one entry. Operator writes had nothing. The consequence is not
 * theoretical — `POST /admin/broadcasts` creates a row, so a double-click, a
 * proxy retry, or a client that resends after a timeout it wrongly believed was
 * a failure publishes the SAME platform-wide message twice, to every user, with
 * two audit entries that make it look intentional.
 *
 * ── THE TABLE WAS ALREADY THERE ──────────────────────────────────────────────
 * `idempotency_records` was created for exactly this in migration 00002 and
 * never used. It is wired here rather than replaced. Migration 00018 makes it
 * safe to use first — it shipped with RLS disabled and a SELECT grant to
 * `authenticated`, so storing response bodies in it would have made one user's
 * API responses readable by every other.
 *
 * ── THE FOUR OUTCOMES, AND WHY EACH IS WHAT IT IS ────────────────────────────
 *
 *   1. **No record** → reserve the key, run the handler, store the outcome.
 *
 *   2. **A completed record, same payload** → replay the stored response
 *      without running the handler. This is the point of the whole mechanism.
 *
 *   3. **A completed record, DIFFERENT payload** → 422. The caller reused a key
 *      for a different request. Returning the first response would be the worst
 *      available answer: the caller gets a 200 for a change that never
 *      happened, and nothing anywhere records that it did not. Hence the
 *      fingerprint — the unique constraint alone cannot tell these apart.
 *
 *   4. **A reserved but unfinished record** → 409. Two identical requests are
 *      in flight; the first has not returned yet. There is no stored response to
 *      replay and guessing one would be a lie, so say "in progress" and let the
 *      caller retry.
 *
 * ── WHY A FAILED CALL RELEASES ITS KEY ───────────────────────────────────────
 * On a non-2xx the reservation is deleted, so the same key can be used again.
 * The alternative — remembering the failure and replaying it — permanently
 * poisons a key: an operator who hits a 500 from a transient database blip
 * would get that same 500 forever, and the only way out would be inventing a
 * new key, which is exactly the retry the mechanism was supposed to make safe.
 * Idempotency exists to protect against duplicate SUCCESS, not to make failure
 * sticky.
 *
 * ── WHY THE CALLER'S OWN CLIENT ──────────────────────────────────────────────
 * Every statement here runs as the requesting user, so the RLS policy from
 * 00018 is the boundary and a mistake in this file cannot let one actor read or
 * release another's records.
 */
import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of, switchMap, tap } from 'rxjs';
import { Request } from 'express';
import { createHash } from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  IDEMPOTENT_KEY,
  type IdempotentOptions,
} from '../decorators/idempotent.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/** Postgres unique violation — the key was reserved by a concurrent request. */
const UNIQUE_VIOLATION = '23505';

/** Longest key accepted. A key is an identifier, not a payload. */
const MAX_KEY_LENGTH = 255;

type IdempotentRequest = Request & {
  user?: AuthenticatedUser;
  accessToken?: string;
};

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const options = this.reflector.getAllAndOverride<IdempotentOptions>(
      IDEMPOTENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest<IdempotentRequest>();
    const rawKey = request.headers['idempotency-key'];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (!key) {
      if (options.required) {
        // Named as a client error with a fix in the message: an operator
        // hitting this from a script needs to know what to add, not that
        // something was "invalid".
        throw new UnprocessableEntityException({
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message:
            'This endpoint creates a record, so it requires an Idempotency-Key ' +
            'header — a unique value per intended action (a UUID is ideal). ' +
            'Retrying with the same key is safe; it will not create a second one.',
        });
      }
      return next.handle();
    }

    if (key.length > MAX_KEY_LENGTH) {
      throw new UnprocessableEntityException({
        code: 'IDEMPOTENCY_KEY_TOO_LONG',
        message: `Idempotency-Key must be at most ${MAX_KEY_LENGTH} characters.`,
      });
    }

    // Unauthenticated routes have no actor to scope a record to, and the table
    // requires one. Nothing marked @Idempotent() is public today; this is here
    // so that adding one later degrades to "no idempotency" rather than a 500.
    const actorId = request.user?.id;
    const accessToken = request.accessToken;
    if (!actorId || !accessToken) return next.handle();

    // The route TEMPLATE, not the URL: `/admin/broadcasts/:id/publish` rather
    // than a path with the id substituted. Two different broadcasts published
    // with the same key are still the same intended action from the caller's
    // point of view, and the fingerprint below is what distinguishes them.
    const route = `${request.method} ${(request.route as { path?: string } | undefined)?.path ?? request.path}`;
    const keyHash = this.hash(`${actorId}:${route}:${key}`);
    const fingerprint = this.hash(
      JSON.stringify({
        params: request.params ?? {},
        query: request.query ?? {},
        body: (request.body as unknown) ?? null,
      }),
    );

    return from(
      this.reserve(accessToken, actorId, route, keyHash, fingerprint),
    ).pipe(
      switchMap((existing) => {
        if (existing) return of(existing.body);

        return next.handle().pipe(
          tap({
            next: (body) => {
              void this.complete(accessToken, keyHash, body);
            },
            error: (error) => {
              void this.release(accessToken, keyHash, error);
            },
          }),
        );
      }),
    );
  }

  private hash(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  /**
   * Claim the key, or resolve what a prior claim means for this request.
   *
   * Returns `{ body }` when the caller should be handed a stored response, and
   * `null` when the handler should run.
   */
  private async reserve(
    accessToken: string,
    actorId: string,
    route: string,
    keyHash: string,
    fingerprint: string,
  ): Promise<{ body: unknown } | null> {
    const client = this.supabase.getUserClient(accessToken);

    const { error } = await client.from('idempotency_records').insert({
      actor_user_id: actorId,
      route,
      key_hash: keyHash,
      request_fingerprint: fingerprint,
    });

    if (!error) return null;

    if (error.code !== UNIQUE_VIOLATION) {
      // Availability over strictness, deliberately. A degraded idempotency
      // table must not stop an operator from suspending an account during an
      // incident — the risk it protects against is a duplicate, and the risk of
      // failing closed is being unable to act at all. Logged loudly because a
      // silently disabled control is the thing to avoid.
      this.logger.error(
        `Idempotency reservation failed (${error.code ?? 'unknown'}: ${error.message}) — ` +
          `proceeding WITHOUT replay protection for ${route}`,
      );
      return null;
    }

    const { data: record } = await client
      .from('idempotency_records')
      .select('response_status, response_body, request_fingerprint')
      .eq('key_hash', keyHash)
      .maybeSingle();

    // Raced with the prune job, or with a release after a failure. The key is
    // free again, so this is a first attempt.
    if (!record) return null;

    if (
      record.request_fingerprint &&
      record.request_fingerprint !== fingerprint
    ) {
      throw new UnprocessableEntityException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message:
          'This Idempotency-Key was already used for a DIFFERENT request. ' +
          'Replaying the earlier response would report success for a change ' +
          'that never happened. Use a new key.',
      });
    }

    if (record.response_status === null) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_IN_PROGRESS',
        message:
          'An identical request with this key is still being processed. ' +
          'Retry shortly — it will return that request’s result.',
      });
    }

    return { body: record.response_body };
  }

  /** Record the outcome so a later replay has something to return. */
  private async complete(
    accessToken: string,
    keyHash: string,
    body: unknown,
  ): Promise<void> {
    try {
      await this.supabase
        .getUserClient(accessToken)
        .from('idempotency_records')
        .update({
          response_status: 200,
          // JSON round-trip: the handler may return class instances or Dates,
          // and what a replay must reproduce is what the CLIENT received, which
          // is the serialised form.
          response_body: JSON.parse(JSON.stringify(body ?? null)) as never,
        })
        .eq('key_hash', keyHash);
    } catch (error) {
      // The write happened; only the receipt failed. A retry will re-run the
      // handler, which is the pre-existing behaviour rather than a new hazard.
      this.logger.warn(
        `Could not store idempotent response: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  /** Free the key so the caller can genuinely retry. */
  private async release(
    accessToken: string,
    keyHash: string,
    cause: unknown,
  ): Promise<void> {
    try {
      await this.supabase
        .getUserClient(accessToken)
        .from('idempotency_records')
        .delete()
        .eq('key_hash', keyHash);
    } catch (error) {
      this.logger.warn(
        `Could not release idempotency key after ${cause instanceof HttpException ? cause.getStatus() : 'error'}: ` +
          `${error instanceof Error ? error.message : 'unknown'} — a retry with the same key will 409 until it expires`,
      );
    }
  }
}
