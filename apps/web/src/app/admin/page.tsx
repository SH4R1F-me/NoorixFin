/**
 * Admin overview — server component (DEC-012: never optimistic).
 *
 * Stats come from `admin_platform_stats()` in one round trip. The two panels
 * fetch in parallel; either can fail independently and render its own error
 * without taking the page with it.
 */
import {
  Activity,
  AlertTriangle,
  HeartPulse,
  Megaphone,
  ScrollText,
  Users,
} from 'lucide-react';
import { getPlatformStats, getHealthReport, getEvents } from '../../lib/admin';
import {
  Badge,
  EmptyState,
  ErrorState,
  LEVEL_COLOR,
  Panel,
  StatTile,
  T,
  formatTime,
  formatUptime,
  s,
} from './ui';

export default async function AdminOverviewPage() {
  const [stats, health, events] = await Promise.all([
    getPlatformStats(),
    getHealthReport(),
    getEvents({ limit: 8 }),
  ]);

  return (
    <div>
      <div style={s.pageHeader}>
        <h1 style={s.title}>System Overview</h1>
        <p style={s.subtitle}>
          Platform health and activity. No user financial data is accessible from this console.
        </p>
      </div>

      {!stats.ok ? (
        <ErrorState error={stats.error} />
      ) : (
        <>
          <div style={s.grid}>
            <StatTile
              label="Total Users"
              value={stats.data.users.total}
              hint={`${stats.data.users.new_24h} new in 24h · ${stats.data.users.active_7d} active in 7d`}
            />
            <StatTile
              label="Workspaces"
              value={stats.data.workspaces.active}
              hint={`${stats.data.workspaces.total} total`}
              tone={T.info}
            />
            <StatTile
              label="Errors (1h)"
              value={stats.data.events.errors_1h}
              hint={`${stats.data.events.errors_24h} in 24h · ${stats.data.events.warns_24h} warnings`}
              tone={stats.data.events.errors_1h > 0 ? T.error : T.ok}
            />
            <StatTile
              label="API Uptime"
              value={formatUptime(stats.data.api.uptime_seconds)}
              hint={`DB ${stats.data.api.db_latency_ms}ms · v${stats.data.api.version}`}
              tone={T.ok}
            />
          </div>

          <div style={{ ...s.grid, marginTop: '1rem' }}>
            <StatTile
              label="Suspended"
              value={stats.data.users.suspended}
              tone={stats.data.users.suspended > 0 ? T.warn : T.textDim}
            />
            <StatTile
              label="Pending Deletion"
              value={stats.data.users.pending_deletion}
              hint="30-day grace period"
              tone={stats.data.users.pending_deletion > 0 ? T.error : T.textDim}
            />
            <StatTile
              label="Operators"
              value={stats.data.users.super_admins}
              hint="Accounts with platform access"
            />
            <StatTile
              label="Ledger Volume"
              value={stats.data.ledger.entries}
              hint={`${stats.data.ledger.entries_24h} entries in 24h · counts only`}
              tone={T.textDim}
            />
          </div>

          {stats.data.api.telemetry_pending > 20 && (
            <div style={{ marginTop: '1rem' }}>
              <ErrorState
                error={`${stats.data.api.telemetry_pending} telemetry events are buffered but unwritten — the monitoring feed may be incomplete.`}
              />
            </div>
          )}
        </>
      )}

      <div
        className="nf-responsive-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '1rem',
          marginTop: '1.5rem',
        }}
      >
        <Panel
          title="Dependency Health"
          icon={<HeartPulse size={16} color={T.accent} />}
          padded={false}
          actions={
            health.ok ? (
              <Badge
                text={health.data.status.toUpperCase()}
                color={health.data.status === 'healthy' ? T.ok : T.warn}
              />
            ) : undefined
          }
        >
          {!health.ok ? (
            <div style={{ padding: '1.25rem' }}>
              <ErrorState error={health.error} />
            </div>
          ) : (
            <div
              style={s.tableWrap}
              // Scrolls horizontally, so it must be reachable by keyboard.
              tabIndex={0}
              role="region"
              aria-label="Service health table, scrollable"
            >
              <table style={s.table}>
                <thead>
                  <tr>
                    <th scope="col" style={s.th}>Service</th>
                    <th scope="col" style={s.th}>Status</th>
                    <th scope="col" style={s.th}>Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {health.data.checks.map((check) => (
                    <tr key={check.name}>
                      <td style={{ ...s.td, color: T.text, textTransform: 'capitalize' }}>
                        {check.name}
                      </td>
                      <td style={s.td}>
                        <Badge
                          text={check.ok ? 'UP' : 'DOWN'}
                          color={check.ok ? T.ok : T.error}
                        />
                        {check.error && (
                          <div style={{ ...s.mono, color: T.error, marginTop: 4 }}>
                            {check.error}
                          </div>
                        )}
                      </td>
                      <td style={{ ...s.td, ...s.mono }}>{check.latency_ms}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="Recent Events"
          icon={<Activity size={16} color={T.accent} />}
          padded={false}
          actions={
            <a href="/admin/monitoring" style={s.btnGhost}>
              Live feed →
            </a>
          }
        >
          {!events.ok ? (
            <div style={{ padding: '1.25rem' }}>
              <ErrorState error={events.error} />
            </div>
          ) : events.data.items.length === 0 ? (
            <EmptyState text="No system events recorded yet." />
          ) : (
            <div
              style={s.tableWrap}
              // Scrolls horizontally, so it must be reachable by keyboard.
              tabIndex={0}
              role="region"
              aria-label="Recent events table, scrollable"
            >
              <table style={s.table}>
                <tbody>
                  {events.data.items.map((event) => (
                    <tr key={event.id}>
                      <td style={{ ...s.td, width: 1 }}>
                        <Badge
                          text={event.level}
                          color={LEVEL_COLOR[event.level] ?? T.textDim}
                        />
                      </td>
                      <td style={s.td}>
                        <div style={{ color: T.text, fontWeight: 500 }}>{event.event_code}</div>
                        <div style={{ color: T.textFaint, fontSize: '0.75rem' }}>
                          {event.message.slice(0, 90)}
                        </div>
                      </td>
                      <td style={{ ...s.td, ...s.mono, whiteSpace: 'nowrap' }}>
                        {formatTime(event.created_at).slice(11)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginTop: '1rem',
        }}
      >
        <a href="/admin/users" style={{ textDecoration: 'none' }}>
          <div style={{ ...s.panel, padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Users size={20} color={T.accent} />
            <div>
              <div style={{ color: T.text, fontWeight: 600, fontSize: '0.875rem' }}>User Management</div>
              <div style={{ color: T.textFaint, fontSize: '0.75rem' }}>Metadata and activity, no finances</div>
            </div>
          </div>
        </a>
        <a href="/admin/audit" style={{ textDecoration: 'none' }}>
          <div style={{ ...s.panel, padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <ScrollText size={20} color={T.accent} />
            <div>
              <div style={{ color: T.text, fontWeight: 600, fontSize: '0.875rem' }}>Audit Trail</div>
              <div style={{ color: T.textFaint, fontSize: '0.75rem' }}>
                {stats.ok
                  ? `${stats.data.audit.last_24h} actions in 24h` : 'Every operator action'}
              </div>
            </div>
          </div>
        </a>
        <a href="/admin/broadcasts" style={{ textDecoration: 'none' }}>
          <div style={{ ...s.panel, padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Megaphone size={20} color={T.accent} />
            <div>
              <div style={{ color: T.text, fontWeight: 600, fontSize: '0.875rem' }}>Broadcasts</div>
              <div style={{ color: T.textFaint, fontSize: '0.75rem' }}>
                {stats.ok
                  ? `${stats.data.broadcasts.published} live · ${stats.data.broadcasts.draft} draft`
                  : 'Message all users'}
              </div>
            </div>
          </div>
        </a>
      </div>

      <div
        style={{
          marginTop: '1.5rem',
          padding: '0.875rem 1.1rem',
          border: `1px solid ${T.border}`,
          borderRadius: '0.75rem',
          color: T.textFaint,
          fontSize: '0.75rem',
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'flex-start',
        }}
      >
        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Operator access is platform metadata only. Balances, transactions, payees and notes are
          unreadable from this console — enforced by row-level security in the database, not by this
          page hiding them.
        </span>
      </div>
    </div>
  );
}
