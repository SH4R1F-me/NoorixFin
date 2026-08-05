import { AdminPageSkeleton } from './loading-skeletons';

export default function Loading() {
  return <AdminPageSkeleton label="Loading system overview" stats={4} rows={6} />;
}
