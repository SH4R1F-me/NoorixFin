'use client';

import { useEffect, useState, useTransition } from 'react';
import { BellRing, Clock3, Mail, MonitorSmartphone, Save, ShieldCheck } from 'lucide-react';
import {
  saveNotificationPreferences,
  registerWebPushDevice,
  revokeWebPushDevice,
  type Preference,
  type PreferencesPayload,
} from './actions';

const CATEGORIES: Preference['category'][] = [
  'security',
  'budget',
  'goal',
  'recurring',
  'transaction',
  'sync',
  'account',
  'system',
  'operator',
];

const LABELS: Record<string, { title: string; body: string }> = {
  security: { title: 'Security', body: 'New devices, sign-in changes, MFA and session events.' },
  budget: { title: 'Budgets', body: 'Thresholds, overspending and period rollovers.' },
  goal: { title: 'Goals', body: 'Milestones, targets and due contributions.' },
  recurring: { title: 'Recurring', body: 'Upcoming, completed or failed recurring entries.' },
  transaction: { title: 'Transactions', body: 'Reversals and unusual transaction activity.' },
  sync: { title: 'Sync', body: 'Conflicts and changes that need your attention.' },
  account: { title: 'Account', body: 'Exports, deletion requests and account-level changes.' },
  system: { title: 'System', body: 'Maintenance, releases and service announcements.' },
  operator: { title: 'Operator', body: 'Platform alerts. Visible to operators only.' },
};

const defaults: Preference[] = CATEGORIES.map((category) => ({
  category,
  in_app: true,
  push: category !== 'transaction' && category !== 'system',
  email: category === 'security' || category === 'account' || category === 'operator',
  digest: 'NONE',
}));

export default function NotificationPreferencesView({
  initial,
  vapidPublicKey,
}: {
  initial: PreferencesPayload | null;
  vapidPublicKey: string;
}) {
  const [data, setData] = useState<PreferencesPayload>(
    initial ?? {
      preferences: defaults,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
      quiet_hours_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    },
  );
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pushPending, setPushPending] = useState(false);
  const [webPushEnabled, setWebPushEnabled] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker
      .getRegistration('/notification-sw.js')
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setWebPushEnabled(Boolean(subscription)));
  }, []);

  async function toggleWebPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotice({ ok: false, text: 'This browser does not support Web Push.' });
      return;
    }
    if (!vapidPublicKey) {
      setNotice({ ok: false, text: 'Web Push is not configured on this deployment.' });
      return;
    }
    setPushPending(true);
    try {
      const registration = await navigator.serviceWorker.register('/notification-sw.js');
      const existing = await registration.pushManager.getSubscription();
      if (existing && webPushEnabled) {
        const rowId = localStorage.getItem('noorixfin.webPushDeviceRowId');
        if (rowId) await revokeWebPushDevice(rowId);
        await existing.unsubscribe();
        localStorage.removeItem('noorixfin.webPushDeviceRowId');
        setWebPushEnabled(false);
        setNotice({ ok: true, text: 'Web Push disabled on this browser.' });
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission was not granted.');
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(vapidPublicKey),
        }));
      let deviceId = localStorage.getItem('noorixfin.webPushDeviceId');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('noorixfin.webPushDeviceId', deviceId);
      }
      const result = await registerWebPushDevice({
        deviceId,
        subscription: JSON.stringify(subscription),
      });
      if (!result.ok) throw new Error(result.message);
      localStorage.setItem('noorixfin.webPushDeviceRowId', result.deviceRowId);
      setWebPushEnabled(true);
      setNotice({ ok: true, text: 'Web Push enabled on this browser.' });
    } catch (error) {
      setNotice({
        ok: false,
        text: error instanceof Error ? error.message : 'Could not enable Web Push.',
      });
    } finally {
      setPushPending(false);
    }
  }

  function update(category: string, patch: Partial<Preference>) {
    setData((current) => ({
      ...current,
      preferences: current.preferences.map((preference) =>
        preference.category === category ? { ...preference, ...patch } : preference,
      ),
    }));
  }

  function save() {
    setNotice(null);
    startTransition(async () => {
      const result = await saveNotificationPreferences(data);
      setNotice(
        result.ok ? { ok: true, text: 'Preferences saved.' } : { ok: false, text: result.message },
      );
    });
  }

  return (
    <section style={s.page} aria-labelledby="notification-settings-heading">
      <div style={s.header}>
        <div>
          <div style={s.eyebrow}>
            <BellRing size={14} /> DELIVERY CONTROL
          </div>
          <h1 id="notification-settings-heading" style={s.title}>
            Notification preferences
          </h1>
          <p style={s.subtitle}>
            Choose the channels that earn your attention. Security notices remain enabled.
          </p>
        </div>
        <button style={s.save} onClick={save} disabled={pending}>
          <Save size={16} /> {pending ? 'Saving…' : 'Save preferences'}
        </button>
      </div>

      {notice && (
        <div role="status" style={notice.ok ? s.success : s.error}>
          {notice.text}
        </div>
      )}

      <div style={s.pushCard}>
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>Web Push</strong>
          <div style={s.help}>
            Enable this contextually on the browser you want NoorixFin to reach.
          </div>
        </div>
        <button
          type="button"
          style={s.secondary}
          disabled={pushPending}
          onClick={() => void toggleWebPush()}
        >
          <MonitorSmartphone size={15} />{' '}
          {pushPending
            ? 'Updating…'
            : webPushEnabled
              ? 'Disable on this browser'
              : 'Enable on this browser'}
        </button>
      </div>

      <div style={s.quietCard}>
        <div style={s.quietIntro}>
          <Clock3 size={20} color="#a78bfa" />
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Quiet hours</strong>
            <div style={s.help}>
              Push and email wait until morning. Critical notices override this window.
            </div>
          </div>
        </div>
        <label style={s.field}>
          Starts
          <input
            type="time"
            value={data.quiet_hours_start ?? ''}
            onChange={(event) =>
              setData({ ...data, quiet_hours_start: event.target.value || null })
            }
            style={s.input}
          />
        </label>
        <label style={s.field}>
          Ends
          <input
            type="time"
            value={data.quiet_hours_end ?? ''}
            onChange={(event) => setData({ ...data, quiet_hours_end: event.target.value || null })}
            style={s.input}
          />
        </label>
        <label style={{ ...s.field, minWidth: 190 }}>
          Timezone
          <input
            value={data.quiet_hours_tz ?? ''}
            onChange={(event) => setData({ ...data, quiet_hours_tz: event.target.value || null })}
            style={s.input}
          />
        </label>
      </div>

      <div style={s.tableWrap}>
        <div style={s.tableInner}>
          <div style={s.tableHeader}>
            <span>Category</span>
            <span>
              <BellRing size={14} /> In app
            </span>
            <span>
              <MonitorSmartphone size={14} /> Push
            </span>
            <span>
              <Mail size={14} /> Email
            </span>
            <span>Digest</span>
          </div>
          {data.preferences.map((preference) => {
            const locked = preference.category === 'security';
            return (
              <div key={preference.category} style={s.row}>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {LABELS[preference.category].title}
                  </strong>
                  <div style={s.help}>{LABELS[preference.category].body}</div>
                  {locked && (
                    <span style={s.locked}>
                      <ShieldCheck size={12} /> Always on
                    </span>
                  )}
                </div>
                {(['in_app', 'push', 'email'] as const).map((channel) => (
                  <label key={channel} style={s.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={preference[channel]}
                      disabled={locked}
                      onChange={(event) =>
                        update(preference.category, { [channel]: event.target.checked })
                      }
                    />
                    <span>{channel.replace('_', ' ')}</span>
                  </label>
                ))}
                <select
                  aria-label={`${LABELS[preference.category].title} digest`}
                  value={preference.digest}
                  disabled={locked}
                  onChange={(event) =>
                    update(preference.category, {
                      digest: event.target.value as Preference['digest'],
                    })
                  }
                  style={s.select}
                >
                  <option value="NONE">Instant</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 980, margin: '0 auto' },
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    marginBottom: '1.25rem',
  },
  eyebrow: {
    color: 'var(--color-success)',
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '.13em',
  },
  title: { color: 'var(--text-primary)', margin: '.35rem 0 0', fontSize: '1.8rem' },
  subtitle: { color: 'var(--text-secondary)', margin: '.35rem 0 0', fontSize: '.82rem' },
  save: {
    border: 0,
    borderRadius: '.65rem',
    padding: '.65rem .9rem',
    background: 'var(--color-primary-500)',
    color: 'var(--text-on-primary)',
    fontWeight: 750,
    display: 'flex',
    gap: 7,
    alignItems: 'center',
    cursor: 'pointer',
  },
  success: {
    color: 'var(--color-success)',
    border: '1px solid rgba(16,185,129,.3)',
    background: 'rgba(16,185,129,.08)',
    borderRadius: '.7rem',
    padding: '.7rem 1rem',
    marginBottom: '1rem',
  },
  error: {
    color: 'var(--color-error)',
    border: '1px solid rgba(251,113,133,.3)',
    background: 'rgba(251,113,133,.08)',
    borderRadius: '.7rem',
    padding: '.7rem 1rem',
    marginBottom: '1rem',
  },
  quietCard: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '1rem',
    flexWrap: 'wrap',
    padding: '1rem',
    background: 'rgba(139,92,246,.06)',
    border: '1px solid rgba(167,139,250,.25)',
    borderRadius: '1rem',
    marginBottom: '1rem',
  },
  pushCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    padding: '1rem',
    background: 'rgba(16,185,129,.05)',
    border: '1px solid rgba(16,185,129,.24)',
    borderRadius: '1rem',
    marginBottom: '1rem',
  },
  secondary: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--color-success)',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '.55rem',
    padding: '.55rem .7rem',
    cursor: 'pointer',
  },
  quietIntro: { display: 'flex', gap: '.75rem', alignItems: 'flex-start', flex: 1, minWidth: 260 },
  field: { display: 'grid', gap: 5, color: 'var(--text-secondary)', fontSize: '.7rem' },
  input: {
    colorScheme: 'dark',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    borderRadius: '.5rem',
    padding: '.5rem .6rem',
  },
  tableWrap: { border: '1px solid var(--border-primary)', borderRadius: '1rem', overflowX: 'auto' },
  tableInner: { minWidth: 760 },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(250px,1fr) repeat(3,90px) 100px',
    gap: '.75rem',
    padding: '.7rem 1rem',
    background: 'var(--bg-primary)',
    color: 'var(--text-tertiary)',
    fontSize: '.68rem',
    textTransform: 'uppercase',
    letterSpacing: '.08em',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(250px,1fr) repeat(3,90px) 100px',
    gap: '.75rem',
    alignItems: 'center',
    padding: '1rem',
    borderTop: '1px solid var(--border-primary)',
    background: 'var(--bg-input)',
  },
  help: { color: 'var(--text-tertiary)', fontSize: '.72rem', marginTop: 3, lineHeight: 1.4 },
  locked: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    color: 'var(--color-warning)',
    fontSize: '.65rem',
  },
  toggleLabel: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    color: 'var(--text-secondary)',
    fontSize: '.7rem',
    textTransform: 'capitalize',
  },
  select: {
    colorScheme: 'dark',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '.45rem',
    padding: '.45rem',
  },
};

function decodeVapidKey(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}
