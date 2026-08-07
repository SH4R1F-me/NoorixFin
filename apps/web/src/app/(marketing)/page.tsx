/**
 * (marketing)/page.tsx — NoorixFin Home
 * Fully expanded consumer-focused landing page.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, Shield, PieChart, Target, Heart,
  GraduationCap, Users, Briefcase, TrendingUp,
  Smartphone, Lock, CheckCircle2, Star, GitFork,
  Zap, BarChart3, WifiOff, Eye
} from 'lucide-react';
import { FadeUp, StaggerGrid, StaggerItem, TiltCard } from './components/motion';
import { getServerT, getServerRawObject } from '../../lib/i18n/locale';
import SavingsCalculator from './components/calculator-client';

export const metadata: Metadata = {
  title: 'NoorixFin — Free & Open-Source Personal Finance for Everyone',
  description:
    'Take full control of your money. 100% free personal finance manager for students, families, freelancers & professionals. No ads, no subscriptions, no data selling.',
  keywords: 'personal finance, budget tracker, free, open source, bangla, students, families, freelancers',
};

function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

/**
 * Copy lives in the catalogs, never here.
 *
 * The stats, the feature grid and the three audience cards were previously
 * hardcoded English arrays in this file, so a Bangla reader — the primary
 * audience — got an English landing page below the hero. Only the icon and the
 * accent colour are presentational, so only those stay in code.
 */
const FEATURE_ICONS = [PieChart, Target, BarChart3, Shield, WifiOff, Heart];

/** Icon + accent per audience. The per-audience colour is deliberate. */
const AUDIENCES = [
  { key: 'students', icon: GraduationCap, accent: '#10b981', tint: 'rgba(16,185,129,0.12)' },
  { key: 'families', icon: Users, accent: '#60a5fa', tint: 'rgba(59,130,246,0.12)' },
  { key: 'professionals', icon: Briefcase, accent: '#fbbf24', tint: 'rgba(245,158,11,0.12)' },
] as const;

interface AudienceCopy {
  title: string;
  desc: string;
  badge: string;
  hook: string;
  points: string[];
}

export default async function HomePage() {
  const t = await getServerT();
  const [trustPoints, stats, features, audiences] = await Promise.all([
    getServerRawObject<string[]>('marketing.homePage.trustPoints'),
    getServerRawObject<{ value: string; label: string }[]>('marketing.homePage.stats'),
    getServerRawObject<{ title: string; desc: string }[]>('marketing.homePage.features'),
    getServerRawObject<Record<string, AudienceCopy>>('marketing.audiences'),
  ]);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="m-hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="m-orb m-orb-green" style={{ width: 700, height: 700, top: -250, left: '50%', transform: 'translateX(-50%)' }} />
        <div className="m-orb m-orb-blue" style={{ width: 300, height: 300, top: 100, right: -100, opacity: 0.15 }} />

        <FadeUp>
          <div className="m-badge" style={{ marginBottom: '1.5rem' }}>
            <span aria-hidden="true">🌱</span> {t('marketing.homePage.heroBadge')}
          </div>

          <h1 className="m-h1">
            {t('marketing.hero.title').split('. ').map((part: string, i: number, arr: string[]) => (
              <span key={i}>
                {i === arr.length - 1
                  ? <span className="m-gradient-text">{part}</span>
                  : <>{part}.<br /></>}
              </span>
            ))}
          </h1>

          <p className="m-lead" style={{ margin: '1.75rem auto 0', textAlign: 'center', maxWidth: '680px', fontSize: '1.15rem', lineHeight: 1.75 }}>
            {t('marketing.hero.subtitle')}
          </p>
        </FadeUp>

        <FadeUp delay={0.18}>
          <div className="m-hero-actions">
            <Link href="/auth/login" className="m-btn-primary m-hero-btn-lg" id="hero-cta-primary">
              {t('marketing.hero.ctaPrimary')} <ArrowRight size={18} />
            </Link>
            <Link href="/features" className="m-btn-outline m-hero-btn-lg" id="hero-cta-secondary">
              {t('marketing.hero.ctaSecondary')}
            </Link>
          </div>
        </FadeUp>

        <FadeUp delay={0.28}>
          <div className="m-hero-stars">
            <GithubIcon size={16} />
            <span>{t('marketing.homePage.heroStars')}</span>
          </div>
        </FadeUp>

        {/* Stats bar */}
        <FadeUp delay={0.35}>
          <div className="m-hero-stats">
            {stats.map((s) => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div className="m-hero-stat-val m-gradient-text">{s.value}</div>
                <div className="m-hero-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </FadeUp>
      </section>

      {/* ── Built for every stage of your life ───────── */}
      <section className="m-section-full" style={{ background: 'rgba(10,15,30,0.7)', borderTop: '1px solid var(--m-border)', borderBottom: '1px solid var(--m-border)' }}>
        <div className="m-section-inner" style={{ maxWidth: '940px' }}>
          <FadeUp>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.homePage.eyebrowRealPeople')}</div>
              <h2 className="m-h2">{t('marketing.audiences.title')}</h2>
              <p className="m-lead" style={{ margin: '1.25rem auto 0', maxWidth: '640px' }}>
                {t('marketing.audiences.subtitle')}
              </p>
            </div>
          </FadeUp>

          {AUDIENCES.map((a, i) => {
            const copy = audiences[a.key];
            const Icon = a.icon;
            const isLast = i === AUDIENCES.length - 1;
            return (
              <FadeUp key={a.key} delay={0.08 + i * 0.04}>
                <div
                  className="m-card m-card-3d"
                  style={{
                    padding: '2.5rem',
                    borderLeft: `4px solid ${a.accent}`,
                    marginBottom: isLast ? 0 : '2rem',
                  }}
                >
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ background: a.tint, padding: '1.25rem', borderRadius: '16px', color: a.accent, flexShrink: 0 }}>
                      <Icon size={36} />
                    </div>
                    <div style={{ flex: 1, minWidth: '280px' }}>
                      <div
                        className="m-badge"
                        style={{
                          marginBottom: '0.75rem',
                          fontSize: '0.7rem',
                          background: a.tint,
                          color: a.accent,
                          borderColor: a.accent,
                        }}
                      >
                        {copy.badge}
                      </div>
                      <h3 className="m-h3" style={{ fontSize: '1.6rem', marginBottom: '1rem' }}>
                        {copy.title}
                      </h3>
                      <p style={{ fontSize: '1.05rem', color: 'var(--m-muted)', lineHeight: 1.85, marginBottom: '1rem' }}>
                        {copy.desc}
                      </p>
                      <p style={{ fontSize: '1rem', color: 'var(--m-muted)', lineHeight: 1.8 }}>
                        {copy.hook}
                      </p>
                      <ul style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {copy.points.map((item) => (
                          <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: 'var(--m-muted)', fontSize: '0.9375rem' }}>
                            <CheckCircle2 size={16} style={{ color: a.accent, flexShrink: 0 }} />{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </FadeUp>
            );
          })}
        </div>
      </section>

      {/* ── Interactive Savings Calculator ─────────────── */}
      <section className="m-section">
        <FadeUp>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.homePage.eyebrowTryIt')}</div>
            <h2 className="m-h2">{t('marketing.calculator.title')}</h2>
            <p className="m-lead" style={{ margin: '1rem auto 0' }}>{t('marketing.calculator.subtitle')}</p>
          </div>
        </FadeUp>
        <FadeUp delay={0.1}>
          <SavingsCalculator translations={{
            title: t('marketing.calculator.title'),
            subtitle: t('marketing.calculator.subtitle'),
            monthlyIncome: t('marketing.calculator.monthlyIncome'),
            monthlyExpenses: t('marketing.calculator.monthlyExpenses'),
            savingsGoal: t('marketing.calculator.savingsGoal'),
            timeToReach: t('marketing.calculator.timeToReach'),
            months: t('marketing.calculator.months'),
            years: t('marketing.calculator.years'),
            almostThere: t('marketing.calculator.almostThere'),
            deficit: t('marketing.calculator.deficit'),
          }} />
        </FadeUp>
      </section>

      {/* ── Features Grid ──────────────────────────────── */}
      <section className="m-section-full" style={{ background: 'rgba(10,15,30,0.5)', borderTop: '1px solid var(--m-border)', borderBottom: '1px solid var(--m-border)' }}>
        <div className="m-section-inner">
          <FadeUp>
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.homePage.eyebrowWhatYouGet')}</div>
              <h2 className="m-h2">{t('marketing.features.title')}</h2>
              <p className="m-lead" style={{ margin: '1rem auto 0' }}>{t('marketing.features.subtitle')}</p>
            </div>
          </FadeUp>
          <StaggerGrid className="m-grid-3">
            {features.map((f, i) => {
              const Icon = FEATURE_ICONS[i] ?? PieChart;
              return (
                <StaggerItem key={f.title}>
                  <TiltCard>
                    <div className="m-card" style={{ height: '100%' }}>
                      <div className="m-card-icon"><Icon size={22} /></div>
                      <h3 className="m-h3" style={{ marginBottom: '0.625rem', fontSize: '1.05rem' }}>{f.title}</h3>
                      <p style={{ fontSize: '0.9rem', color: 'var(--m-muted)', lineHeight: 1.7 }}>{f.desc}</p>
                    </div>
                  </TiltCard>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        </div>
      </section>

      {/* ── Privacy & Trust ────────────────────────────── */}
      <section className="m-section">
        <div className="m-grid-2" style={{ alignItems: 'center', gap: '4rem' }}>
          <FadeUp>
            <div>
              <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.homePage.eyebrowSecurity')}</div>
              <h2 className="m-h2" style={{ marginBottom: '1.25rem' }}>{t('marketing.homePage.privacyTitle')}</h2>
              <p style={{ color: 'var(--m-muted)', lineHeight: 1.8, fontSize: '1rem', marginBottom: '1.5rem' }}>
                {t('marketing.homePage.privacyBody1')}
              </p>
              <p style={{ color: 'var(--m-muted)', lineHeight: 1.8, fontSize: '1rem', marginBottom: '2rem' }}>
                {t('marketing.homePage.privacyBody2')}
              </p>
              <Link href="/security" className="m-btn-outline">
                {t('marketing.homePage.privacyCta')} <ArrowRight size={16} />
              </Link>
            </div>
          </FadeUp>
          <FadeUp delay={0.12}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {trustPoints.map((text, i) => {
                const Icon = [Lock, Eye, Zap, CheckCircle2, Smartphone, TrendingUp][i];
                return (
                  <div key={text} className="m-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ color: 'var(--m-green)', flexShrink: 0 }}><Icon size={20} /></div>
                    <span style={{ fontSize: '0.9375rem', color: 'var(--m-muted)' }}>{text}</span>
                  </div>
                );
              })}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Open Source Philosophy ─────────────────────── */}
      <section className="m-section-full" style={{ background: 'rgba(16,185,129,0.04)', borderTop: '1px solid rgba(16,185,129,0.12)', borderBottom: '1px solid rgba(16,185,129,0.12)' }}>
        <div className="m-section-inner" style={{ textAlign: 'center', maxWidth: '720px' }}>
          <FadeUp>
            <div className="m-eyebrow" style={{ justifyContent: 'center' }}><span className="m-eyebrow-dot" />{t('marketing.homePage.eyebrowOpenSource')}</div>
            <h2 className="m-h2" style={{ marginBottom: '1.25rem' }}>{t('marketing.homePage.openSourceTitle')}</h2>
            <p style={{ color: 'var(--m-muted)', lineHeight: 1.85, fontSize: '1.05rem', marginBottom: '1.5rem' }}>
              {t('marketing.homePage.openSourceBody1')}
            </p>
            <p style={{ color: 'var(--m-muted)', lineHeight: 1.85, fontSize: '1.05rem', marginBottom: '2.5rem' }}>
              {t('marketing.homePage.openSourceBody2')}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="https://github.com/SH4R1F-me/NoorixFin" target="_blank" rel="noopener noreferrer" className="m-btn-outline m-hero-btn-lg">
                <GithubIcon size={18} /> {t('marketing.homePage.viewSource')}
              </a>
              <Link href="/open-source" className="m-btn-ghost m-hero-btn-lg">
                {t('marketing.homePage.ourPhilosophy')} <ArrowRight size={16} />
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Star / Community social proof ─────────────── */}
      <section className="m-section">
        <FadeUp>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div className="m-eyebrow"><span className="m-eyebrow-dot" />{t('marketing.homePage.eyebrowCommunity')}</div>
            <h2 className="m-h2">{t('marketing.homePage.communityTitle')}</h2>
            <p className="m-lead" style={{ margin: '1rem auto 0', maxWidth: '560px' }}>
              {t('marketing.homePage.communitySubtitle')}
            </p>
          </div>
        </FadeUp>
        <StaggerGrid className="m-grid-3">
          {[
            { icon: GitFork, title: t('marketing.homePage.fork'), desc: t('marketing.homePage.forkDesc') },
            { icon: Star, title: t('marketing.homePage.star'), desc: t('marketing.homePage.starDesc') },
            { icon: Heart, title: t('marketing.homePage.donate'), desc: t('marketing.homePage.donateDesc') },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <StaggerItem key={c.title}>
                <div className="m-card" style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="m-card-icon" style={{ margin: '0 auto 1rem' }}><Icon size={24} /></div>
                  <h3 className="m-h3" style={{ marginBottom: '0.5rem' }}>{c.title}</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--m-muted)', lineHeight: 1.7 }}>{c.desc}</p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      </section>

      {/* ── Final CTA ──────────────────────────────────── */}
      <section className="m-section-full" style={{ background: 'rgba(10,15,30,0.8)', borderTop: '1px solid var(--m-border)', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
        <div className="m-orb m-orb-green" style={{ width: 600, height: 600, bottom: -300, left: '50%', transform: 'translateX(-50%)', opacity: 0.18 }} />
        <div className="m-section-inner" style={{ maxWidth: '680px', position: 'relative', zIndex: 1 }}>
          <FadeUp>
            <div className="m-badge" style={{ marginBottom: '1.5rem' }}>
              <span aria-hidden="true">🚀</span> {t('marketing.homePage.ctaBadge')}
            </div>
            <h2 className="m-h2" style={{ marginBottom: '1.25rem' }}>{t('marketing.cta.title')}</h2>
            <p className="m-lead" style={{ margin: '0 auto 2.5rem' }}>{t('marketing.cta.subtitle')}</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/auth/login" className="m-btn-primary m-hero-btn-lg" id="bottom-cta">
                {t('marketing.cta.button')} <ArrowRight size={18} />
              </Link>
              <Link href="/docs" className="m-btn-outline m-hero-btn-lg">
                {t('marketing.homePage.readDocs')}
              </Link>
            </div>
            <p style={{ marginTop: '1.75rem', fontSize: '0.8125rem', color: 'var(--m-faint)' }}>
              {t('marketing.homePage.ctaNote')}
            </p>
          </FadeUp>
        </div>
      </section>
    </>
  );
}
