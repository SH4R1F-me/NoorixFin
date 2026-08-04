/** Accounts loading state — 3 summary cards (assets/liabilities/net worth) + cards. */
import { LoadingRegion, PageHeaderSkeleton, SummaryCardsSkeleton, ListRowsSkeleton } from '../../../components/skeleton';

export default function Loading() {
  return (
    <LoadingRegion label="Loading accounts">
      <PageHeaderSkeleton />
      <SummaryCardsSkeleton count={3} />
      <ListRowsSkeleton rows={6} />
    </LoadingRegion>
  );
}
