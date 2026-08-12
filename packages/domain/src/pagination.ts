/**
 * The standard list envelope (audit gap A2).
 *
 * List endpoints currently return several different shapes — a bare array in
 * some places, `{ events, nextCursor }` in others — so every client writes a
 * bespoke unwrapper per endpoint. This is the one shape new endpoints use, and
 * the shape existing ones move to when they are next touched.
 *
 * **Cursor, not offset.** `LIMIT ... OFFSET n` makes the database walk and
 * discard n rows, so page 500 costs 500 pages of work; and a row inserted
 * during paging shifts every subsequent page, so a client either sees an item
 * twice or misses it. Neither is acceptable on a ledger, and `system_events`
 * under the telemetry work in Phase 2 is exactly the table where offset paging
 * would fall over first.
 *
 * The cursor is opaque **by contract**. Clients must treat it as a bare token
 * and never parse it: the moment one decodes it, the server can no longer
 * change what it encodes without breaking that client.
 */

/**
 * The field names are snake_case and the array is `items`, because that is
 * what `GET /workspaces/:id/transactions` and `GET /workspaces/:id/sync`
 * already return. The audit proposed `{ data, cursor, has_more }`; adopting it
 * would have renamed fields on two shipped endpoints and broken both clients
 * to gain nothing but a different word for the same thing. Standardising on
 * the shape that already exists is the cheaper half of the same outcome.
 */
export interface Page<T> {
  items: T[];
  /**
   * Pass back as `?cursor=` to fetch the next page. `null` means this is the
   * last page — the same information as `has_more`, kept alongside it so a
   * caller can drive a loop from either without a second lookup.
   */
  next_cursor: string | null;
  has_more: boolean;
}

/** Query parameters every paginated endpoint accepts. */
export interface PageQuery {
  cursor?: string;
  limit?: number;
}

export const PAGE_LIMIT_DEFAULT = 50;
export const PAGE_LIMIT_MAX = 200;

/**
 * Clamp a caller-supplied limit into the allowed range.
 *
 * A rejected out-of-range limit would be defensible, but this is a value a
 * client usually gets wrong by omission rather than intent, and failing the
 * whole request over it helps nobody. Non-numeric and negative values fall
 * back to the default rather than to zero, because a limit of zero returns an
 * empty page forever and reads exactly like an empty account.
 */
export function clampLimit(limit: unknown): number {
  const parsed = typeof limit === 'string' ? Number(limit) : limit;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed < 1) {
    return PAGE_LIMIT_DEFAULT;
  }
  return Math.min(Math.floor(parsed), PAGE_LIMIT_MAX);
}

/**
 * Build a page from `limit + 1` rows.
 *
 * Over-fetching one row is how `has_more` is answered without a second COUNT
 * query — and a COUNT on a growing table is the expensive half of most
 * paginated endpoints. The extra row is dropped, never returned.
 */
export function toPage<T>(
  rows: T[],
  limit: number,
  cursorOf: (row: T) => string,
): Page<T> {
  const has_more = rows.length > limit;
  const items = has_more ? rows.slice(0, limit) : rows;
  return {
    items,
    next_cursor:
      has_more && items.length > 0 ? cursorOf(items[items.length - 1]!) : null,
    has_more,
  };
}
