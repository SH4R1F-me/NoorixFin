/** Categories loading state. */
import { LoadingRegion, PageHeaderSkeleton, ListRowsSkeleton } from '../../../components/skeleton';

export default function Loading() {
  return (
    <LoadingRegion label="Loading categories">
      <PageHeaderSkeleton />
      <ListRowsSkeleton rows={8} />
    </LoadingRegion>
  );
}
