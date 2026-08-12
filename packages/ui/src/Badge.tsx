import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'income'
  | 'expense'
  | 'transfer';

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'className'> {
  tone?: BadgeTone;
  /**
   * Text read only by assistive technology, when the badge's meaning is
   * carried by its colour or by nearby context.
   *
   * Blueprint §5.5: colour is never the only signal. A red badge reading
   * "৳1,200" tells a sighted user it is an expense and tells a screen reader
   * user nothing — `srLabel="expense"` closes that gap without adding visible
   * text the design does not want.
   */
  srLabel?: string;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', srLabel, children, className, ...rest }: BadgeProps) {
  return (
    <span className={cx('nx-badge', `nx-badge--${tone}`, className)} {...rest}>
      {srLabel ? (
        <span
          // Visually hidden, still in the accessibility tree. `display: none`
          // and `visibility: hidden` would remove it from both.
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            borderWidth: 0,
          }}
        >
          {srLabel}{' '}
        </span>
      ) : null}
      {children}
    </span>
  );
}
