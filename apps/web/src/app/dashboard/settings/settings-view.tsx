'use client';

/**
 * Profile Settings.
 *
 * Replaces a page where every control was local `useState` and nothing
 * persisted — the Save button set a "Saved!" label and wrote nothing, and the
 * Security and Danger Zone rows were decorative chevrons. Everything here now
 * reaches a real endpoint, and controls that genuinely have no backend yet say
 * so instead of pretending.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Download,
  Globe,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Save,
  Shield,
  Trash2,
  Unlink,
  User,
} from 'lucide-react';
import { savePreferences, requestAccountDeletion } from './actions';
import {
  changePassword,
  linkGoogleIdentity,
  signOut,
  unlinkIdentity,
} from '../../auth/actions';
import { GOOGLE_AUTH_ENABLED, PROVIDER_LABELS, type LinkedIdentity } from '../../../lib/auth-config';
import { useLocale } from '../../../lib/i18n/locale-provider';
import type { SessionProfile } from '../../../lib/session';

const TIMEZONES = [
  'Asia/Dhaka',
  'Asia/Kolkata',
  'UTC',
  'America/New_York',
  'Europe/London',
  'Asia/Tokyo',
];
const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'INR', 'JPY'];
// Value is the DB's week_starts_on (0=Sunday … 6=Saturday).
const WEEK_STARTS = [
  { label: 'Saturday', value: 6 },
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
];

type Notice = { ok: boolean; text: string } | null;

export default function SettingsView({
  profile,
  identities,
}: {
  profile: SessionProfile;
  identities: LinkedIdentity[];
}) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  // Shared locale: choosing a language here changes the whole app immediately
  // and persists, instead of only affecting this form's own copy (DEC-021).
  const { locale, setLocale, t } = useLocale();
  const [timezone, setTimezone] = useState(profile.timezone);
  const [currency, setCurrency] = useState(profile.base_currency);
  const [weekStart, setWeekStart] = useState(profile.week_starts_on);
  const [privacyDefault, setPrivacyDefault] = useState(profile.amount_privacy_default);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const hasPassword = identities.some((identity) => identity.provider === 'email');
  const googleIdentity = identities.find((identity) => identity.provider === 'google');

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, fallback: string) {
    setNotice(null);
    startTransition(async () => {
      const result = await fn();
      setNotice({
        ok: result.ok,
        text: result.message ?? (result.ok ? fallback : 'Something went wrong.'),
      });
      if (result.ok) router.refresh();
    });
  }

  return (
    <div>
      <div style={s.hdr}>
        <h1 style={s.title}>{t('settings.title')}</h1>
        <p style={s.sub}>{profile.email}</p>
      </div>

      {notice && (
        <div style={notice.ok ? s.noticeOk : s.noticeBad} role="status">
          {notice.text}
        </div>
      )}

      {profile.status === 'PENDING_DELETION' && (
        <div style={s.noticeBad}>
          <strong>This account is scheduled for deletion</strong>
          {profile.deletion_scheduled_for && (
            <> on {new Date(profile.deletion_scheduled_for).toDateString()}.</>
          )}{' '}
          Your data has not been removed. Contact support to cancel.
        </div>
      )}

      <div style={s.sections}>
        {/* ── Profile ─────────────────────────────────────── */}
        <section style={s.section}>
          <div style={s.sectionHeader}>
            <User size={18} style={s.sectionIcon} />
            <span style={s.sectionTitle}>{t('settings.profile')}</span>
          </div>
          <div style={s.row}>
            <div style={s.rowLabel}>
              <span style={s.rowTitle}>{t('settings.displayName')}</span>
              <span style={s.rowDesc}>Shown in the sidebar and on your account</span>
            </div>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={t('settings.displayNamePlaceholder')}
              style={{ ...s.select, minWidth: 220 }}
            />
          </div>
          <div style={{ ...s.row, borderBottom: 'none' }}>
            <div style={s.rowLabel}>
              <span style={s.rowTitle}>{t('auth.email')}</span>
              <span style={s.rowDesc}>
                {t('settings.emailChangeUnavailable')}
              </span>
            </div>
            <span style={{ ...s.rowDesc, color: '#94a3b8' }}>{profile.email}</span>
          </div>
        </section>

        {/* ── Preferences ─────────────────────────────────── */}
        <section style={s.section}>
          <div style={s.sectionHeader}>
            <Globe size={18} style={s.sectionIcon} />
            <span style={s.sectionTitle}>{t('settings.preferences')}</span>
          </div>
          <div style={s.row}>
            <div style={s.rowLabel}>
              <span style={s.rowTitle}>{t('settings.language')}</span>
              <span style={s.rowDesc}>{t('onboarding.selectLanguage')}</span>
            </div>
            <div style={s.toggle}>
              <button
                onClick={() => setLocale('bn')}
                style={{ ...s.toggleBtn, ...(locale === 'bn' ? s.toggleActive : {}) }}
              >
                বাংলা
              </button>
              <button
                onClick={() => setLocale('en')}
                style={{ ...s.toggleBtn, ...(locale === 'en' ? s.toggleActive : {}) }}
              >
                English
              </button>
            </div>
          </div>
          <div style={s.row}>
            <div style={s.rowLabel}>
              <span style={s.rowTitle}>{t('settings.timezone')}</span>
              <span style={s.rowDesc}>Used for transaction dates and monthly boundaries</span>
            </div>
            <select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              style={s.select}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div style={s.row}>
            <div style={s.rowLabel}>
              <span style={s.rowTitle}>{t('settings.currency')}</span>
              <span style={s.rowDesc}>Primary currency for new accounts</span>
            </div>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              style={s.select}
            >
              {CURRENCIES.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </div>
          <div style={s.row}>
            <div style={s.rowLabel}>
              <span style={s.rowTitle}>{t('settings.weekStart')}</span>
              <span style={s.rowDesc}>Affects budget periods and the calendar</span>
            </div>
            <select
              value={weekStart}
              onChange={(event) => setWeekStart(Number(event.target.value))}
              style={s.select}
            >
              {WEEK_STARTS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ ...s.row, borderBottom: 'none' }}>
            <div style={s.rowLabel}>
              <span style={s.rowTitle}>{t('settings.hideAmountsDefault')}</span>
              <span style={s.rowDesc}>{t('settings.hideAmountsDefaultBody')}</span>
            </div>
            <div style={s.toggle}>
              <button
                onClick={() => setPrivacyDefault(true)}
                style={{ ...s.toggleBtn, ...(privacyDefault ? s.toggleActive : {}) }}
              >
                On
              </button>
              <button
                onClick={() => setPrivacyDefault(false)}
                style={{ ...s.toggleBtn, ...(!privacyDefault ? s.toggleActive : {}) }}
              >
                Off
              </button>
            </div>
          </div>
        </section>

        {/* ── Connections ─────────────────────────────────── */}
        <section style={s.section}>
          <div style={s.sectionHeader}>
            <Link2 size={18} style={s.sectionIcon} />
            <span style={s.sectionTitle}>{t('settings.signInMethods')}</span>
          </div>

          {identities.map((identity) => (
            <div key={identity.id} style={s.row}>
              <div style={s.rowLabel}>
                <span style={s.rowTitle}>
                  {PROVIDER_LABELS[identity.provider] ?? identity.provider}
                </span>
                <span style={s.rowDesc}>
                  {identity.email ?? 'Linked'}
                  {identity.created_at &&
                    ` · since ${new Date(identity.created_at).toDateString()}`}
                </span>
              </div>
              {identities.length > 1 ? (
                <button
                  onClick={() =>
                    run(() => unlinkIdentity(identity.id), 'Disconnected.')
                  }
                  disabled={pending}
                  style={s.dangerBtn}
                >
                  <Unlink size={14} />
                  {t('settings.disconnect')}
                </button>
              ) : (
                <span style={{ ...s.rowDesc, color: '#64748b' }}>
                  {t('settings.onlySignInMethod')}
                </span>
              )}
            </div>
          ))}

          <div style={{ ...s.row, borderBottom: 'none' }}>
            <div style={s.rowLabel}>
              <span style={s.rowTitle}>Google</span>
              <span style={s.rowDesc}>
                {googleIdentity
                  ? 'Connected — sign in with Google on any device'
                  : GOOGLE_AUTH_ENABLED
                    ? 'Connect your Google account for one-click sign-in'
                    : 'Google sign-in is not configured on this deployment yet.'}
              </span>
            </div>
            {!googleIdentity &&
              (GOOGLE_AUTH_ENABLED ? (
                <button
                  onClick={() => run(() => linkGoogleIdentity(), 'Redirecting to Google…')}
                  disabled={pending}
                  style={s.primaryBtnSmall}
                >
                  <GoogleMark />
                  {t('settings.connectGoogle')}
                </button>
              ) : (
                // An honest disabled state beats a button that bounces the user
                // into a provider error page.
                <span style={s.notConfigured}>{t('app.notConfigured')}</span>
              ))}
          </div>
        </section>

        {/* ── Security ────────────────────────────────────── */}
        <section style={s.section}>
          <div style={s.sectionHeader}>
            <Shield size={18} style={s.sectionIcon} />
            <span style={s.sectionTitle}>{t('settings.security')}</span>
          </div>

          {hasPassword ? (
            <div style={{ ...s.row, flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
              <div style={s.rowLabel}>
                <span style={s.rowTitle}>{t('settings.changePassword')}</span>
                <span style={s.rowDesc}>
                  Your current password is required — this is what stops someone at an unlocked
                  browser from taking the account.
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.6rem' }}>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder={t('settings.currentPassword')}
                  autoComplete="current-password"
                  style={s.select}
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder={t('settings.newPassword')}
                  autoComplete="new-password"
                  style={s.select}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={t('settings.confirmNewPassword')}
                  autoComplete="new-password"
                  style={s.select}
                />
              </div>
              <div>
                <button
                  onClick={() => {
                    if (newPassword !== confirmPassword) {
                      setNotice({ ok: false, text: 'The new passwords do not match.' });
                      return;
                    }
                    run(async () => {
                      const result = await changePassword(currentPassword, newPassword);
                      if (result.ok) {
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                        return { ok: true, message: 'Password changed.' };
                      }
                      return { ok: false, message: PASSWORD_ERRORS[result.code] ?? 'Could not change the password.' };
                    }, 'Password changed.');
                  }}
                  disabled={pending || !currentPassword || newPassword.length < 8}
                  style={{
                    ...s.primaryBtnSmall,
                    opacity: !currentPassword || newPassword.length < 8 ? 0.5 : 1,
                  }}
                >
                  <Lock size={14} />
                  {t('settings.updatePassword')}
                </button>
              </div>
            </div>
          ) : (
            <div style={s.row}>
              <div style={s.rowLabel}>
                <span style={s.rowTitle}>Password</span>
                <span style={s.rowDesc}>
                  This account signs in with a linked provider and has no password set.
                </span>
              </div>
            </div>
          )}

          <div style={{ ...s.row, borderBottom: 'none' }}>
            <div style={s.rowLabel}>
              <span style={s.rowTitle}>{t('settings.signOutAll')}</span>
              <span style={s.rowDesc}>
                {t('settings.signOutAllBody')}
              </span>
            </div>
            <button onClick={() => void signOut()} style={s.dangerBtn}>
              <LogOut size={14} />
              {t('settings.signOutAll')}
            </button>
          </div>
        </section>

        {/* ── Your data (§15.3, DATA-01) ──────────────────── */}
        <section style={s.section}>
          <div style={s.sectionHeader}>
            <Download size={18} style={{ color: '#38bdf8' }} />
            <span style={s.sectionTitle}>{t('settings.exportData')}</span>
          </div>

          <div style={{ ...s.row, borderBottom: 'none' }}>
            <div style={s.rowLabel}>
              <span style={s.rowTitle}>{t('settings.exportData')}</span>
              <span style={s.rowDesc}>{t('settings.exportDataBody')}</span>
            </div>
            {/*
              A plain link, not a fetch-and-blob. The endpoint sets
              Content-Disposition, so the browser saves the file itself — which
              means the download works without JavaScript holding a full copy
              of someone's finances in memory, and it survives a tab close.
            */}
            <a
              href="/dashboard/settings/export"
              style={{ ...s.ghostBtn, textDecoration: 'none' }}
              download
            >
              <Download size={15} aria-hidden="true" />
              {t('settings.downloadExport')}
            </a>
          </div>
        </section>

        {/* ── Danger zone ─────────────────────────────────── */}
        <section style={s.dangerSection}>
          <div style={{ ...s.sectionHeader, borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
            <Trash2 size={18} style={{ color: '#ef4444' }} />
            <span style={{ ...s.sectionTitle, color: '#ef4444' }}>{t('settings.dangerZone')}</span>
          </div>

          <div style={{ ...s.row, flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem', borderBottom: 'none' }}>
            <div style={s.rowLabel}>
              <span style={s.rowTitle}>{t('settings.deleteAccount')}</span>
              <span style={s.rowDesc}>
                Your account is locked immediately and everything is permanently erased after 30
                days. Nothing is deleted during that window — an operator can restore the account
                until the grace period ends.
              </span>
            </div>

            {!showDelete ? (
              <div>
                <button onClick={() => setShowDelete(true)} style={s.dangerBtn}>
                  <Trash2 size={14} />
                  {t('settings.deleteAccount')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={s.deleteWarning}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    This signs you out and starts a 30-day countdown. After it expires, every
                    account, transaction and report you own is destroyed and cannot be recovered.
                  </span>
                </div>
                <input
                  value={deleteConfirm}
                  onChange={(event) => setDeleteConfirm(event.target.value)}
                  placeholder={t('settings.deleteConfirmPrompt', { email: profile.email })}
                  style={s.select}
                />
                <input
                  value={deleteReason}
                  onChange={(event) => setDeleteReason(event.target.value)}
                  placeholder={t('settings.reasonOptional')}
                  style={s.select}
                />
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button
                    onClick={() =>
                      run(async () => {
                        const result = await requestAccountDeletion(deleteConfirm, deleteReason);
                        if (result.ok) {
                          // The account is banned server-side; the session is
                          // already dead. Sign out so the user is not left
                          // staring at a shell that 401s on every action.
                          setTimeout(() => void signOut(), 2500);
                        }
                        return result;
                      }, 'Deletion scheduled.')
                    }
                    disabled={
                      pending ||
                      deleteConfirm.trim().toLowerCase() !== profile.email.toLowerCase()
                    }
                    style={{
                      ...s.dangerBtn,
                      opacity:
                        deleteConfirm.trim().toLowerCase() !== profile.email.toLowerCase()
                          ? 0.45
                          : 1,
                    }}
                  >
                    {pending ? <Loader2 size={14} /> : <Trash2 size={14} />}
                    {t('settings.confirmDeletion')}
                  </button>
                  <button
                    onClick={() => {
                      setShowDelete(false);
                      setDeleteConfirm('');
                    }}
                    style={s.ghostBtn}
                  >
                    {t('app.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div style={s.saveBar}>
        <button
          onClick={() =>
            run(
              () =>
                savePreferences({
                  display_name: displayName,
                  locale,
                  timezone,
                  base_currency: currency,
                  week_starts_on: weekStart,
                  amount_privacy_default: privacyDefault,
                }),
              'Preferences saved.',
            )
          }
          disabled={pending}
          style={s.saveBtn}
        >
          {pending ? <Loader2 size={16} /> : <Save size={16} />}
          {t('settings.saveChanges')}
        </button>
      </div>
    </div>
  );
}

/** Maps the server action's error codes to sentences a person can act on. */
const PASSWORD_ERRORS: Record<string, string> = {
  currentPasswordWrong: 'Your current password is incorrect.',
  passwordTooShort: 'The new password must be at least 8 characters.',
  passwordUnchanged: 'The new password must differ from the current one.',
  notAuthenticated: 'Your session has expired — sign in again.',
  passwordChangeFailed: 'The password could not be changed. Try again.',
};

/** Inline mark so the button needs no external image (CSP-safe). */
function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.8 2.6 13.5l7.8 6c1.9-5.6 7.1-10 13.6-10z" />
      <path fill="#4285F4" d="M46.6 24.6c0-1.6-.15-3.2-.44-4.6H24v9.1h12.7c-.55 3-2.2 5.5-4.7 7.2l7.3 5.6c4.3-4 6.8-9.9 6.8-17.3z" />
      <path fill="#FBBC05" d="M10.4 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.6 10.5l7.8-6z" />
      <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.3-5.6l-7.3-5.6c-2 1.4-4.7 2.3-8 2.3-6.5 0-11.7-4.4-13.6-10l-7.8 6C6.5 42.2 14.6 47.5 24 47.5z" />
    </svg>
  );
}

const s: Record<string, React.CSSProperties> = {
  hdr: { marginBottom: '2rem' },
  title: { fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: 0 },
  sub: { fontSize: '0.8125rem', color: '#64748b', margin: 0, marginTop: 2 },
  sections: { display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 760 },
  section: {
    background: 'rgba(30,41,59,0.4)',
    border: '1px solid #1e293b',
    borderRadius: '1rem',
    overflow: 'hidden',
  },
  sectionHeader: {
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
  },
  sectionTitle: { fontSize: '0.9375rem', fontWeight: 700, color: '#f8fafc' },
  sectionIcon: { color: '#10b981' },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid rgba(30,41,59,0.5)',
    gap: '1rem',
  },
  rowLabel: { display: 'flex', flexDirection: 'column', gap: 2 },
  rowTitle: { fontSize: '0.875rem', fontWeight: 500, color: '#f8fafc' },
  rowDesc: { fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 },
  select: {
    padding: '0.5rem 0.75rem',
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid #334155',
    borderRadius: '0.5rem',
    color: '#f8fafc',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    outline: 'none',
    minWidth: 160,
  },
  toggle: {
    display: 'flex',
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid #334155',
    borderRadius: '0.5rem',
    overflow: 'hidden',
  },
  toggleBtn: {
    padding: '0.375rem 0.75rem',
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  toggleActive: { background: 'rgba(16,185,129,0.15)', color: '#10b981' },
  saveBar: { display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', maxWidth: 760 },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 2rem',
    background: 'linear-gradient(135deg,#059669,#10b981)',
    border: 'none',
    borderRadius: '0.75rem',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
  },
  primaryBtnSmall: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.5rem 0.9rem',
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.35)',
    borderRadius: '0.5rem',
    color: '#10b981',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  ghostBtn: {
    padding: '0.5rem 0.9rem',
    background: 'transparent',
    border: '1px solid #334155',
    borderRadius: '0.5rem',
    color: '#94a3b8',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  notConfigured: {
    fontSize: '0.75rem',
    color: '#64748b',
    border: '1px dashed #334155',
    borderRadius: '0.5rem',
    padding: '0.4rem 0.7rem',
    whiteSpace: 'nowrap',
  },
  dangerSection: {
    background: 'rgba(239,68,68,0.05)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '1rem',
    overflow: 'hidden',
  },
  dangerBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'transparent',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '0.5rem',
    color: '#ef4444',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  deleteWarning: {
    display: 'flex',
    gap: '0.6rem',
    alignItems: 'flex-start',
    padding: '0.75rem 0.9rem',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: '0.6rem',
    color: '#fca5a5',
    fontSize: '0.75rem',
    lineHeight: 1.55,
  },
  noticeOk: {
    marginBottom: '1rem',
    padding: '0.75rem 1rem',
    borderRadius: '0.6rem',
    background: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.3)',
    color: '#10b981',
    fontSize: '0.8125rem',
    maxWidth: 760,
  },
  noticeBad: {
    marginBottom: '1rem',
    padding: '0.75rem 1rem',
    borderRadius: '0.6rem',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#fca5a5',
    fontSize: '0.8125rem',
    maxWidth: 760,
  },
};
