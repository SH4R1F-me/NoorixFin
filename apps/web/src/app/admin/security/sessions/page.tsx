/**
 * /admin/security/sessions — active device sessions, force-revoke actions.
 */
import { getActiveSessions } from '../../../../lib/admin';
import SessionsView from './sessions-view';

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const platform = sp.platform;
  const page = Math.max(0, parseInt(sp.page ?? '0', 10) || 0);
  const limit = 50;

  const result = await getActiveSessions({ platform, limit, offset: page * limit });

  return (
    <SessionsView
      data={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
      platform={platform}
      page={page}
    />
  );
}
