import type { CSSProperties, HTMLAttributes } from 'react';
import { cx } from './cx';

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  width?: string | number;
  height?: string | number;
  /** Override the corner radius, e.g. a circular avatar placeholder. */
  radius?: string;
}

/**
 * A loading placeholder.
 *
 * Two properties the hand-rolled versions in the app did not have:
 *
 * · **`prefers-reduced-motion` is honoured** (see ui.css). A shimmer that runs
 *   regardless of that setting is exactly what the marketing pages already have
 *   an e2e test forbidding, and skeletons are the most animated thing in the
 *   product.
 * · **The colours are tokens.** The previous implementation hardcoded three
 *   `rgba(30,41,59,…)` values, so a change to the surface colour left the
 *   loading state looking like a different app for one frame.
 *
 * `aria-hidden` on every skeleton, with the live region left to the container
 * that owns the loading state. Announcing "loading" once per placeholder row is
 * worse than announcing nothing.
 */
export function Skeleton({
  width = '100%',
  height = '1rem',
  radius,
  className,
  style,
  ...rest
}: SkeletonProps) {
  const dimensions: CSSProperties = {
    display: 'block',
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: radius,
  };

  return (
    <div
      aria-hidden="true"
      className={cx('nx-skeleton', className)}
      // Caller styles last: a composite skeleton needs to override flex-shrink
      // or the radius without reaching for !important.
      style={{ ...dimensions, ...style }}
      {...rest}
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

/** A paragraph placeholder. The last line is short, as real text tends to be. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={className} style={{ display: 'grid', gap: '0.5rem' }}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={index === lines - 1 ? '60%' : '100%'} height="0.875rem" />
      ))}
    </div>
  );
}
