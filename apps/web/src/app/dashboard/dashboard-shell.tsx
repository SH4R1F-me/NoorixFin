'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from '../auth/actions';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
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
  X,
  Globe,
  Eye,
  EyeOff,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'ড্যাশবোর্ড', labelEn: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'transactions', label: 'লেনদেন', labelEn: 'Transactions', icon: ArrowLeftRight, href: '/dashboard/transactions' },
  { id: 'accounts', label: 'অ্যাকাউন্ট', labelEn: 'Accounts', icon: Landmark, href: '/dashboard/accounts' },
  { id: 'budgets', label: 'বাজেট', labelEn: 'Budgets', icon: PiggyBank, href: '/dashboard/budgets' },
  { id: 'calendar', label: 'ক্যালেন্ডার ও বিল', labelEn: 'Calendar & Bills', icon: Calendar, href: '/dashboard/calendar' },
  { id: 'goals', label: 'লক্ষ্য ও ঋণ', labelEn: 'Goals & Debts', icon: Target, href: '/dashboard/goals' },
  { id: 'reports', label: 'রিপোর্ট', labelEn: 'Reports', icon: BarChart3, href: '/dashboard/reports' },
  { id: 'settings', label: 'সেটিংস', labelEn: 'Settings', icon: Settings, href: '/dashboard/settings' },
];

export default function DashboardShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [locale, setLocale] = useState<'bn' | 'en'>('bn');
  const [privacyMode, setPrivacyMode] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // The email arrives from the server layout, which read it via getUser().
  // No client-side session check: proxy.ts already guarantees an authenticated
  // user reached this route, and with httpOnly cookies the browser could not
  // read the session anyway (DEC-009).

  const activeId = NAV_ITEMS.find((item) => pathname === item.href)?.id || 'dashboard';

  return (
    <div style={styles.wrapper}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={styles.overlay}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
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
            {!collapsed && (
              <span style={styles.logoLabel}>NoorixFin</span>
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
                title={collapsed ? (locale === 'bn' ? item.label : item.labelEn) : undefined}
              >
                <Icon
                  size={20}
                  style={{
                    color: isActive ? '#10b981' : '#64748b',
                    flexShrink: 0,
                  }}
                />
                {!collapsed && (
                  <span style={{
                    ...styles.navLabel,
                    color: isActive ? '#f8fafc' : '#94a3b8',
                  }}>
                    {locale === 'bn' ? item.label : item.labelEn}
                  </span>
                )}
                {isActive && <div style={styles.activeIndicator} />}
              </a>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div style={styles.sidebarFooter}>
          {/* Privacy toggle */}
          <button
            onClick={() => setPrivacyMode(!privacyMode)}
            style={styles.footerBtn}
            title={privacyMode ? 'Show amounts' : 'Hide amounts'}
          >
            {privacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
            {!collapsed && (
              <span style={styles.footerBtnLabel}>
                {locale === 'bn' ? (privacyMode ? 'পরিমাণ দেখান' : 'পরিমাণ লুকান') : (privacyMode ? 'Show' : 'Hide')}
              </span>
            )}
          </button>

          {/* Language */}
          <button
            onClick={() => setLocale(locale === 'bn' ? 'en' : 'bn')}
            style={styles.footerBtn}
          >
            <Globe size={18} />
            {!collapsed && (
              <span style={styles.footerBtnLabel}>
                {locale === 'bn' ? 'English' : 'বাংলা'}
              </span>
            )}
          </button>

          {/* User & Logout */}
          <div style={styles.userSection}>
            <div style={styles.avatar}>
              {userEmail?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div style={styles.userInfo}>
                <span style={styles.userName}>{userEmail?.split('@')[0]}</span>
                <span style={styles.userEmail}>{userEmail}</span>
              </div>
            )}
            <button
              onClick={() => { void signOut(); }}
              style={styles.logoutBtn}
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{
        ...styles.main,
        marginLeft: collapsed ? 72 : 280,
      }}>
        {/* Mobile header */}
        <div style={styles.mobileHeader}>
          <button
            onClick={() => setMobileOpen(true)}
            style={styles.menuBtn}
          >
            <Menu size={22} />
          </button>
          <div style={styles.mobileLogoContainer}>
            <div style={{ ...styles.logoIcon, width: 32, height: 32 }}>
              <Wallet size={16} color="white" />
            </div>
            <span style={{ ...styles.logoLabel, fontSize: '1.125rem' }}>NoorixFin</span>
          </div>
        </div>

        {/* Page content */}
        <div style={styles.pageContent}>
          {children}
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
    background: '#0f172a',
    borderRight: '1px solid #1e293b',
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
    borderBottom: '1px solid #1e293b',
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
    background: 'linear-gradient(135deg, #059669, #10b981)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoLabel: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#f8fafc',
    whiteSpace: 'nowrap',
    letterSpacing: '-0.02em',
  },
  collapseBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #1e293b',
    color: '#64748b',
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
    background: '#10b981',
  },
  sidebarFooter: {
    borderTop: '1px solid #1e293b',
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
    color: '#64748b',
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
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    borderTop: '1px solid #1e293b',
    marginTop: '0.25rem',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #059669, #10b981)',
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
    color: '#f8fafc',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userEmail: {
    fontSize: '0.6875rem',
    color: '#64748b',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    transition: 'margin-left 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    minHeight: '100vh',
    background: '#0f172a',
  },
  mobileHeader: {
    display: 'none',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid #1e293b',
  },
  menuBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
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
    padding: '2rem',
    maxWidth: 1400,
  },
};
