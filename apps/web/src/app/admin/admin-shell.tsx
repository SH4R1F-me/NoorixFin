'use client';

/**
 * Operator shell — deliberately NOT the user shell.
 *
 * The dashboard is emerald on slate. This is amber on near-black, with a
 * persistent "OPERATOR MODE" band. That is a safety feature, not decoration:
 * the whole risk of a dual-role account is doing something administrative while
 * believing you are in your own finances, or the reverse. The two modes must be
 * impossible to confuse at a glance, from across a room.
 *
 * Mirrors dashboard-shell.tsx's structure (inline styles, lucide icons, bn/en
 * labels, collapse behaviour) so the two read as one product.
 */
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from '../../lib/i18n/locale-provider';
import {
  ShieldAlert,
  Activity,
  ScrollText,
  Users,
  Settings2,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Menu,
  Globe,
  Globe2,
  BarChart2,
  Clock,
  Bell,
  Shield,
  LogIn,
  Smartphone,
  AlertTriangle,
  FileText,
  RadioTower,
  PackageOpen,
} from 'lucide-react';

type NavItem = {
  id: string;
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  href: string;
};

type NavSection = {
  label?: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ id: 'overview', key: 'admin.overview', icon: ShieldAlert, href: '/admin' }],
  },
  {
    label: 'admin.monitoring',
    items: [
      { id: 'monitoring', key: 'admin.monitoring', icon: Activity, href: '/admin/monitoring' },
      {
        id: 'performance',
        key: 'admin.performance.title',
        icon: BarChart2,
        href: '/admin/monitoring/performance',
      },
      { id: 'jobs', key: 'admin.jobs.title', icon: Clock, href: '/admin/monitoring/jobs' },
      { id: 'alerts', key: 'admin.alerts.title', icon: Bell, href: '/admin/monitoring/alerts' },
    ],
  },
  {
    label: 'admin.security.title',
    items: [
      { id: 'security', key: 'admin.security.title', icon: Shield, href: '/admin/security' },
      {
        id: 'auth-events',
        key: 'admin.security.authEvents',
        icon: LogIn,
        href: '/admin/security/auth-events',
      },
      {
        id: 'sessions',
        key: 'admin.security.sessions',
        icon: Smartphone,
        href: '/admin/security/sessions',
      },
      {
        id: 'anomalies',
        key: 'admin.security.anomalies',
        icon: AlertTriangle,
        href: '/admin/security/anomalies',
      },
    ],
  },
  {
    items: [
      { id: 'users', key: 'admin.users', icon: Users, href: '/admin/users' },
      { id: 'audit', key: 'admin.audit', icon: ScrollText, href: '/admin/audit' },
      { id: 'broadcasts', key: 'admin.broadcasts', icon: Megaphone, href: '/admin/broadcasts' },
      { id: 'notifications', key: 'admin.notifications', icon: Bell, href: '/admin/notifications' },
      {
        id: 'notification-templates',
        key: 'admin.notificationTemplates',
        icon: FileText,
        href: '/admin/notifications/templates',
      },
      {
        id: 'notification-delivery',
        key: 'admin.notificationDelivery',
        icon: RadioTower,
        href: '/admin/notifications/delivery',
      },
      {
        id: 'site-settings',
        key: 'admin.siteSettings',
        icon: Globe2,
        href: '/admin/site-settings',
      },
      {
        id: 'mobile-releases',
        key: 'admin.mobileReleases',
        icon: PackageOpen,
        href: '/admin/config/releases',
      },
      { id: 'settings', key: 'admin.globalSettings', icon: Settings2, href: '/admin/settings' },
    ],
  },
];

// Flat list for active-id detection
const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

export default function AdminShell({
  children,
  email,
  displayName,
}: {
  children: React.ReactNode;
  email: string;
  displayName: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, toggleLocale, otherLanguageName } = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const activeId =
    ALL_NAV_ITEMS.filter((item) =>
      item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href),
    ).sort((a, b) => b.href.length - a.href.length)[0]?.id ?? 'overview';

  return (
    <div style={styles.wrapper}>
      {mobileOpen && (
        <div className="nf-overlay" style={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className="nf-sidebar"
        data-open={mobileOpen}
        style={{ ...styles.sidebar, width: collapsed ? 72 : 280 }}
      >
        <div style={styles.sidebarHeader}>
          <div style={styles.logoContainer}>
            <div style={styles.logoIcon}>
              <ShieldAlert size={collapsed ? 20 : 22} color="#0c0a09" />
            </div>
            {!collapsed && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={styles.logoLabel}>NoorixFin</span>
                <span style={styles.logoSub}>{t('admin.title')}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={styles.collapseBtn}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav style={styles.nav}>
          {NAV_SECTIONS.map((section, si) => (
            <div key={si}>
              {section.label && !collapsed && (
                <div style={styles.sectionLabel}>{t(section.label as Parameters<typeof t>[0])}</div>
              )}
              {section.label && !collapsed && si > 0 && <div style={styles.sectionDivider} />}
              {section.items.map((item) => {
                const isActive = activeId === item.id;
                const Icon = item.icon;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(item.href);
                      setMobileOpen(false);
                    }}
                    style={{ ...styles.navItem, ...(isActive ? styles.navItemActive : {}) }}
                    title={collapsed ? t(item.key as Parameters<typeof t>[0]) : undefined}
                  >
                    <Icon
                      size={20}
                      style={{ color: isActive ? '#f59e0b' : '#a09990', flexShrink: 0 }}
                    />
                    {!collapsed && (
                      <span style={{ ...styles.navLabel, color: isActive ? '#fafaf9' : '#c9c2bc' }}>
                        {t(item.key as Parameters<typeof t>[0])}
                      </span>
                    )}
                    {isActive && <div style={styles.activeIndicator} />}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <button onClick={toggleLocale} style={styles.footerBtn}>
            <Globe size={18} />
            {!collapsed && <span>{otherLanguageName}</span>}
          </button>

          {/* The way back to one's own finances. Always visible, never nested in
              a menu: the exit from operator mode must be as easy to find as the
              entrance was. */}
          <a
            href="/dashboard"
            onClick={(e) => {
              e.preventDefault();
              router.push('/dashboard');
            }}
            style={styles.exitBtn}
          >
            <ArrowLeft size={18} style={{ flexShrink: 0 }} />
            {!collapsed && <span>{t('nav.backToFinances')}</span>}
          </a>

          <div style={styles.userSection}>
            <div style={styles.avatar}>
              {(displayName || email)?.charAt(0).toUpperCase() || 'A'}
            </div>
            {!collapsed && (
              <div style={styles.userInfo}>
                <span style={styles.userName}>{displayName || email.split('@')[0]}</span>
                <span style={styles.userRole}>{t('admin.superAdmin')}</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main
        id="main-content"
        tabIndex={-1}
        className="nf-main"
        style={{ ...styles.main, marginLeft: collapsed ? 72 : 280 }}
      >
        {/* The band that makes "which mode am I in?" answerable without reading
            a single word of the page. */}
        <div style={styles.operatorBand}>
          <button onClick={() => setMobileOpen(true)} style={styles.menuBtn} aria-label="Open menu">
            <Menu size={18} />
          </button>
          <ShieldAlert size={14} />
          <span style={styles.operatorBandText}>{t('admin.operatorMode')}</span>
        </div>

        <div className="nf-page-content" style={styles.pageContent}>
          {children}
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', minHeight: '100vh', position: 'relative' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 },
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    background: '#0c0a09',
    borderRight: '1px solid #292524',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 50,
    overflow: 'hidden',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.25rem 1rem',
    borderBottom: '1px solid #292524',
    minHeight: 64,
  },
  logoContainer: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: '0.625rem',
    background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoLabel: {
    fontSize: '1.05rem',
    fontWeight: 800,
    color: '#fafaf9',
    whiteSpace: 'nowrap',
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  logoSub: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: '#f59e0b',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  collapseBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #292524',
    color: '#a09990',
    width: 28,
    height: 28,
    borderRadius: '0.375rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  nav: {
    flex: 1,
    padding: '0.75rem 0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.625rem 0.75rem',
    borderRadius: '0.625rem',
    cursor: 'pointer',
    transition: 'all 150ms',
    position: 'relative',
    textDecoration: 'none',
    minHeight: 40,
  },
  navItemActive: { background: 'rgba(245, 158, 11, 0.1)' },
  navLabel: { fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap' },
  sectionLabel: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    // Small uppercase text needs a stronger tone against the near-black rail.
    color: '#a8a29e',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    padding: '0.875rem 0.75rem 0.25rem',
  },
  sectionDivider: {
    height: 1,
    background: '#292524',
    margin: '0.375rem 0.5rem 0.5rem',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 3,
    height: 20,
    borderRadius: '0 3px 3px 0',
    background: '#f59e0b',
  },
  sidebarFooter: {
    borderTop: '1px solid #292524',
    padding: '0.75rem 0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  footerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0.75rem',
    background: 'transparent',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#a09990',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    width: '100%',
    minHeight: 36,
  },
  exitBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.625rem 0.75rem',
    background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: '0.5rem',
    color: '#10b981',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    fontWeight: 600,
    textDecoration: 'none',
    minHeight: 38,
    whiteSpace: 'nowrap',
    marginTop: '0.25rem',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    borderTop: '1px solid #292524',
    marginTop: '0.5rem',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#0c0a09',
    flexShrink: 0,
  },
  userInfo: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  userName: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: '#fafaf9',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userRole: {
    fontSize: '0.625rem',
    color: '#f59e0b',
    fontWeight: 700,
    letterSpacing: '0.06em',
  },
  main: {
    flex: 1,
    transition: 'margin-left 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    minHeight: '100vh',
    background: '#1c1917',
  },
  operatorBand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1.5rem',
    background: 'linear-gradient(90deg, rgba(245,158,11,0.18), rgba(245,158,11,0.04))',
    borderBottom: '1px solid rgba(245,158,11,0.25)',
    color: '#fbbf24',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  operatorBandText: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  menuBtn: {
    background: 'transparent',
    border: 'none',
    color: '#fbbf24',
    cursor: 'pointer',
    padding: 0,
    display: 'none',
  },
  pageContent: { padding: '2rem', maxWidth: 1500 },
};
