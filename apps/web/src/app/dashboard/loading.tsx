/** Dashboard loading state — mirrors page.tsx: 3 summary cards + a recent list. */
import { LoadingRegion, PageHeaderSkeleton, SummaryCardsSkeleton, ListRowsSkeleton } from '../../components/skeleton';

export default function Loading() {
  return (
    <LoadingRegion label="Loading dashboard">
      <PageHeaderSkeleton />
      <SummaryCardsSkeleton count={3} />
      <ListRowsSkeleton rows={5} />
    </LoadingRegion>
  );
}
