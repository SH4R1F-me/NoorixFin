/**
 * (marketing)/layout.tsx
 *
 * Shared layout for all public marketing pages.
 * Wraps children with the marketing nav and footer.
 * Does NOT require authentication (public routes).
 */
import type { Metadata } from 'next';
import MarketingNav from './components/marketing-nav';
import MarketingFooter from './components/marketing-footer';
import './marketing.css';

export const metadata: Metadata = {
  // NEXT_PUBLIC_SITE_URL, not NEXT_PUBLIC_APP_URL: the latter is defined nowhere
  // (not in .env.example, not in any .env.local), so this always fell back to
  // port 3030 — which nothing runs on. Every canonical and og: URL resolved
  // against a dead origin. SITE_URL is the documented name and is what
  // auth/actions.ts already uses for redirect origins.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'NoorixFin — Free & Open-Source Personal Finance',
    template: '%s | NoorixFin',
  },
  description:
    'NoorixFin is a free and open-source personal finance management system. Track income, expenses, budgets, and savings goals. Built in public, for everyone.',
  openGraph: {
    type: 'website',
    siteName: 'NoorixFin',
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="m-page">
      <MarketingNav />
      <div className="m-body">
        {children}
      </div>
      <MarketingFooter />
    </div>
  );
}
