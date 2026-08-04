/** Settings loading state. */
import { LoadingRegion, PageHeaderSkeleton, ListRowsSkeleton } from '../../../components/skeleton';

export default function Loading() {
  return (
    <LoadingRegion label="Loading settings">
      <PageHeaderSkeleton />
      <ListRowsSkeleton rows={5} />
    </LoadingRegion>
  );
}
