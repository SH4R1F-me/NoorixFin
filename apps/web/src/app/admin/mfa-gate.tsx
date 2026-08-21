'use client';

/**
 * The operator step-up screen — audit item 18.
 *
 * ── WHY THIS IS A SCREEN AND NOT A REDIRECT ─────────────────────────────────
 * Sending an un-stepped operator to Settings would lose where they were going,
 * and sending them to a generic error would not tell them what to do. The two
 * states this handles need genuinely different answers:
 *
 *   NOT ENROLLED — there is no factor to present. The only useful action is a
 *   link to Settings → Security, and doing anything else here would be a dead
 *   end dressed up as a form.
 *
 *   ENROLLED, NOT STEPPED UP — the account has an authenticator and this
 *   session has not used it. A six-digit box is the whole interaction.
 *
 * ── WHY VERIFICATION GOES THROUGH A SERVER ACTION ───────────────────────────
 * The documented Supabase flow calls `mfa.verify()` in the browser. That cannot
 * work here: under DEC-009 the session is in httpOnly cookies, so the browser
 * client sees no session and would challenge as an anonymous user. Verification
 * also mints a new access token carrying `aal2`, and writing auth cookies is
 * something only the server can do. See auth/mfa-actions.ts.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { verifyMfaCode } from '../auth/mfa-actions';

const CODE_LENGTH = 6;

export default function MfaGate({
  enrolled,
  factorId,
}: {
  enrolled: boolean;
  factorId: string | null;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function verify() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await verifyMfaCode(factorId, code);
      if (!result.ok) {
        setError(result.message);
        setCode('');
        return;
      }
      // The cookie now holds an aal2 token. `refresh()` re-runs the layout,
      // which re-reads the assurance level and renders the console.
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main-content" tabIndex={-1} style={s.page}>
      <div style={s.card}>
        <div style={s.icon}>
          <ShieldCheck size={28} color="#f59e0b" aria-hidden="true" />
        </div>

        <h1 style={s.title}>Second factor required</h1>

        {enrolled ? (
          <>
            <p style={s.body}>
              The admin console needs your authenticator for this session.
              Operator actions affect the whole platform, so a password alone is
              not enough to reach them.
            </p>

            <label style={s.label} htmlFor="mfa-code">
              Six-digit code
            </label>
            <input
              id="mfa-code"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter' && code.length === CODE_LENGTH) void verify();
              }}
              // `one-time-code` is what lets a password manager or the OS
              // offer the code; without it the operator retypes it by hand.
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="000000"
              aria-describedby={error ? 'mfa-error' : undefined}
              aria-invalid={error ? true : undefined}
              autoFocus
              style={s.input}
            />

            {error && (
              // role="alert" so it is announced rather than silently replacing
              // the previous text for anyone not watching that region.
              <p id="mfa-error" role="alert" style={s.error}>
                {error}
              </p>
            )}

            <button
              onClick={() => void verify()}
              disabled={busy || code.length !== CODE_LENGTH}
              style={{
                ...s.button,
                opacity: busy || code.length !== CODE_LENGTH ? 0.5 : 1,
              }}
            >
              {busy ? (
                <Loader2 size={16} aria-hidden="true" />
              ) : (
                <KeyRound size={16} aria-hidden="true" />
              )}
              {busy ? 'Verifying…' : 'Verify and continue'}
            </button>
          </>
        ) : (
          <>
            <p style={s.body}>
              This account has operator privileges but no authenticator app
              enrolled. Set one up in Settings, then come back — it takes about a
              minute and only has to be done once.
            </p>
            <Link href="/dashboard/settings#security" style={s.button}>
              <ShieldCheck size={16} aria-hidden="true" />
              Set up two-factor authentication
            </Link>
          </>
        )}

        <Link href="/dashboard" style={s.secondary}>
          Back to my dashboard
        </Link>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    background: '#0b1020',
  },
  card: {
    width: '100%',
    maxWidth: '26rem',
    padding: '2rem',
    borderRadius: '1rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(245,158,11,0.25)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  icon: { marginBottom: '0.25rem' },
  title: { fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 },
  body: { fontSize: '0.875rem', lineHeight: 1.6, color: '#94a3b8', margin: 0 },
  label: { fontSize: '0.8125rem', color: '#cbd5e1', marginTop: '0.5rem' },
  input: {
    padding: '0.7rem 0.9rem',
    borderRadius: '0.6rem',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#f8fafc',
    fontSize: '1.25rem',
    letterSpacing: '0.35em',
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
  },
  error: { fontSize: '0.8125rem', color: '#f87171', margin: 0 },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginTop: '0.5rem',
    padding: '0.7rem 1rem',
    borderRadius: '0.6rem',
    border: 'none',
    background: '#f59e0b',
    color: '#0b1020',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  secondary: {
    marginTop: '0.25rem',
    fontSize: '0.8125rem',
    color: '#8b9ab0',
    textAlign: 'center',
    textDecoration: 'none',
  },
};
