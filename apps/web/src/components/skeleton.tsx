/**
 * Skeleton primitives — DEC-012.
 *
 * Two rules these exist to enforce:
 *
 *  1. **Skeletons mirror the final layout.** Same heights, same gaps, same grid.
 *     A skeleton that doesn't match its content shifts the page when data lands,
 *     which is worse than a spinner — the user starts reading, then everything
 *     moves. Every dimension here is copied from the real component.
 *
 *  2. **Balances and report figures get skeletons, never optimistic values**
 *     (DEC-012). Showing a guessed balance that later corrects itself destroys
 *     trust in a finance app in a way a brief blank never does.
 */
import type { CSSProperties } from 'react';

const shimmer: CSSProperties = {
  background:
    'linear-gradient(90deg, rgba(30,41,59,0.5) 25%, rgba(51,65,85,0.7) 50%, rgba(30,41,59,0.5) 75%)',
  backgroundSize: '200% 100%',
  animation: 'nf-shimmer 1.4s ease-in-out infinite',
  borderRadius: '0.5rem',
};

export function Skeleton({
  width = '100%',
  height = 16,
  style,
}: {
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      data-testid="skeleton"
      style={{ ...shimmer, width, height, ...style }}
    />
  );
}

/** Screen-reader announcement — the shimmer itself is aria-hidden. */
export function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <span
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

/** Matches the summary cards on the dashboard and accounts pages. */
export function SummaryCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: '1.25rem',
            background: 'rgba(30,41,59,0.5)',
            border: '1px solid #1e293b',
            borderRadius: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <Skeleton width={90} height={12} />
          {/* The balance itself — deliberately a skeleton, never a guess. */}
          <Skeleton width={140} height={28} />
        </div>
      ))}
    </div>
  );
}

/** Matches a transaction/account row: 44px icon, two text lines, right-aligned amount. */
export function ListRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      style={{
        background: 'rgba(30,41,59,0.3)',
        border: '1px solid #1e293b',
        borderRadius: '1rem',
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem 1.25rem',
            borderBottom: i === rows - 1 ? 'none' : '1px solid #1e293b',
          }}
        >
          <Skeleton width={44} height={44} style={{ borderRadius: '0.75rem', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width="45%" height={14} />
            <Skeleton width="25%" height={11} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <Skeleton width={80} height={14} />
            <Skeleton width={44} height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Matches the page header: title + subtitle. */
export function PageHeaderSkeleton() {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <Skeleton width={200} height={28} />
      <div style={{ marginTop: 6 }}>
        <Skeleton width={110} height={13} />
      </div>
    </div>
  );
}
