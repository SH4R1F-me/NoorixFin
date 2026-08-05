/**
 * User management — server component fetches, client view handles interaction.
 */
import { getUsers } from '../../../lib/admin';
import { ErrorState, s } from '../ui';
import UsersView from './users-view';

const PAGE_SIZE = 100;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const params = await searchParams;
  const users = await getUsers({
    search: params.search,
    status: params.status,
    limit: PAGE_SIZE,
  });

  if (!users.ok) {
    return (
      <div>
        <div style={s.pageHeader}>
          <h1 style={s.title}>User Management</h1>
        </div>
        <ErrorState error={users.error} />
      </div>
    );
  }

  return (
    <UsersView
      users={users.data.items}
      total={users.data.total}
      search={params.search ?? ''}
      status={params.status ?? ''}
      pendingDeletionCount={
        users.data.items.filter((user) => user.status === 'PENDING_DELETION').length
      }
    />
  );
}
