/** Transactions loading state — mirrors the summary strip + row list. */
import {
  LoadingRegion,
  PageHeaderSkeleton,
  SummaryCardsSkeleton,
  ListRowsSkeleton,
} from '../../../components/skeleton';

export default function Loading() {
  return (
    <LoadingRegion label="Loading transactions">
      <PageHeaderSkeleton />
      <SummaryCardsSkeleton count={3} />
      <ListRowsSkeleton rows={8} />
    </LoadingRegion>
  );
}
