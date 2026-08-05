'use client';

/**
 * Two-factor enrolment — audit item 18.
 *
 * ── WHY EVERY USER SEES THIS, NOT JUST OPERATORS ────────────────────────────
 * The audit item is about operators, and operators are where it is ENFORCED
 * (SuperAdminGuard requires aal2). Offering it to everyone costs nothing extra
 * and this is a finance app. Hiding it from ordinary users would also make the
 * operator bootstrap awkward: the enrolment path has to sit OUTSIDE the admin
 * gate, or a newly promoted operator with no factor could never get in.
 *
 * ── THE SECRET, AND WHY IT IS SHOWN AS TEXT TOO ─────────────────────────────
 * A QR code alone fails for anyone using a password manager on the same device,
 * a desktop authenticator, or a screen reader. The typed-entry string is not a
 * fallback for a broken image — it is the accessible path (§5.5), and the one
 * that works when the phone camera does not.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import {
  beginMfaEnrollment,
  disableMfa,
  verifyMfaCode,
  type EnrollmentOffer,
} from '../../auth/mfa-actions';

const CODE_LENGTH = 6;

export default function MfaPanel({
  enrolled,
  factorId,
  isSuperAdmin,
  styles: s,
}: {
  enrolled: boolean;
  factorId: string | null;
  isSuperAdmin: boolean;
  styles: Record<string, React.CSSProperties>;
}) {
  const [offer, setOffer] = useState<EnrollmentOffer | null>(null);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function begin() {
    setNotice(null);
    startTransition(async () => {
      const result = await beginMfaEnrollment();
      if (result.ok) setOffer(result.data);
      else setNotice({ ok: false, text: result.message });
    });
  }

  function confirm() {
    if (!offer) return;
    setNotice(null);
    startTransition(async () => {
      const result = await verifyMfaCode(offer.factorId, code);
      if (result.ok) {
        setOffer(null);
        setCode('');
        setNotice({ ok: true, text: 'Two-factor authentication is on.' });
        router.refresh();
      } else {
        setNotice({ ok: false, text: result.message });
        setCode('');
      }
    });
  }

  function remove() {
    if (!factorId) return;
    setNotice(null);
    startTransition(async () => {
      const result = await disableMfa(factorId);
      if (result.ok) {
        setNotice({ ok: true, text: 'Two-factor authentication is off.' });
        router.refresh();
      } else {
        setNotice({ ok: false, text: result.message });
      }
    });
  }

  return (
    <div
      id="security-2fa"
      style={{ ...s.row, flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}
    >
      <div style={s.rowLabel}>
        <span style={s.rowTitle}>Two-factor authentication</span>
        <span style={s.rowDesc}>
          {enrolled
            ? 'An authenticator app is required in addition to your password.'
            : 'A code from an authenticator app, in addition to your password. ' +
              'A stolen password on its own then stops being enough.'}
          {isSuperAdmin && !enrolled && ' Required for the admin console.'}
        </span>
      </div>

      {notice && (
        // role="status" rather than a bare div: the outcome of a security
        // change should be announced, not only rendered.
        <p
          role="status"
          style={{
            margin: 0,
            fontSize: '0.8125rem',
            color: notice.ok ? '#34d399' : '#f87171',
          }}
        >
          {notice.text}
        </p>
      )}

      {enrolled ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8125rem',
              color: '#34d399',
            }}
          >
            {/* Icon AND word, never colour alone (§5.5). */}
            <ShieldCheck size={15} aria-hidden="true" />
            On
          </span>
          {!isSuperAdmin && (
            <button onClick={remove} disabled={pending} style={s.ghostBtn}>
              <ShieldOff size={14} aria-hidden="true" />
              Turn off
            </button>
          )}
          {isSuperAdmin && (
            <span style={{ ...s.rowDesc, margin: 0 }}>
              Operator accounts cannot turn this off themselves.
            </span>
          )}
        </div>
      ) : offer ? (
        <>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/*
              GoTrue returns the QR as an SVG data URI, so this renders from the
              response with no network request — which also means the strict CSP
              on the page does not have to allow an external image host.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={offer.qrCode}
              alt="QR code for enrolling this account in your authenticator app"
              width={168}
              height={168}
              style={{ background: '#fff', borderRadius: '0.5rem', padding: '0.5rem' }}
            />
            <div style={{ flex: '1 1 14rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={s.rowDesc}>
                Scan this with your authenticator app, or enter the key below by hand.
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <code
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.6rem',
                    borderRadius: '0.4rem',
                    background: 'rgba(255,255,255,0.05)',
                    fontSize: '0.75rem',
                    wordBreak: 'break-all',
                    color: '#e2e8f0',
                  }}
                >
                  {offer.secret}
                </code>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(offer.secret);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={s.ghostBtn}
                  aria-label="Copy the setup key"
                >
                  {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label htmlFor="mfa-enroll-code" style={{ position: 'absolute', left: '-9999px' }}>
              Six-digit code from your authenticator app
            </label>
            <input
              id="mfa-enroll-code"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
              }
              placeholder="000000"
              autoComplete="one-time-code"
              inputMode="numeric"
              style={{ ...s.select, maxWidth: '9rem', letterSpacing: '0.3em', textAlign: 'center' }}
            />
            <button
              onClick={confirm}
              disabled={pending || code.length !== CODE_LENGTH}
              style={{ ...s.primaryBtnSmall, opacity: code.length !== CODE_LENGTH ? 0.5 : 1 }}
            >
              {pending ? <Loader2 size={14} aria-hidden="true" /> : <ShieldCheck size={14} aria-hidden="true" />}
              Confirm and turn on
            </button>
            <button onClick={() => setOffer(null)} disabled={pending} style={s.ghostBtn}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div>
          <button onClick={begin} disabled={pending} style={s.primaryBtnSmall}>
            {pending ? <Loader2 size={14} aria-hidden="true" /> : <ShieldCheck size={14} aria-hidden="true" />}
            Set up two-factor authentication
          </button>
        </div>
      )}
    </div>
  );
}
