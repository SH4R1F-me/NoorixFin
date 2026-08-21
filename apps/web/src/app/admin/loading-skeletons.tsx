/**
 * Admin skeletons — same rule as components/skeleton.tsx: mirror the real
 * layout so nothing shifts when data lands. These use the operator palette
 * (stone/amber) rather than the dashboard's slate, so a loading admin page still
 * reads as operator mode.
 */
import type { CSSProperties } from 'react';
import { LoadingRegion, Skeleton } from '../../components/skeleton';

const panel: CSSProperties = {
  background: 'rgba(41, 37, 36, 0.45)',
  border: '1px solid #292524',
  borderRadius: '1rem',
};

export function AdminHeaderSkeleton() {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <Skeleton width={220} height={26} />
      <div style={{ marginTop: 6 }}>
        <Skeleton width={340} height={13} />
      </div>
    </div>
  );
}

/** Matches the StatTile grid: label, big number, hint. */
export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ ...panel, padding: '1.1rem 1.25rem' }}>
          <Skeleton width={80} height={11} />
          <div style={{ marginTop: 8 }}>
            <Skeleton width={64} height={28} />
          </div>
          <div style={{ marginTop: 6 }}>
            <Skeleton width={130} height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Matches a Panel with a table inside: header bar plus N rows. */
export function AdminTableSkeleton({ rows = 8, title = 160 }: { rows?: number; title?: number }) {
  return (
    <div style={panel}>
      <div
        className="nf-admin-skeleton-row"
        style={{
          padding: '0.875rem 1.25rem',
          borderBottom: '1px solid #292524',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Skeleton width={title} height={15} />
        <Skeleton width={90} height={15} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="nf-admin-skeleton-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '0.7rem 1rem',
            borderBottom: i === rows - 1 ? 'none' : '1px solid rgba(41,37,36,0.7)',
          }}
        >
          <Skeleton width={58} height={16} style={{ flexShrink: 0 }} />
          <Skeleton width={150} height={13} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <Skeleton width="70%" height={13} />
          </div>
          <Skeleton width={70} height={13} style={{ flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

export function AdminPageSkeleton({
  label,
  stats,
  rows,
}: {
  label: string;
  stats?: number;
  rows?: number;
}) {
  return (
    <LoadingRegion label={label}>
      <AdminHeaderSkeleton />
      {stats ? (
        <div style={{ marginBottom: '1.5rem' }}>
          <StatGridSkeleton count={stats} />
        </div>
      ) : null}
      <AdminTableSkeleton rows={rows ?? 8} />
    </LoadingRegion>
  );
}
