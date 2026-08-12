import type { ReactNode } from 'react';
import { cx } from './cx';

export interface EmptyStateProps {
  /** Emoji or icon node. Decorative — never the only carrier of meaning. */
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** The one thing to do next. An empty state without an action is a dead end. */
  action?: ReactNode;
  className?: string;
}

/**
 * The state a screen is in most often on day one.
 *
 * A blank table is indistinguishable from a broken one, and the audit found
 * that every new page needs a designed empty state rather than nothing. The
 * `action` slot is the part that matters: "no transactions yet" is a
 * statement, "no transactions yet — [Add your first]" is a product.
 */
export function EmptyState({ icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cx('nx-empty', className)}>
      {icon ? (
        <div className="nx-empty__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className="nx-empty__title">{title}</p>
      {body ? <p className="nx-empty__body">{body}</p> : null}
      {action}
    </div>
  );
}
