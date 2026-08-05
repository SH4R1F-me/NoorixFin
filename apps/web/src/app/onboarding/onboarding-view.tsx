'use client';

/**
 * First-run setup — Blueprint §5.2.
 *
 * The state machine behind this has existed in the database since migration
 * 00001 and was completely inert: every user in the system sat at
 * ACCOUNT_CREATED forever because nothing read or wrote the column.
 *
 * ── WHAT THIS IS NOT ─────────────────────────────────────────────────────────
 * Not a wall. Every step has a visible way out, and skipping marks the flow
 * COMPLETED rather than deferring it — a wizard that returns each time you
 * decline it is a nag, and the dashboard's empty states already guide someone
 * who skipped. §5.2 lists ten steps; four of them (account creation, workspace
 * creation, category seeding) already happen automatically, and one (family
 * workspace) was dropped by DEC-007, so what remains is the four below.
 *
 * Each step persists as it completes, so abandoning halfway keeps what was
 * answered instead of discarding it.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Globe,
  Landmark,
  SlidersHorizontal,
  UserRound,
  Wallet,
} from 'lucide-react';
import type { SupportedLanguage } from '@noorixfin/i18n';
import { useLocale } from '../../lib/i18n/locale-provider';
import {
  completeOnboarding,
  createFirstAccount,
  savePersona,
  savePreferences,
  saveLanguage,
} from './actions';
import { field } from '../dashboard/planning-ui';

const PERSONAS = [
  { value: 'INDIVIDUAL', key: 'onboarding.personaIndividual' },
  { value: 'STUDENT', key: 'onboarding.personaStudent' },
  { value: 'FREELANCER', key: 'onboarding.personaFreelancer' },
] as const;

// Matches CreateAccountDto's enum exactly. The class follows the subtype rather
// than being a second control the user can contradict — a CREDIT_CARD is never
// an ASSET.
const SUBTYPES = [
  { value: 'CASH', key: 'accounts.cash', class: 'ASSET' },
  { value: 'BANK', key: 'accounts.bank', class: 'ASSET' },
  { value: 'MOBILE_WALLET', key: 'accounts.mobileWallet', class: 'ASSET' },
  { value: 'SAVINGS', key: 'accounts.savings', class: 'ASSET' },
  { value: 'CREDIT_CARD', key: 'accounts.creditCard', class: 'LIABILITY' },
  { value: 'LOAN', key: 'accounts.loan', class: 'LIABILITY' },
] as const;

/** Saturday is the Bangladeshi convention and the database default. */
const WEEK_STARTS = [
  { value: 6, key: 'time.saturday' },
  { value: 0, key: 'time.sunday' },
  { value: 1, key: 'time.monday' },
] as const;

const TIMEZONES = ['Asia/Dhaka', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'UTC'];
const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'INR'];

const TOTAL_STEPS = 4;

export default function OnboardingView({
  workspaceId,
  initialName,
  initialTimezone,
  initialCurrency,
  initialWeekStart,
}: {
  workspaceId: string;
  initialName: string;
  initialTimezone: string;
  initialCurrency: string;
  initialWeekStart: number;
}) {
  const { t, locale, setLocale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [currency, setCurrency] = useState(initialCurrency);
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [persona, setPersona] = useState<(typeof PERSONAS)[number]['value']>('INDIVIDUAL');
  const [accountName, setAccountName] = useState('');
  const [subtype, setSubtype] = useState<string>('CASH');
  const [openingBalance, setOpeningBalance] = useState('');

  /** Runs a step's write, then advances only if it actually persisted. */
  function run(action: () => Promise<{ ok: boolean; message?: string }>, next: number) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (next > TOTAL_STEPS) {
          router.replace('/dashboard');
          router.refresh();
        } else {
          setStep(next);
        }
      } else {
        setError(result.message ?? t('app.error'));
      }
    });
  }

  function finish() {
    run(() => completeOnboarding(), TOTAL_STEPS + 1);
  }

  const chosenSubtype = SUBTYPES.find((s) => s.value === subtype) ?? SUBTYPES[0];

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <header style={styles.header}>
          <div style={styles.logo}>
            <Wallet size={22} color="white" aria-hidden="true" />
          </div>
          <div>
            <h1 style={styles.title}>{t('onboarding.welcome')}</h1>
            <p style={styles.subtitle}>{t('onboarding.subtitle')}</p>
          </div>
        </header>

        {/* Progress. A real progressbar so the position is announced, not just
            painted (§5.5). */}
        <div
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-label={t('onboarding.stepOf', { current: step, total: TOTAL_STEPS })}
          style={styles.progressTrack}
        >
          <div
            aria-hidden="true"
            style={{ ...styles.progressFill, width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <p style={styles.stepLabel}>
          {t('onboarding.stepOf', { current: step, total: TOTAL_STEPS })}
        </p>

        {/* ── 1. Language ─────────────────────────────────────────────────── */}
        {step === 1 && (
          <section aria-labelledby="step-language">
            <h2 id="step-language" style={styles.stepTitle}>
              <Globe size={18} aria-hidden="true" /> {t('onboarding.selectLanguage')}
            </h2>
            <div style={styles.choiceGrid}>
              {(['bn', 'en'] as SupportedLanguage[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={locale === option}
                  onClick={() => {
                    // Applied immediately so the REST of the wizard is in the
                    // language just chosen. Choosing a language and then being
                    // asked the next question in the other one is the exact
                    // disconnect DEC-021 exists to remove.
                    setLocale(option);
                  }}
                  style={{ ...styles.choice, ...(locale === option ? styles.choiceActive : {}) }}
                >
                  <span style={styles.choiceLabel}>
                    {option === 'bn' ? 'বাংলা' : 'English'}
                  </span>
                  {locale === option && <Check size={16} color="#10b981" aria-hidden="true" />}
                </button>
              ))}
            </div>
            <Actions
              pending={pending}
              nextLabel={t('app.next')}
              onNext={() => run(() => saveLanguage(locale), 2)}
              onSkip={finish}
              skipLabel={t('onboarding.skip')}
            />
          </section>
        )}

        {/* ── 2. Preferences ──────────────────────────────────────────────── */}
        {step === 2 && (
          <section aria-labelledby="step-prefs">
            <h2 id="step-prefs" style={styles.stepTitle}>
              <SlidersHorizontal size={18} aria-hidden="true" />{' '}
              {t('onboarding.preferencesTitle')}
            </h2>

            <div style={styles.formGrid}>
              <div style={field.group}>
                <label style={field.label} htmlFor="ob-name">
                  {t('settings.displayName')}
                </label>
                <input
                  id="ob-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  style={field.input}
                />
              </div>
              <div style={field.group}>
                <label style={field.label} htmlFor="ob-tz">
                  {t('onboarding.selectTimezone')}
                </label>
                <select
                  id="ob-tz"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  style={field.input}
                >
                  {TIMEZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </div>
              <div style={field.group}>
                <label style={field.label} htmlFor="ob-currency">
                  {t('onboarding.selectCurrency')}
                </label>
                <select
                  id="ob-currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  style={field.input}
                >
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div style={field.group}>
                <label style={field.label} htmlFor="ob-week">
                  {t('onboarding.weekStart')}
                </label>
                <select
                  id="ob-week"
                  value={weekStart}
                  onChange={(event) => setWeekStart(Number(event.target.value))}
                  style={field.input}
                >
                  {/* Sunday, Monday and Saturday only: those are the three
                      conventions in the markets this ships to, and offering
                      seven would imply the other four are meaningful choices. */}
                  {WEEK_STARTS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {t(day.key)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Actions
              pending={pending}
              nextLabel={t('app.next')}
              onNext={() =>
                run(
                  () =>
                    savePreferences({ displayName, timezone, currency, weekStartsOn: weekStart }),
                  3,
                )
              }
              onBack={() => setStep(1)}
              backLabel={t('app.back')}
              onSkip={finish}
              skipLabel={t('onboarding.skip')}
            />
          </section>
        )}

        {/* ── 3. Persona ──────────────────────────────────────────────────── */}
        {step === 3 && (
          <section aria-labelledby="step-persona">
            <h2 id="step-persona" style={styles.stepTitle}>
              <UserRound size={18} aria-hidden="true" /> {t('onboarding.selectPersona')}
            </h2>
            <p style={styles.hint}>{t('onboarding.personaHint')}</p>

            <div style={styles.choiceGrid}>
              {PERSONAS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={persona === option.value}
                  onClick={() => setPersona(option.value)}
                  style={{
                    ...styles.choice,
                    ...(persona === option.value ? styles.choiceActive : {}),
                  }}
                >
                  <span style={styles.choiceLabel}>{t(option.key)}</span>
                  {persona === option.value && (
                    <Check size={16} color="#10b981" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>

            <Actions
              pending={pending}
              nextLabel={t('app.next')}
              onNext={() => run(() => savePersona(persona), 4)}
              onBack={() => setStep(2)}
              backLabel={t('app.back')}
              onSkip={finish}
              skipLabel={t('onboarding.skip')}
            />
          </section>
        )}

        {/* ── 4. First account ────────────────────────────────────────────── */}
        {step === 4 && (
          <section aria-labelledby="step-account">
            <h2 id="step-account" style={styles.stepTitle}>
              <Landmark size={18} aria-hidden="true" /> {t('onboarding.addFirstAccount')}
            </h2>
            <p style={styles.hint}>{t('onboarding.accountHint')}</p>

            <div style={styles.formGrid}>
              <div style={field.group}>
                <label style={field.label} htmlFor="ob-acc-name">
                  {t('accounts.accountName')}
                </label>
                <input
                  id="ob-acc-name"
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  placeholder={t('accounts.namePlaceholder')}
                  style={field.input}
                />
              </div>
              <div style={field.group}>
                <label style={field.label} htmlFor="ob-acc-type">
                  {t('accounts.accountType')}
                </label>
                <select
                  id="ob-acc-type"
                  value={subtype}
                  onChange={(event) => setSubtype(event.target.value)}
                  style={field.input}
                >
                  {SUBTYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.key)}
                    </option>
                  ))}
                </select>
              </div>
              <div style={field.group}>
                <label style={field.label} htmlFor="ob-opening">
                  {t('onboarding.openingBalance')} ({currency})
                </label>
                <input
                  id="ob-opening"
                  inputMode="decimal"
                  value={openingBalance}
                  onChange={(event) => setOpeningBalance(event.target.value)}
                  placeholder={t('transactions.amountPlaceholder')}
                  style={field.input}
                  aria-describedby="ob-opening-hint"
                />
                <span id="ob-opening-hint" style={styles.hint}>
                  {t('onboarding.openingBalanceHint')}
                </span>
              </div>
            </div>

            <Actions
              pending={pending}
              nextLabel={t('onboarding.finish')}
              disabled={!accountName.trim()}
              onNext={() =>
                run(async () => {
                  const created = await createFirstAccount({
                    workspaceId,
                    name: accountName,
                    subtype: chosenSubtype.value,
                    accountClass: chosenSubtype.class,
                    currency,
                    openingBalance,
                  });
                  // Only mark the flow finished once the account actually
                  // persisted — otherwise a failed write would still send the
                  // user to an empty dashboard with onboarding marked done.
                  return created.ok ? completeOnboarding() : created;
                }, TOTAL_STEPS + 1)
              }
              onBack={() => setStep(3)}
              backLabel={t('app.back')}
              onSkip={finish}
              skipLabel={t('onboarding.skip')}
            />
          </section>
        )}

        {error && (
          <p role="alert" style={field.error}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

function Actions({
  pending,
  nextLabel,
  onNext,
  onBack,
  backLabel,
  onSkip,
  skipLabel,
  disabled = false,
}: {
  pending: boolean;
  nextLabel: string;
  onNext: () => void;
  onBack?: () => void;
  backLabel?: string;
  onSkip: () => void;
  skipLabel: string;
  disabled?: boolean;
}) {
  return (
    <div style={styles.actions}>
      {onBack && (
        <button type="button" onClick={onBack} disabled={pending} style={field.ghost}>
          {backLabel}
        </button>
      )}
      <button type="button" onClick={onSkip} disabled={pending} style={styles.skip}>
        {skipLabel}
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={pending || disabled}
        style={{ ...field.primary, opacity: pending || disabled ? 0.55 : 1 }}
      >
        {nextLabel}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    background: '#0f172a',
  },
  card: {
    width: '100%',
    maxWidth: 560,
    background: 'rgba(30,41,59,0.55)',
    border: '1px solid #334155',
    borderRadius: '1.25rem',
    padding: '2rem',
  },
  header: { display: 'flex', gap: '0.9rem', alignItems: 'center', marginBottom: '1.5rem' },
  logo: {
    width: 44,
    height: 44,
    borderRadius: '0.75rem',
    background: 'linear-gradient(135deg,#059669,#10b981)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: { fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', margin: 0 },
  subtitle: { fontSize: '0.8125rem', color: '#94a3b8', margin: '2px 0 0' },
  progressTrack: { height: 6, background: '#334155', borderRadius: 3, overflow: 'hidden' },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    background: 'linear-gradient(90deg,#059669,#10b981)',
    transition: 'width 400ms ease-out',
  },
  stepLabel: { fontSize: '0.75rem', color: '#64748b', margin: '0.5rem 0 1.5rem' },
  stepTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1rem',
    fontWeight: 700,
    color: '#f8fafc',
    margin: '0 0 1rem',
  },
  hint: { fontSize: '0.75rem', color: '#64748b', margin: '0 0 1rem', lineHeight: 1.55 },
  choiceGrid: { display: 'grid', gap: '0.6rem' },
  choice: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.85rem 1rem',
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid #334155',
    borderRadius: '0.75rem',
    color: '#cbd5e1',
    fontSize: '0.9375rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
  },
  choiceActive: {
    borderColor: '#10b981',
    background: 'rgba(16,185,129,0.1)',
    color: '#f8fafc',
  },
  choiceLabel: { fontWeight: 500 },
  formGrid: { display: 'grid', gap: '1rem' },
  actions: {
    display: 'flex',
    gap: '0.6rem',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: '1.75rem',
    flexWrap: 'wrap',
  },
  skip: {
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    marginRight: 'auto',
  },
};
