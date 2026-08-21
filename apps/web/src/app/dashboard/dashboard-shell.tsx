'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from '../auth/actions';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  Tags,
  PiggyBank,
  Calendar,
  Target,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Menu,
  Globe,
  Eye,
  EyeOff,
  ShieldAlert,
  Heart,
  Wrench,
  PlugZap,
  Bell,
  Upload,
  Repeat2,
  Hash,
  HandCoins,
} from 'lucide-react';
import BroadcastBanner from '../../components/broadcast-banner';
import CommandPalette from './command-palette';
import { useLocale } from '../../lib/i18n/locale-provider';
import type { Broadcast } from '../../lib/session';

/**
 * Nav entries carry a translation KEY, not a pair of hardcoded strings.
 *
 * The old shape (`label` + `labelEn`) is why adding a third language would have
 * meant editing every component, and why the catalogs sat unused: the strings
 * lived in the components instead.
 */
const NAV_ITEMS = [
  { id: 'dashboard', key: 'nav.dashboard', icon: LayoutDashboard, href: '/dashboard' },
  {
    id: 'transactions',
    key: 'nav.transactions',
    icon: ArrowLeftRight,
    href: '/dashboard/transactions',
  },
  { id: 'accounts', key: 'nav.accounts', icon: Landmark, href: '/dashboard/accounts' },
  { id: 'categories', key: 'categories.title', icon: Tags, href: '/dashboard/categories' },
  { id: 'tags', key: 'nav.tags', icon: Hash, href: '/dashboard/tags' },
  { id: 'budgets', key: 'nav.budgets', icon: PiggyBank, href: '/dashboard/budgets' },
  { id: 'calendar', key: 'nav.calendar', icon: Calendar, href: '/dashboard/calendar' },
  { id: 'recurring', key: 'nav.recurring', icon: Repeat2, href: '/dashboard/recurring' },
  { id: 'goals', key: 'nav.goals', icon: Target, href: '/dashboard/goals' },
  { id: 'debts', key: 'nav.debts', icon: HandCoins, href: '/dashboard/debts' },
  { id: 'reports', key: 'nav.reports', icon: BarChart3, href: '/dashboard/reports' },
  { id: 'import', key: 'nav.importExport', icon: Upload, href: '/dashboard/import' },
  { id: 'settings', key: 'nav.settings', icon: Settings, href: '/dashboard/settings' },
] as const;

export default function DashboardShell({
  children,
  userEmail,
  displayName = '',
  isSuperAdmin = false,
  broadcasts = [],
  maintenance = null,
  donationUrl = '',
  appVersion = '',
  apiReachable = true,
  unreadNotificationCount = 0,
}: {
  children: React.ReactNode;
  userEmail: string;
  displayName?: string;
  /** Resolved server-side from the API. Never from client state (DEC-016). */
  isSuperAdmin?: boolean;
  /** False when the API could not be contacted — drives the degraded banner. */
  apiReachable?: boolean;
  broadcasts?: Broadcast[];
  maintenance?: { enabled: boolean; message_en: string; message_bn: string } | null;
  donationUrl?: string;
  appVersion?: string;
  unreadNotificationCount?: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [notificationCount, setNotificationCount] = useState(unreadNotificationCount);
  // Shared locale (DEC-021). This used to be a private useState, so switching
  // here changed the sidebar and nothing else, and did not survive a reload.
  const { locale, toggleLocale, otherLanguageName, t } = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const refreshCount = () => {
      void fetch('/api/notifications/unread-count', { cache: 'no-store' })
        .then((response) => (response.ok ? (response.json() as Promise<{ count: number }>) : null))
        .then((value) => {
          if (active && value) setNotificationCount(value.count);
        })
        .catch(() => undefined);
    };
    const stream = new EventSource('/api/notification-hints');
    stream.addEventListener('hint', refreshCount);
    const poll = window.setInterval(refreshCount, 60_000);
    return () => {
      active = false;
      stream.close();
      window.clearInterval(poll);
    };
  }, []);

  // The email arrives from the server layout, which read it via getUser().
  // No client-side session check: proxy.ts already guarantees an authenticated
  // user reached this route, and with httpOnly cookies the browser could not
  // read the session anyway (DEC-009).

  const activeId = NAV_ITEMS.find((item) => pathname === item.href)?.id || 'dashboard';

  return (
    <div style={styles.wrapper}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="nf-overlay" style={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        id="dashboard-navigation"
        className="nf-sidebar"
        // A data attribute rather than a second class: the open state is what
        // the media query keys on, and expressing it as data keeps the class
        // list a description of WHAT the element is, not what it is doing.
        data-open={mobileOpen}
        style={{
          ...styles.sidebar,
          width: collapsed ? 72 : 280,
          ...(mobileOpen ? styles.sidebarMobileOpen : {}),
        }}
      >
        {/* Logo */}
        <div style={styles.sidebarHeader}>
          <div style={styles.logoContainer}>
            <div style={styles.logoIcon}>
              <Wallet size={collapsed ? 20 : 22} color="white" />
            </div>
            {!collapsed && <span style={styles.logoLabel}>NoorixFin</span>}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={styles.collapseBtn}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <nav style={styles.nav}>
          {NAV_ITEMS.map((item) => {
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
                style={{
                  ...styles.navItem,
                  ...(isActive ? styles.navItemActive : {}),
                }}
                title={collapsed ? t(item.key) : undefined}
              >
                <Icon
                  size={20}
                  style={{
                    color: isActive ? 'var(--color-primary-500)' : 'var(--text-tertiary)',
                    flexShrink: 0,
                  }}
                />
                {!collapsed && (
                  <span
                    style={{
                      ...styles.navLabel,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {t(item.key)}
                  </span>
                )}
                {isActive && <div style={styles.activeIndicator} />}
              </a>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div style={styles.sidebarFooter}>
          {/*
            The System Admin switch — the other half of the dual-role design
            (DEC-016). Rendered only for operators: a normal user's page contains
            no trace of it, so it cannot be revealed by editing the DOM. Even if
            it were, /admin returns 404 for them, and the API and database refuse
            independently.

            Styled amber to match the console it leads to, so crossing between
            personal finances and platform administration is a visibly
            deliberate act rather than another sidebar link.
          */}
          {isSuperAdmin && (
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                router.push('/admin');
              }}
              style={styles.adminSwitch}
              title="Switch to the System Admin control panel"
            >
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
              {!collapsed && <span style={styles.adminSwitchLabel}>{t('nav.admin')}</span>}
            </a>
          )}

          {donationUrl && !collapsed && (
            <a
              href={donationUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...styles.footerBtn, color: '#be185d', textDecoration: 'none' }}
            >
              <Heart size={18} />
              <span style={styles.footerBtnLabel}>{t('app.supportUs')}</span>
            </a>
          )}

          {/* Privacy toggle */}
          <button
            onClick={() => setPrivacyMode(!privacyMode)}
            style={styles.footerBtn}
            title={t(privacyMode ? 'dashboard.showAmounts' : 'dashboard.hideAmounts')}
          >
            {privacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
            {!collapsed && (
              <span style={styles.footerBtnLabel}>
                {t(privacyMode ? 'dashboard.showAmounts' : 'dashboard.hideAmounts')}
              </span>
            )}
          </button>

          {/* Language */}
          <button onClick={toggleLocale} style={styles.footerBtn}>
            <Globe size={18} />
            {!collapsed && <span style={styles.footerBtnLabel}>{otherLanguageName}</span>}
          </button>

          {/* User & Logout */}
          <div style={styles.userSection}>
            <div style={styles.avatar}>
              {(displayName || userEmail)?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div style={styles.userInfo}>
                <span style={styles.userName}>{displayName || userEmail?.split('@')[0]}</span>
                <span style={styles.userEmail}>{userEmail}</span>
              </div>
            )}
            <button
              onClick={() => {
                void signOut();
              }}
              style={styles.logoutBtn}
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        id="main-content"
        tabIndex={-1}
        className="nf-main"
        style={{
          ...styles.main,
          marginLeft: collapsed ? 72 : 280,
        }}
      >
        <CommandPalette />
        <a
          href="/dashboard/notifications"
          onClick={(event) => {
            event.preventDefault();
            router.push('/dashboard/notifications');
          }}
          style={styles.notificationBell}
          aria-label={
            notificationCount > 0 ? `${notificationCount} unread notifications` : 'Notifications'
          }
        >
          <Bell size={19} aria-hidden="true" />
          {notificationCount > 0 && (
            <span style={styles.notificationBadge} aria-live="polite">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </a>
        {/* Mobile header */}
        <div className="nf-mobile-header" style={styles.mobileHeader}>
          <button
            onClick={() => setMobileOpen(true)}
            style={styles.menuBtn}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="dashboard-navigation"
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <div style={styles.mobileLogoContainer}>
            <div style={{ ...styles.logoIcon, width: 32, height: 32 }}>
              <Wallet size={16} color="white" />
            </div>
            <span style={{ ...styles.logoLabel, fontSize: '1.125rem' }}>NoorixFin</span>
          </div>
        </div>

        {/* Page content */}
        <div className="nf-page-content" style={styles.pageContent}>
          {/*
            Degraded mode. Ranked above even the maintenance notice: if the API
            is unreachable the page below is empty, and an unexplained empty
            finance dashboard is the single most alarming thing this UI can
            show. `role="alert"` rather than `status` because it changes what
            the rest of the page means.
          */}
          {!apiReachable && (
            <div style={styles.offlineBanner} role="alert">
              <PlugZap size={17} style={{ flexShrink: 0 }} aria-hidden="true" />
              <span>{t('app.offlineBody')}</span>
            </div>
          )}

          {/* Operator-set maintenance notice. Above broadcasts because it is
              about the service being degraded right now. */}
          {maintenance?.enabled && (
            <div style={styles.maintenanceBanner} role="status">
              <Wrench size={17} style={{ flexShrink: 0 }} />
              <span>
                {(locale === 'bn' ? maintenance.message_bn : maintenance.message_en) ||
                  t('dashboard.maintenance')}
              </span>
            </div>
          )}

          <BroadcastBanner broadcasts={broadcasts} />

          {children}

          {appVersion && (
            <div style={styles.versionFooter}>
              NoorixFin v{appVersion} · {t('app.free')}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
    position: 'relative',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 40,
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    background: 'var(--bg-primary)',
    borderRight: '1px solid var(--border-primary)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 50,
    overflow: 'hidden',
  },
  sidebarMobileOpen: {
    transform: 'translateX(0)',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.25rem 1rem',
    borderBottom: '1px solid var(--border-primary)',
    minHeight: 64,
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: '0.625rem',
    background: 'var(--color-primary-700)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoLabel: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    letterSpacing: '-0.02em',
  },
  collapseBtn: {
    background: 'var(--bg-card-hover)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-tertiary)',
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
  navItemActive: {
    background: 'rgba(16, 185, 129, 0.08)',
  },
  navLabel: {
    fontSize: '0.875rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 3,
    height: 20,
    borderRadius: '0 3px 3px 0',
    background: 'var(--color-primary-500)',
  },
  sidebarFooter: {
    borderTop: '1px solid var(--border-primary)',
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
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    transition: 'all 150ms',
    width: '100%',
    minHeight: 36,
  },
  footerBtnLabel: {
    whiteSpace: 'nowrap',
  },
  adminSwitch: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.625rem 0.75rem',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.28)',
    borderRadius: '0.625rem',
    color: 'var(--color-warning)',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    fontWeight: 600,
    textDecoration: 'none',
    minHeight: 40,
    marginBottom: '0.35rem',
  },
  adminSwitchLabel: {
    whiteSpace: 'nowrap',
  },
  offlineBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    padding: '0.85rem 1rem',
    background: 'rgba(56,189,248,0.1)',
    border: '1px solid rgba(56,189,248,0.32)',
    borderRadius: '0.75rem',
    color: 'var(--color-transfer)',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  maintenanceBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    padding: '0.85rem 1rem',
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.32)',
    borderRadius: '0.75rem',
    color: 'var(--color-warning)',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  versionFooter: {
    marginTop: '3rem',
    paddingTop: '1rem',
    borderTop: '1px solid var(--border-primary)',
    color: 'var(--text-tertiary)',
    fontSize: '0.75rem',
  },
  notificationBell: {
    position: 'fixed',
    top: '0.9rem',
    right: '1.25rem',
    zIndex: 35,
    width: 42,
    height: 42,
    borderRadius: '0.75rem',
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    boxShadow: '0 8px 24px rgba(2,6,23,0.28)',
  },
  notificationBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    padding: '0 5px',
    borderRadius: 999,
    background: 'var(--color-primary-500)',
    color: 'var(--text-inverse)',
    fontSize: '0.6875rem',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid var(--bg-primary)',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    borderTop: '1px solid var(--border-primary)',
    marginTop: '0.25rem',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'var(--color-primary-700)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'white',
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  userName: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userEmail: {
    fontSize: '0.6875rem',
    color: 'var(--text-tertiary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    transition: 'margin-left 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    minHeight: '100vh',
    background: 'var(--bg-primary)',
  },
  mobileHeader: {
    display: 'none',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--border-primary)',
  },
  menuBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
  },
  mobileLogoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  pageContent: {
    // Fixed shell actions occupy the top-right chrome. Reserving their row
    // keeps page-level actions pointer-reachable instead of layered below it.
    padding: '5rem 2rem 2rem',
    maxWidth: 1400,
  },
};
