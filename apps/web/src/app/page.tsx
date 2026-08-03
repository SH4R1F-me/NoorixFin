'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import './landing.css';
import {
  Wallet,
  ArrowRight,
  TrendingUp,
  Shield,
  PieChart,
  Zap,
  Globe,
  ChevronDown,
  Star,
  BarChart3,
  Target,
  CreditCard,
  ArrowUpRight,
  CheckCircle2,
  Sparkles,
  Lock,
  Smartphone,
  Monitor,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   Intersection Observer hook for scroll-triggered animations
   ───────────────────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, isInView };
}

/* ─────────────────────────────────────────────────────────
   Animated counter hook
   ───────────────────────────────────────────────────────── */
function useCounter(end: number, duration: number, start: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration, start]);
  return count;
}

/* ═══════════════════════════════════════════════════════════
   MAIN LANDING PAGE COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function Home() {
  const router = useRouter();
  const [locale, setLocale] = useState<'bn' | 'en'>('bn');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);

  // Scroll-triggered sections
  const heroRef = useInView(0.1);
  const statsRef = useInView(0.2);
  const featuresRef = useInView(0.1);
  const previewRef = useInView(0.1);
  const benefitsRef = useInView(0.1);
  const ctaRef = useInView(0.2);

  // Animated counters
  const usersCount = useCounter(10000, 2000, statsRef.isInView);
  const txnCount = useCounter(500, 2000, statsRef.isInView);
  const securityCount = useCounter(99, 1800, statsRef.isInView);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.push('/dashboard');
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const t = {
    bn: {
      nav: { features: 'ফিচার', security: 'সুরক্ষা', getStarted: 'শুরু করুন' },
      hero: {
        badge: '✨ বাংলাদেশের জন্য তৈরি',
        title1: 'আপনার অর্থের',
        title2: 'সম্পূর্ণ নিয়ন্ত্রণ',
        subtitle: 'আয়, ব্যয়, বাজেট এবং সঞ্চয় লক্ষ্য — সবকিছু এক জায়গায়। স্মার্ট ইনসাইট দিয়ে আর্থিক সিদ্ধান্ত নিন, সহজেই।',
        cta: 'বিনামূল্যে শুরু করুন',
        secondaryCta: 'ফিচার দেখুন',
      },
      stats: [
        { value: '10K+', label: 'সক্রিয় ব্যবহারকারী' },
        { value: '৳500K+', label: 'ট্র্যাক করা লেনদেন' },
        { value: '99.9%', label: 'আপটাইম গ্যারান্টি' },
      ],
      features: {
        title: 'সবকিছু যা আপনার দরকার',
        subtitle: 'আপনার ব্যক্তিগত অর্থ পরিচালনার জন্য শক্তিশালী টুলস',
        items: [
          {
            icon: 'trending',
            title: 'আয়-ব্যয় ট্র্যাকিং',
            desc: 'প্রতিটি লেনদেন স্বয়ংক্রিয়ভাবে ক্যাটাগরি করুন এবং আপনার খরচের প্যাটার্ন দেখুন।',
          },
          {
            icon: 'pie',
            title: 'বাজেট পরিকল্পনা',
            desc: 'মাসিক বাজেট সেট করুন, ক্যাটাগরি ভিত্তিক সীমা নির্ধারণ করুন এবং সতর্কতা পান।',
          },
          {
            icon: 'target',
            title: 'সঞ্চয় লক্ষ্য',
            desc: 'আপনার স্বপ্নের জন্য সঞ্চয় লক্ষ্য তৈরি করুন এবং প্রগতি ট্র্যাক করুন।',
          },
          {
            icon: 'credit',
            title: 'একাধিক অ্যাকাউন্ট',
            desc: 'ব্যাংক, মোবাইল ওয়ালেট, ক্রেডিট কার্ড — সব অ্যাকাউন্ট এক ড্যাশবোর্ডে।',
          },
          {
            icon: 'chart',
            title: 'স্মার্ট রিপোর্ট',
            desc: 'ভিজ্যুয়াল চার্ট ও গ্রাফে আপনার আর্থিক অবস্থা বুঝুন।',
          },
          {
            icon: 'shield',
            title: 'ব্যাংক-গ্রেড সুরক্ষা',
            desc: 'এন্ড-টু-এন্ড এনক্রিপশন, RLS, এবং SOC 2 কমপ্লায়েন্ট ডেটা সুরক্ষা।',
          },
        ],
      },
      preview: {
        title: 'এক নজরে সবকিছু দেখুন',
        subtitle: 'সুন্দর ড্যাশবোর্ডে আপনার সম্পূর্ণ আর্থিক চিত্র',
      },
      benefits: {
        title: 'কেন MyFin বেছে নেবেন?',
        items: [
          { icon: 'zap', text: 'লাইটনিং ফাস্ট পারফরম্যান্স' },
          { icon: 'globe', text: 'বাংলা ও ইংরেজি সাপোর্ট' },
          { icon: 'lock', text: '১০০% প্রাইভেট — কোনো বিজ্ঞাপন নেই' },
          { icon: 'devices', text: 'ওয়েব ও মোবাইল থেকে ব্যবহার করুন' },
          { icon: 'sparkle', text: 'AI-পাওয়ার্ড ইনসাইট (শীঘ্রই)' },
          { icon: 'check', text: 'সম্পূর্ণ বিনামূল্যে শুরু করুন' },
        ],
      },
      cta: {
        title: 'আজই আপনার আর্থিক যাত্রা শুরু করুন',
        subtitle: '১ মিনিটে অ্যাকাউন্ট তৈরি করুন। কোনো ক্রেডিট কার্ড লাগবে না।',
        button: 'বিনামূল্যে অ্যাকাউন্ট তৈরি করুন',
      },
      footer: {
        tagline: 'আপনার ব্যক্তিগত অর্থ সহযোগী',
        copyright: '© ২০২৬ MyFin. সর্বস্বত্ব সংরক্ষিত।',
      },
    },
    en: {
      nav: { features: 'Features', security: 'Security', getStarted: 'Get Started' },
      hero: {
        badge: '✨ Built for Bangladesh',
        title1: 'Take Full Control',
        title2: 'of Your Finances',
        subtitle: 'Income, expenses, budgets and savings goals — all in one place. Make smarter financial decisions with intelligent insights.',
        cta: 'Start for Free',
        secondaryCta: 'See Features',
      },
      stats: [
        { value: '10K+', label: 'Active Users' },
        { value: '৳500K+', label: 'Transactions Tracked' },
        { value: '99.9%', label: 'Uptime Guaranteed' },
      ],
      features: {
        title: 'Everything You Need',
        subtitle: 'Powerful tools for managing your personal finances',
        items: [
          {
            icon: 'trending',
            title: 'Income & Expense Tracking',
            desc: 'Automatically categorize every transaction and visualize your spending patterns.',
          },
          {
            icon: 'pie',
            title: 'Budget Planning',
            desc: 'Set monthly budgets, define category limits, and get alerts when you\'re close.',
          },
          {
            icon: 'target',
            title: 'Savings Goals',
            desc: 'Create savings goals for your dreams and track your progress visually.',
          },
          {
            icon: 'credit',
            title: 'Multi-Account Support',
            desc: 'Banks, mobile wallets, credit cards — all your accounts in one dashboard.',
          },
          {
            icon: 'chart',
            title: 'Smart Reports',
            desc: 'Understand your financial health through beautiful charts and graphs.',
          },
          {
            icon: 'shield',
            title: 'Bank-Grade Security',
            desc: 'End-to-end encryption, RLS policies, and SOC 2 compliant data protection.',
          },
        ],
      },
      preview: {
        title: 'See Everything at a Glance',
        subtitle: 'Your complete financial picture in a beautiful dashboard',
      },
      benefits: {
        title: 'Why Choose MyFin?',
        items: [
          { icon: 'zap', text: 'Lightning Fast Performance' },
          { icon: 'globe', text: 'Bangla & English Support' },
          { icon: 'lock', text: '100% Private — No Ads Ever' },
          { icon: 'devices', text: 'Use from Web & Mobile' },
          { icon: 'sparkle', text: 'AI-Powered Insights (Coming Soon)' },
          { icon: 'check', text: 'Start Completely Free' },
        ],
      },
      cta: {
        title: 'Start Your Financial Journey Today',
        subtitle: 'Create an account in 1 minute. No credit card required.',
        button: 'Create Free Account',
      },
      footer: {
        tagline: 'Your Personal Finance Companion',
        copyright: '© 2026 MyFin. All rights reserved.',
      },
    },
  };

  const text = t[locale];

  const featureIcons: Record<string, React.ReactNode> = {
    trending: <TrendingUp size={24} />,
    pie: <PieChart size={24} />,
    target: <Target size={24} />,
    credit: <CreditCard size={24} />,
    chart: <BarChart3 size={24} />,
    shield: <Shield size={24} />,
  };

  const benefitIcons: Record<string, React.ReactNode> = {
    zap: <Zap size={20} />,
    globe: <Globe size={20} />,
    lock: <Lock size={20} />,
    devices: <Monitor size={20} />,
    sparkle: <Sparkles size={20} />,
    check: <CheckCircle2 size={20} />,
  };

  return (
    <div className="landing-page">
      {/* ── Animated Background ────────────────────────── */}
      <div className="landing-bg">
        <div
          className="landing-bg-orb landing-bg-orb--1"
          style={{
            transform: `translate(${mousePos.x * 0.02}px, ${mousePos.y * 0.02}px)`,
          }}
        />
        <div
          className="landing-bg-orb landing-bg-orb--2"
          style={{
            transform: `translate(${-mousePos.x * 0.015}px, ${-mousePos.y * 0.015}px)`,
          }}
        />
        <div
          className="landing-bg-orb landing-bg-orb--3"
          style={{
            transform: `translate(${mousePos.x * 0.01}px, ${-mousePos.y * 0.01}px)`,
          }}
        />
        <div className="landing-bg-grid" />
      </div>

      {/* ── Navbar ─────────────────────────────────────── */}
      <nav className={`landing-nav ${scrollY > 50 ? 'landing-nav--scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <a href="/" className="landing-nav-logo">
            <div className="landing-nav-logo-icon">
              <Wallet size={20} color="white" />
            </div>
            <span className="landing-nav-logo-text">MyFin</span>
          </a>

          <div className="landing-nav-links">
            <a href="#features" className="landing-nav-link">{text.nav.features}</a>
            <a href="#security" className="landing-nav-link">{text.nav.security}</a>
            <button
              onClick={() => setLocale(locale === 'bn' ? 'en' : 'bn')}
              className="landing-nav-lang"
              aria-label="Switch language"
            >
              <Globe size={14} />
              {locale === 'bn' ? 'EN' : 'বাং'}
            </button>
            <a href="/auth/login" className="landing-nav-cta">
              {text.nav.getStarted}
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════
          SECTION 1: HERO
          ══════════════════════════════════════════════════ */}
      <section
        ref={heroRef.ref}
        className={`landing-hero ${heroRef.isInView ? 'in-view' : ''}`}
      >
        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            {text.hero.badge}
          </div>

          <h1 className="landing-hero-title">
            <span className="landing-hero-title-line1">{text.hero.title1}</span>
            <span className="landing-hero-title-line2">{text.hero.title2}</span>
          </h1>

          <p className="landing-hero-subtitle">
            {text.hero.subtitle}
          </p>

          <div className="landing-hero-actions">
            <a href="/auth/login" className="landing-btn landing-btn--primary landing-btn--lg">
              {text.hero.cta}
              <ArrowRight size={20} />
            </a>
            <a href="#features" className="landing-btn landing-btn--ghost landing-btn--lg">
              {text.hero.secondaryCta}
              <ChevronDown size={20} />
            </a>
          </div>

          {/* Floating mini-cards */}
          <div className="landing-hero-floaters">
            <div className="landing-floater landing-floater--1">
              <TrendingUp size={16} color="#10b981" />
              <span>+12.5%</span>
            </div>
            <div className="landing-floater landing-floater--2">
              <span className="landing-floater-amount">৳85,000</span>
              <span className="landing-floater-label">{locale === 'bn' ? 'আয়' : 'Income'}</span>
            </div>
            <div className="landing-floater landing-floater--3">
              <Star size={14} color="#fbbf24" fill="#fbbf24" />
              <Star size={14} color="#fbbf24" fill="#fbbf24" />
              <Star size={14} color="#fbbf24" fill="#fbbf24" />
              <Star size={14} color="#fbbf24" fill="#fbbf24" />
              <Star size={14} color="#fbbf24" fill="#fbbf24" />
            </div>
          </div>
        </div>

        <div className="landing-hero-scroll-indicator">
          <ChevronDown size={20} />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 2: STATS BAR
          ══════════════════════════════════════════════════ */}
      <section
        ref={statsRef.ref}
        className={`landing-stats ${statsRef.isInView ? 'in-view' : ''}`}
      >
        <div className="landing-stats-inner">
          <div className="landing-stat">
            <span className="landing-stat-value">{usersCount.toLocaleString()}+</span>
            <span className="landing-stat-label">{text.stats[0].label}</span>
          </div>
          <div className="landing-stat-divider" />
          <div className="landing-stat">
            <span className="landing-stat-value">৳{txnCount.toLocaleString()}K+</span>
            <span className="landing-stat-label">{text.stats[1].label}</span>
          </div>
          <div className="landing-stat-divider" />
          <div className="landing-stat">
            <span className="landing-stat-value">{securityCount}.9%</span>
            <span className="landing-stat-label">{text.stats[2].label}</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 3: FEATURES GRID
          ══════════════════════════════════════════════════ */}
      <section
        id="features"
        ref={featuresRef.ref}
        className={`landing-features ${featuresRef.isInView ? 'in-view' : ''}`}
      >
        <div className="landing-section-header">
          <h2 className="landing-section-title">{text.features.title}</h2>
          <p className="landing-section-subtitle">{text.features.subtitle}</p>
        </div>

        <div className="landing-features-grid">
          {text.features.items.map((feature, i) => (
            <div
              key={i}
              className="landing-feature-card"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="landing-feature-icon">
                {featureIcons[feature.icon]}
              </div>
              <h3 className="landing-feature-title">{feature.title}</h3>
              <p className="landing-feature-desc">{feature.desc}</p>
              <div className="landing-feature-arrow">
                <ArrowUpRight size={16} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 4: DASHBOARD PREVIEW
          ══════════════════════════════════════════════════ */}
      <section
        ref={previewRef.ref}
        className={`landing-preview ${previewRef.isInView ? 'in-view' : ''}`}
      >
        <div className="landing-section-header">
          <h2 className="landing-section-title">{text.preview.title}</h2>
          <p className="landing-section-subtitle">{text.preview.subtitle}</p>
        </div>

        <div className="landing-preview-wrapper">
          <div className="landing-preview-glow" />
          <div className="landing-preview-frame">
            <div className="landing-preview-dots">
              <span /><span /><span />
            </div>
            <img
              src="/images/dashboard-preview.png"
              alt="MyFin Dashboard Preview"
              className="landing-preview-img"
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 5: BENEFITS
          ══════════════════════════════════════════════════ */}
      <section
        id="security"
        ref={benefitsRef.ref}
        className={`landing-benefits ${benefitsRef.isInView ? 'in-view' : ''}`}
      >
        <div className="landing-section-header">
          <h2 className="landing-section-title">{text.benefits.title}</h2>
        </div>

        <div className="landing-benefits-grid">
          {text.benefits.items.map((item, i) => (
            <div
              key={i}
              className="landing-benefit-item"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="landing-benefit-icon">
                {benefitIcons[item.icon]}
              </div>
              <span className="landing-benefit-text">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 6: FINAL CTA
          ══════════════════════════════════════════════════ */}
      <section
        ref={ctaRef.ref}
        className={`landing-cta ${ctaRef.isInView ? 'in-view' : ''}`}
      >
        <div className="landing-cta-glow" />
        <div className="landing-cta-content">
          <h2 className="landing-cta-title">{text.cta.title}</h2>
          <p className="landing-cta-subtitle">{text.cta.subtitle}</p>
          <a href="/auth/login" className="landing-btn landing-btn--primary landing-btn--xl">
            {text.cta.button}
            <ArrowRight size={22} />
          </a>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <div className="landing-nav-logo-icon">
              <Wallet size={18} color="white" />
            </div>
            <span className="landing-nav-logo-text" style={{ fontSize: '1.125rem' }}>MyFin</span>
          </div>
          <p className="landing-footer-tagline">{text.footer.tagline}</p>
          <p className="landing-footer-copy">{text.footer.copyright}</p>
        </div>
      </footer>
    </div>
  );
}
