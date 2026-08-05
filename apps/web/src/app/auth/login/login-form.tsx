'use client';

import { useState } from 'react';
import { signIn, signUp, signInWithGoogle } from '../actions';
import { GOOGLE_AUTH_ENABLED } from '../../../lib/auth-config';
import { useLocale } from '../../../lib/i18n/locale-provider';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Wallet,
  Globe,
  Loader2,
} from 'lucide-react';

/** Marketing bullets on the sign-in page, from the shared catalog. */
const FEATURE_KEYS = [
  'transactions.title',
  'nav.budgets',
  'nav.goals',
  'app.free',
] as const;

export default function LoginForm({ next }: { next?: string }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // `next` comes from the server page via searchParams — using useSearchParams()
  // here would force this whole tree out of prerendering and fail the build.
  //
  // No client-side "already logged in?" check is needed — proxy.ts redirects an
  // authenticated user away from /auth/login before this component ever renders.

  // Strings come from the shared catalog now. This component used to carry its
  // own bn/en dictionary AND its own locale state, so a visitor who picked
  // English here saw Bangla again on the very next screen (DEC-021).
  const { t, toggleLocale, otherLanguageName } = useLocale();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isLogin && password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    setLoading(true);

    try {
      // Credentials go to a server action, never to Supabase from the browser —
      // that is what lets the session cookies be httpOnly (DEC-009).
      // On success signIn() redirects server-side and never returns.
      const result = isLogin
        ? await signIn(email, password, next)
        : await signUp(email, password);

      if (result && !result.ok) {
        setError(result.code === 'invalidCredentials' ? t('auth.invalidCredentials') : t('server.internalError'));
      } else if (!isLogin) {
        setSuccess(t('auth.verifyEmailSent', { email }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Background gradient mesh */}
      <div style={styles.bgMesh} />

      {/* Language switcher */}
      <button
        onClick={toggleLocale}
        style={styles.langSwitcher}
        aria-label="Switch language"
      >
        <Globe size={16} />
        {otherLanguageName}
      </button>

      <div style={styles.content}>
        {/* Left side — Branding */}
        <div style={styles.brandSide}>
          <div style={styles.logo}>
            <div style={styles.logoIcon}>
              <Wallet size={28} color="white" />
            </div>
            <h1 style={styles.logoText}>{t('app.name')}</h1>
          </div>
          <p style={styles.tagline}>{t('app.tagline')}</p>

          <div style={styles.features}>
            {FEATURE_KEYS.map((feature, i) => (
              <div
                key={i}
                style={{
                  ...styles.featureItem,
                  animationDelay: `${i * 100}ms`,
                }}
              >
                <div style={styles.featureDot} />
                <span>{t(feature)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right side — Auth Form */}
        <div style={styles.formSide}>
          <div style={styles.formCard}>
            {/* Tab switcher */}
            <div style={styles.tabBar}>
              <button
                onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
                style={{
                  ...styles.tab,
                  ...(isLogin ? styles.tabActive : {}),
                }}
              >
                {t('auth.signIn')}
              </button>
              <button
                onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
                style={{
                  ...styles.tab,
                  ...(!isLogin ? styles.tabActive : {}),
                }}
              >
                {t('auth.signUp')}
              </button>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              {/* Email */}
              <div style={styles.inputGroup}>
                <label htmlFor="email" style={styles.label}>{t('auth.email')}</label>
                <div style={styles.inputWrapper}>
                  <Mail size={18} style={styles.inputIcon} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    style={styles.inputWithIcon}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div style={styles.inputGroup}>
                <label htmlFor="password" style={styles.label}>{t('auth.password')}</label>
                <div style={styles.inputWrapper}>
                  <Lock size={18} style={styles.inputIcon} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    style={styles.inputWithIcon}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (register only) */}
              {!isLogin && (
                <div style={styles.inputGroup}>
                  <label htmlFor="confirmPassword" style={styles.label}>
                    {t('auth.confirmPassword')}
                  </label>
                  <div style={styles.inputWrapper}>
                    <Lock size={18} style={styles.inputIcon} />
                    <input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      style={styles.inputWithIcon}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              )}

              {/* Error / Success */}
              {error && <div style={styles.errorMsg}>{error}</div>}
              {success && <div style={styles.successMsg}>{success}</div>}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={styles.submitBtn}
              >
                {loading ? (
                  <Loader2 size={18} style={{ animation: 'spin 0.6s linear infinite' }} />
                ) : (
                  <>
                    {isLogin ? t('auth.signIn') : t('auth.signUp')}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              {/* Forgot password */}
              {isLogin && (
                <div style={styles.forgotLink}>
                  <a href="/auth/forgot-password">{t('auth.forgotPassword')}</a>
                </div>
              )}

              {/* Google — only offered when the provider is actually
                  configured. Rendering it unconditionally would send users to a
                  provider error page and look like the app is broken. */}
              {GOOGLE_AUTH_ENABLED && (
                <>
                  <div style={styles.divider}>
                    <span style={styles.dividerLine} />
                    <span style={styles.dividerText}>{t('auth.or')}</span>
                    <span style={styles.dividerLine} />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setLoading(true);
                      // Resolves by redirecting to Google; it only returns here
                      // when the provider could not be reached at all.
                      void signInWithGoogle(next).then((result) => {
                        if (result && !result.ok) {
                          setError(t('server.internalError'));
                          setLoading(false);
                        }
                      });
                    }}
                    disabled={loading}
                    style={styles.googleBtn}
                  >
                    <GoogleMark />
                    {t('auth.googleSignIn')}
                  </button>
                </>
              )}

              {/* Toggle mode */}
              <div style={styles.toggleMode}>
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                    setSuccess('');
                  }}
                  style={styles.toggleBtn}
                >
                  {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Inline SVG so the button needs no remote asset. */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.8 2.6 13.5l7.8 6c1.9-5.6 7.1-10 13.6-10z" />
      <path fill="#4285F4" d="M46.6 24.6c0-1.6-.15-3.2-.44-4.6H24v9.1h12.7c-.55 3-2.2 5.5-4.7 7.2l7.3 5.6c4.3-4 6.8-9.9 6.8-17.3z" />
      <path fill="#FBBC05" d="M10.4 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.6 10.5l7.8-6z" />
      <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.3-5.6l-7.3-5.6c-2 1.4-4.7 2.3-8 2.3-6.5 0-11.7-4.4-13.6-10l-7.8 6C6.5 42.2 14.6 47.5 24 47.5z" />
    </svg>
  );
}

// ─── Inline Styles (Premium Dark Theme) ──────────────────
const styles: Record<string, React.CSSProperties> = {
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    margin: '0.25rem 0',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    fontSize: '0.75rem',
    color: '#475569',
  },
  googleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.6rem',
    width: '100%',
    padding: '0.7rem 1.5rem',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '0.75rem',
    color: '#e2e8f0',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 150ms',
  },
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  bgMesh: {
    position: 'fixed',
    inset: 0,
    background: `
      radial-gradient(ellipse at 20% 50%, rgba(16, 185, 129, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 20%, rgba(59, 130, 246, 0.05) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 80%, rgba(245, 158, 11, 0.04) 0%, transparent 50%),
      #0f172a
    `,
    zIndex: 0,
  },
  langSwitcher: {
    position: 'absolute',
    top: '1.5rem',
    right: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#94a3b8',
    padding: '0.5rem 1rem',
    borderRadius: '9999px',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    zIndex: 10,
    transition: 'all 150ms',
  },
  content: {
    display: 'flex',
    flex: 1,
    position: 'relative',
    zIndex: 1,
    minHeight: '100vh',
  },
  brandSide: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '3rem 4rem',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  logoIcon: {
    width: 48,
    height: 48,
    borderRadius: '0.75rem',
    background: 'linear-gradient(135deg, #059669, #10b981)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
  },
  logoText: {
    fontSize: '1.75rem',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #f8fafc, #94a3b8)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.02em',
  },
  tagline: {
    fontSize: '1.25rem',
    color: '#94a3b8',
    marginBottom: '2.5rem',
    lineHeight: 1.6,
  },
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    color: '#cbd5e1',
    fontSize: '0.9375rem',
    animation: 'fadeIn 0.4s ease-out both',
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#10b981',
    boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)',
    flexShrink: 0,
  },
  formSide: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
    background: 'rgba(30, 41, 59, 0.6)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '1.5rem',
    padding: '2rem',
    animation: 'fadeIn 0.5s ease-out',
  },
  tabBar: {
    display: 'flex',
    background: 'rgba(15, 23, 42, 0.5)',
    borderRadius: '0.75rem',
    padding: '4px',
    marginBottom: '1.5rem',
  },
  tab: {
    flex: 1,
    padding: '0.625rem 1rem',
    background: 'transparent',
    border: 'none',
    borderRadius: '0.625rem',
    color: '#64748b',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 150ms',
    fontFamily: 'inherit',
  },
  tabActive: {
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  label: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: '#94a3b8',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '0.875rem',
    color: '#475569',
    pointerEvents: 'none',
  },
  inputWithIcon: {
    paddingLeft: '2.75rem',
    width: '100%',
  },
  eyeBtn: {
    position: 'absolute',
    right: '0.75rem',
    background: 'none',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
  },
  errorMsg: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    padding: '0.75rem 1rem',
    borderRadius: '0.75rem',
    fontSize: '0.8125rem',
  },
  successMsg: {
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    color: '#10b981',
    padding: '0.75rem 1rem',
    borderRadius: '0.75rem',
    fontSize: '0.8125rem',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, #059669, #10b981)',
    color: 'white',
    border: 'none',
    borderRadius: '0.75rem',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 200ms',
    fontFamily: 'inherit',
    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
  },
  forgotLink: {
    textAlign: 'center' as const,
    fontSize: '0.8125rem',
  },
  toggleMode: {
    textAlign: 'center' as const,
    paddingTop: '0.5rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: '#10b981',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
  },
};
