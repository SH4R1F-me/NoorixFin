/**
 * Marks a route as replay-safe via an `Idempotency-Key` header.
 *
 * See `IdempotencyInterceptor` for the mechanism. The decorator is separate so
 * a route's contract is visible where the route is declared — an operator
 * reading the controller can see which writes are safe to retry without
 * following an interceptor's metadata lookup.
 */
import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'noorixfin:idempotent';

export interface IdempotentOptions {
  /**
   * Refuse the request outright when no key is supplied.
   *
   * Reserved for writes where a retry CREATES something — those are the only
   * ones where the absence of a key is itself a defect. For a write that sets
   * a field to a value, a replay is harmless and demanding a key would be
   * ceremony.
   */
  required?: boolean;
}

export const Idempotent = (options: IdempotentOptions = {}) =>
  SetMetadata(IDEMPOTENT_KEY, options);
