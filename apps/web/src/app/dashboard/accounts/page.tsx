/**
 * Accounts — server component (DEC-009).
 *
 * Fetches through the NestJS API server-side and hands plain data to the client
 * view. The browser holds no token (httpOnly cookies), so it cannot call the
 * API itself; this is the shape every dashboard screen uses.
 */
import { getActiveWorkspace, getAccounts } from '../../../lib/workspace';
import AccountsView, { type AccountItem } from './accounts-view';

/** Icon/colour by subtype — presentation only, not stored in the ledger. */
const LOOK: Record<string, { icon: string; color: string }> = {
  CASH: { icon: '💵', color: '#10b981' },
  BANK: { icon: '🏦', color: '#3b82f6' },
  MOBILE_WALLET: { icon: '📱', color: '#e2136e' },
  CREDIT_CARD: { icon: '💳', color: '#8b5cf6' },
  LOAN: { icon: '🏠', color: '#ef4444' },
  SAVINGS: { icon: '🛡️', color: '#06b6d4' },
  CATEGORY: { icon: '🏷️', color: '#64748b' },
  SYSTEM: { icon: '⚙️', color: '#64748b' },
};

export default async function AccountsPage() {
  const workspace = await getActiveWorkspace();
  if (!workspace) return <AccountsView accounts={[]} workspaceId="" />;

  const rows = await getAccounts(workspace.id);

  const accounts: AccountItem[] = rows
    // CATEGORY accounts back the category taxonomy (DEC-015); they are not
    // things the user holds money in, so they do not belong on this screen.
    .filter((a) => a.subtype !== 'CATEGORY' && a.subtype !== 'SYSTEM')
    .map((a) => ({
      id: a.id,
      name: a.name,
      class: a.class,
      subtype: a.subtype,
      currency: a.currency_code,
      balance: a.balance_minor ?? 0,
      icon: LOOK[a.subtype]?.icon ?? '💼',
      color: LOOK[a.subtype]?.color ?? '#64748b',
    }));

  return (
    <AccountsView
      accounts={accounts}
      workspaceId={workspace.id}
      currency={workspace.base_currency ?? 'BDT'}
    />
  );
}
