'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { requestPasswordReset } from '../actions';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await requestPasswordReset(email);
    setLoading(false);
    // Shown regardless of whether the address exists — see the action's comment
    // on user enumeration.
    setSent(true);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <Link href="/auth/login" style={styles.back}>
          <ArrowLeft size={16} />
          Back to sign in
        </Link>

        <h1 style={styles.title}>পাসওয়ার্ড রিসেট</h1>
        <p style={styles.subtitle}>Reset your password</p>

        {sent ? (
          <div style={styles.sentBox}>
            <p style={styles.sentTitle}>Check your email</p>
            <p style={styles.sentBody}>
              If an account exists for <strong>{email}</strong>, a reset link is on its way.
            </p>
            <p style={styles.devNote}>
              Local development: mail is captured by Mailpit at{' '}
              <a href="http://localhost:54324" target="_blank" rel="noreferrer" style={styles.link}>
                localhost:54324
              </a>
              , not delivered.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} style={styles.form}>
            <label htmlFor="email" style={styles.label}>Email</label>
            <div style={styles.inputWrap}>
              <Mail size={18} style={styles.inputIcon} />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                style={styles.input}
              />
            </div>
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? <Loader2 size={18} /> : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0f172a', padding: '1.5rem',
  },
  card: {
    width: '100%', maxWidth: 420, background: 'rgba(30,41,59,0.6)',
    border: '1px solid #334155', borderRadius: '1rem', padding: '2rem',
  },
  back: {
    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
    color: '#94a3b8', fontSize: '0.8125rem', textDecoration: 'none', marginBottom: '1.25rem',
  },
  title: { fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: 0 },
  subtitle: { fontSize: '0.8125rem', color: '#8b9ab0', margin: 0, marginTop: 2, marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: { fontSize: '0.75rem', fontWeight: 500, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
  inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIcon: { position: 'absolute', left: 12, color: '#8b9ab0' },
  input: {
    width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', background: 'rgba(15,23,42,0.6)',
    border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc',
    fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none',
  },
  button: {
    marginTop: '0.75rem', padding: '0.875rem', background: 'linear-gradient(135deg,#059669,#10b981)',
    border: 'none', borderRadius: '0.625rem', color: 'white', fontWeight: 600,
    fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  sentBox: {
    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: '0.75rem', padding: '1.25rem',
  },
  sentTitle: { fontSize: '0.9375rem', fontWeight: 700, color: '#10b981', margin: 0 },
  sentBody: { fontSize: '0.8125rem', color: '#cbd5e1', marginTop: '0.5rem', lineHeight: 1.6 },
  devNote: { fontSize: '0.75rem', color: '#8b9ab0', marginTop: '0.75rem', lineHeight: 1.5 },
  link: { color: '#10b981' },
};
