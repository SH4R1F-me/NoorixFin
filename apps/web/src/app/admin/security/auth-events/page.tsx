/**
 * /admin/security/auth-events — paginated auth audit events with platform filter.
 */
import { getAuthEvents } from '../../../../lib/admin';
import AuthEventsView from './auth-events-view';

export default async function AuthEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const platform = sp.platform;
  const page = Math.max(0, parseInt(sp.page ?? '0', 10) || 0);
  const limit = 50;

  const result = await getAuthEvents({ platform, limit, offset: page * limit });

  return (
    <AuthEventsView
      data={result.ok ? result.data : null}
      error={result.ok ? null : result.error}
      platform={platform}
      page={page}
    />
  );
}
