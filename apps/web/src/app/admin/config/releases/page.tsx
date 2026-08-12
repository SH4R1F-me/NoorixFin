import { getMobileRelease } from '../../../../lib/admin';
import { ErrorState, s } from '../../ui';
import ReleasesView from './releases-view';

export default async function ReleasesPage() {
  const result = await getMobileRelease();
  if (!result.ok)
    return (
      <div>
        <div style={s.pageHeader}>
          <h1 style={s.title}>Mobile releases</h1>
        </div>
        <ErrorState error={result.error} />
      </div>
    );
  return <ReleasesView release={result.data} />;
}
