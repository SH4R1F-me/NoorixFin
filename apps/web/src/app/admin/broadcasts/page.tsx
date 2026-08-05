import { getBroadcasts } from '../../../lib/admin';
import { ErrorState, s } from '../ui';
import BroadcastsView from './broadcasts-view';

export default async function BroadcastsPage() {
  const broadcasts = await getBroadcasts();

  if (!broadcasts.ok) {
    return (
      <div>
        <div style={s.pageHeader}>
          <h1 style={s.title}>Broadcasts</h1>
        </div>
        <ErrorState error={broadcasts.error} />
      </div>
    );
  }

  return <BroadcastsView broadcasts={broadcasts.data} />;
}
