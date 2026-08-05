/**
 * Audit trail — who did what to which resource.
 *
 * Distinct from Monitoring: this is the security/business record (retained
 * indefinitely, survives account deletion), not operational telemetry (pruned on
 * a retention window). Filters are server-side because the trail is unbounded
 * and paging it into the browser to filter locally would not scale.
 */
import { ScrollText } from 'lucide-react';
import { getAudit } from '../../../lib/admin';
import { Badge, EmptyState, ErrorState, Panel, T, formatTime, s } from '../ui';

const PAGE_SIZE = 50;

/** Colour by blast radius, so destructive actions stand out when scanning. */
function actionColor(action: string): string {
  if (action.includes('PURGED') || action.includes('SUSPENDED') || action.includes('DELETION'))
    return T.error;
  if (action.includes('SUPER_ADMIN') || action.includes('SETTINGS')) return T.warn;
  if (action.includes('REINSTATED') || action.includes('CANCELLED')) return T.ok;
  return T.info;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; resourceType?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  const audit = await getAudit({
    action: params.action,
    resourceType: params.resourceType,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = audit.ok ? Math.max(1, Math.ceil(audit.data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <div style={s.pageHeader}>
        <h1 style={s.title}>Audit Trail</h1>
        <p style={s.subtitle}>
          Every operator action and account-lifecycle event. Append-only — these rows outlive the
          accounts they describe.
        </p>
      </div>

      <Panel
        title="Events"
        icon={<ScrollText size={16} color={T.accent} />}
        padded={false}
        actions={
          <form style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              name="action"
              defaultValue={params.action ?? ''}
              placeholder="Action, e.g. ADMIN_USER_SUSPENDED"
              style={{ ...s.input, minWidth: 240 }}
            />
            <input
              name="resourceType"
              defaultValue={params.resourceType ?? ''}
              placeholder="Resource type"
              style={{ ...s.input, width: 140 }}
            />
            <button type="submit" style={s.btn}>
              Filter
            </button>
          </form>
        }
      >
        {!audit.ok ? (
          <div style={{ padding: '1.25rem' }}>
            <ErrorState error={audit.error} />
          </div>
        ) : audit.data.items.length === 0 ? (
          <EmptyState text="No audit events match this filter." />
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Time</th>
                  <th style={s.th}>Action</th>
                  <th style={s.th}>Resource</th>
                  <th style={s.th}>Actor</th>
                  <th style={s.th}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.items.map((event) => (
                  <tr key={event.id}>
                    <td style={{ ...s.td, ...s.mono, whiteSpace: 'nowrap' }}>
                      {formatTime(event.created_at)}
                    </td>
                    <td style={s.td}>
                      <Badge text={event.action} color={actionColor(event.action)} />
                    </td>
                    <td style={{ ...s.td, ...s.mono }}>
                      {event.resource_type}
                      {event.resource_id && (
                        <div style={{ color: T.textFaint }}>
                          {event.resource_id.slice(0, 8)}…
                        </div>
                      )}
                    </td>
                    <td style={{ ...s.td, ...s.mono }}>
                      {/* Null actor is not corruption — it is a deleted account
                          whose audit rows were deliberately preserved. */}
                      {event.actor_id ? (
                        `${event.actor_id.slice(0, 8)}…`
                      ) : (
                        <span style={{ color: T.textFaint }}>deleted account</span>
                      )}
                    </td>
                    <td style={{ ...s.td, ...s.mono, maxWidth: 380, wordBreak: 'break-word' }}>
                      {Object.keys(event.metadata ?? {}).length > 0
                        ? JSON.stringify(event.metadata)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {audit.ok && audit.data.total > PAGE_SIZE && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '1rem',
            color: T.textFaint,
            fontSize: '0.8125rem',
          }}
        >
          <span>
            Page {page} of {totalPages} · {audit.data.total} events
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {page > 1 && (
              <a href={buildHref(params, page - 1)} style={s.btnGhost}>
                ← Previous
              </a>
            )}
            {page < totalPages && (
              <a href={buildHref(params, page + 1)} style={s.btnGhost}>
                Next →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildHref(
  params: { action?: string; resourceType?: string },
  page: number,
): string {
  const search = new URLSearchParams();
  if (params.action) search.set('action', params.action);
  if (params.resourceType) search.set('resourceType', params.resourceType);
  search.set('page', String(page));
  return `/admin/audit?${search.toString()}`;
}
