'use client';

/**
 * User management table + detail drawer.
 *
 * THE THING TO NOTICE: there is no column, field or drawer section here for a
 * balance, a transaction, a payee or a note — and there is no way to add one,
 * because the API and the database will not return them. The notice in the
 * drawer says so explicitly, so an operator never wonders whether they are
 * missing a permission.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Ban,
  Check,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import type { AdminUser } from '../../../lib/admin';
import { Badge, EmptyState, STATUS_COLOR, T, formatTime, s } from '../ui';
import { reinstateUser, runPurge, suspendUser, updateUserProfile } from './actions';

export default function UsersView({
  users,
  total,
  search,
  status,
  pendingDeletionCount,
}: {
  users: AdminUser[];
  total: number;
  search: string;
  status: string;
  pendingDeletionCount: number;
}) {
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function act(fn: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setMessage({ ok: true, text: success });
        setSelected(null);
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.message ?? 'Action failed' });
      }
    });
  }

  return (
    <div>
      <div style={s.pageHeader}>
        <h1 style={s.title}>User Management</h1>
        <p style={s.subtitle}>
          Platform metadata and activity counts. Financial data is not accessible to operators.
        </p>
      </div>

      {message && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.6rem',
            fontSize: '0.8125rem',
            background: message.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${message.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: message.ok ? T.ok : T.error,
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ ...s.panel, marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.6rem',
            alignItems: 'center',
            padding: '0.875rem 1.25rem',
          }}
        >
          <form style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: 260 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: T.textFaint }} />
              <input
                name="search"
                defaultValue={search}
                placeholder="Search by email or display name"
                style={{ ...s.input, width: '100%', paddingLeft: '2rem' }}
              />
            </div>
            {/* Icon-only filter beside a search box — no visible label, so it needs
                its own name. axe reported this as the console's one nameless
                control. */}
            <select
              name="status"
              defaultValue={status}
              style={s.input}
              aria-label="Filter by account status"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="PENDING_DELETION">Pending deletion</option>
            </select>
            <button type="submit" style={s.btn}>
              Search
            </button>
          </form>

          {pendingDeletionCount > 0 && (
            <button
              onClick={() => {
                if (
                  !confirm(
                    `Permanently delete all accounts whose 30-day grace period has expired?\n\nThis is IRREVERSIBLE and removes every ledger row those accounts own.`,
                  )
                )
                  return;
                act(runPurge, 'Purge complete.');
              }}
              disabled={pending}
              style={s.btnDanger}
              title="Runs deletions for expired grace periods only"
            >
              <Trash2 size={13} />
              Run purge ({pendingDeletionCount} pending)
            </button>
          )}
        </div>
      </div>

      <div style={s.panel}>
        <div style={s.panelHeader}>
          <span style={s.panelTitle}>Users</span>
          <span style={{ color: T.textFaint, fontSize: '0.75rem' }}>{total} total</span>
        </div>

        {users.length === 0 ? (
          <EmptyState text="No users match this filter." />
        ) : (
          <div
            style={s.tableWrap}
            // Scrolls horizontally, so it must be reachable by keyboard.
            tabIndex={0}
            role="region"
            aria-label="Users table, scrollable"
          >
            <table style={s.table}>
              <thead>
                <tr>
                  <th scope="col" style={s.th}>User</th>
                  <th scope="col" style={s.th}>Status</th>
                  <th scope="col" style={s.th}>Joined</th>
                  <th scope="col" style={s.th}>Last sign-in</th>
                  <th scope="col" style={s.th}>Workspaces</th>
                  <th scope="col" style={s.th}>Accounts</th>
                  <th scope="col" style={s.th}>Entries</th>
                  <th scope="col" style={s.th}>Sign-in methods</th>
                  <th scope="col" style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.user_id}>
                    <td style={s.td}>
                      <div style={{ color: T.text, fontWeight: 500 }}>
                        {user.display_name || '(no name)'}
                        {user.is_super_admin && (
                          <span style={{ marginLeft: 6 }}>
                            <Badge text="OPERATOR" color={T.accent} />
                          </span>
                        )}
                      </div>
                      <div style={{ color: T.textFaint, fontSize: '0.75rem' }}>{user.email}</div>
                    </td>
                    <td style={s.td}>
                      <Badge
                        text={user.status.replace('_', ' ')}
                        color={STATUS_COLOR[user.status] ?? T.textDim}
                      />
                      {user.deletion_scheduled_for && (
                        <div style={{ color: T.error, fontSize: '0.6875rem', marginTop: 3 }}>
                          purge {formatTime(user.deletion_scheduled_for).slice(0, 10)}
                        </div>
                      )}
                    </td>
                    <td style={{ ...s.td, ...s.mono, whiteSpace: 'nowrap' }}>
                      {formatTime(user.created_at).slice(0, 10)}
                    </td>
                    <td style={{ ...s.td, ...s.mono, whiteSpace: 'nowrap' }}>
                      {user.last_sign_in_at ? formatTime(user.last_sign_in_at).slice(0, 16) : 'never'}
                    </td>
                    <td style={{ ...s.td, ...s.mono }}>{user.workspace_count}</td>
                    <td style={{ ...s.td, ...s.mono }}>{user.account_count}</td>
                    <td style={{ ...s.td, ...s.mono }}>{user.entry_count}</td>
                    <td style={{ ...s.td, ...s.mono }}>{user.provider_count}</td>
                    <td style={s.td}>
                      <button onClick={() => setSelected(user)} style={s.btnGhost}>
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <UserDrawer
          user={selected}
          pending={pending}
          onClose={() => setSelected(null)}
          onSuspend={(reason) =>
            act(() => suspendUser(selected.user_id, reason), `${selected.email} suspended.`)
          }
          onReinstate={() =>
            act(() => reinstateUser(selected.user_id), `${selected.email} reinstated.`)
          }
          onSave={(fields) =>
            act(() => updateUserProfile(selected.user_id, fields), 'Profile updated.')
          }
        />
      )}
    </div>
  );
}

function UserDrawer({
  user,
  pending,
  onClose,
  onSuspend,
  onReinstate,
  onSave,
}: {
  user: AdminUser;
  pending: boolean;
  onClose: () => void;
  onSuspend: (reason: string) => void;
  onReinstate: () => void;
  onSave: (fields: { display_name: string; locale: string; timezone: string }) => void;
}) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [locale, setLocale] = useState(user.locale);
  const [timezone, setTimezone] = useState(user.timezone);
  const [reason, setReason] = useState('');

  return (
    <div style={drawer.overlay} onClick={onClose}>
      <div style={drawer.panel} onClick={(event) => event.stopPropagation()}>
        <div style={drawer.header}>
          <div>
            <div style={{ color: T.text, fontWeight: 700, fontSize: '1rem' }}>
              {user.display_name || '(no name)'}
            </div>
            <div style={{ color: T.textFaint, fontSize: '0.8125rem' }}>{user.email}</div>
          </div>
          <button onClick={onClose} style={{ ...s.btnGhost, padding: '0.35rem' }} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div style={drawer.body}>
          {/* Stated plainly so an operator does not go hunting for a permission
              that deliberately does not exist. */}
          <div style={drawer.privacyNotice}>
            <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Balances, transactions, payees and notes for this user are <strong>not
              accessible</strong> to operators — row-level security blocks them at the database.
              Only the counts below are visible.
            </span>
          </div>

          <div style={drawer.statRow}>
            <Stat label="Workspaces" value={user.workspace_count} />
            <Stat label="Accounts" value={user.account_count} />
            <Stat label="Entries" value={user.entry_count} />
            <Stat label="Providers" value={user.provider_count} />
          </div>

          <dl style={drawer.meta}>
            <MetaRow label="Status" value={user.status.replace('_', ' ')} />
            <MetaRow label="Joined" value={formatTime(user.created_at)} />
            <MetaRow label="Last sign-in" value={formatTime(user.last_sign_in_at)} />
            <MetaRow label="Email confirmed" value={formatTime(user.email_confirmed_at)} />
            <MetaRow label="Last activity" value={formatTime(user.last_entry_at)} />
            {user.suspended_reason && (
              <MetaRow label="Suspension reason" value={user.suspended_reason} />
            )}
            {user.deletion_scheduled_for && (
              <MetaRow label="Scheduled purge" value={formatTime(user.deletion_scheduled_for)} />
            )}
          </dl>

          <div style={drawer.section}>
            <div style={drawer.sectionTitle}>Editable profile fields</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <label style={drawer.label}>
                Display name
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  style={{ ...s.input, width: '100%' }}
                />
              </label>
              <label style={drawer.label}>
                Locale
                <select
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                  style={{ ...s.input, width: '100%' }}
                >
                  <option value="bn">বাংলা (bn)</option>
                  <option value="en">English (en)</option>
                </select>
              </label>
              <label style={drawer.label}>
                Timezone
                <input
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  style={{ ...s.input, width: '100%' }}
                />
              </label>
              <button
                onClick={() => onSave({ display_name: displayName, locale, timezone })}
                disabled={pending}
                style={s.btn}
              >
                {pending ? <Loader2 size={14} /> : <Check size={14} />}
                Save changes
              </button>
              <p style={{ color: T.textFaint, fontSize: '0.6875rem', margin: 0 }}>
                Operator access is deliberately limited to these three fields. Granting platform
                access is not a console action — it requires a service-role SQL operation.
              </p>
            </div>
          </div>

          <div style={{ ...drawer.section, borderColor: 'rgba(239,68,68,0.25)' }}>
            <div style={{ ...drawer.sectionTitle, color: T.error }}>Account status</div>

            {user.status === 'ACTIVE' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <label style={drawer.label}>
                  Reason (recorded on the audit event)
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="e.g. Terms violation — ticket #412"
                    style={{ ...s.input, width: '100%' }}
                  />
                </label>
                <button
                  onClick={() => onSuspend(reason)}
                  disabled={pending || reason.trim().length < 3}
                  style={{ ...s.btnDanger, opacity: reason.trim().length < 3 ? 0.5 : 1 }}
                >
                  <Ban size={13} />
                  Suspend account
                </button>
                <p style={{ color: T.textFaint, fontSize: '0.6875rem', margin: 0 }}>
                  Blocks sign-in immediately at the auth server. An access token already issued
                  stays valid until it expires (up to 1 hour).
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <button onClick={onReinstate} disabled={pending} style={s.btn}>
                  <RotateCcw size={13} />
                  Reinstate account
                </button>
                <p style={{ color: T.textFaint, fontSize: '0.6875rem', margin: 0 }}>
                  Lifts the ban and cancels any scheduled deletion. No data has been removed while
                  the account was in this state.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: 1, minWidth: 78 }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: T.text }}>{value}</div>
      <div style={{ fontSize: '0.6875rem', color: T.textFaint, textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.3rem 0' }}>
      <dt style={{ color: T.textFaint, fontSize: '0.75rem' }}>{label}</dt>
      <dd style={{ ...s.mono, color: T.textDim, margin: 0, textAlign: 'right' }}>{value}</dd>
    </div>
  );
}

const drawer: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 100,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  panel: {
    width: 'min(480px, 100%)',
    height: '100%',
    background: '#1c1917',
    borderLeft: `1px solid ${T.border}`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '1.25rem',
    borderBottom: `1px solid ${T.border}`,
  },
  body: { padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  privacyNotice: {
    display: 'flex',
    gap: '0.6rem',
    alignItems: 'flex-start',
    padding: '0.75rem 0.9rem',
    background: 'rgba(56,189,248,0.07)',
    border: '1px solid rgba(56,189,248,0.25)',
    borderRadius: '0.6rem',
    color: '#7dd3fc',
    fontSize: '0.75rem',
    lineHeight: 1.5,
  },
  statRow: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' },
  meta: { margin: 0, borderTop: `1px solid ${T.borderSoft}`, paddingTop: '0.6rem' },
  section: {
    border: `1px solid ${T.border}`,
    borderRadius: '0.75rem',
    padding: '1rem',
  },
  sectionTitle: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: T.text,
    marginBottom: '0.75rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    fontSize: '0.75rem',
    color: T.textDim,
  },
};
