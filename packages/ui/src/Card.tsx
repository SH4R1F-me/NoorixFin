'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { cx } from './cx';
import { fluidSpring } from './motion';

export interface CardProps extends Omit<HTMLMotionProps<'div'>, 'title' | 'className'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Right-hand slot in the header — usually a Button or a Badge. */
  action?: ReactNode;
  interactive?: boolean;
  children?: ReactNode;
  className?: string;
  /**
   * Heading level for `title`. Defaults to `h3`.
   *
   * Exposed rather than fixed because heading order is a document-structure
   * property, not a component one: a card inside an `h2` section needs `h3`,
   * and the same card at the top of a page may need `h2`. Hardcoding it is how
   * a page ends up with headings that skip levels, which axe flags and screen
   * reader users navigate by.
   */
  titleAs?: 'h2' | 'h3' | 'h4';
}

export function Card({
  title,
  subtitle,
  action,
  interactive = false,
  children,
  className,
  titleAs: Heading = 'h3',
  ...rest
}: CardProps) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={cx('nx-card', interactive && 'nx-card--interactive', className)}
      whileHover={interactive && !reducedMotion ? { y: -2, scale: 1.005 } : undefined}
      whileTap={interactive && !reducedMotion ? { scale: 0.99 } : undefined}
      transition={fluidSpring}
      {...rest}
    >
      {(title || action) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            {title ? <Heading className="nx-card__title">{title}</Heading> : null}
            {subtitle ? <p className="nx-card__subtitle">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children ? (
        <div className={title || action ? 'nx-card__body' : undefined}>{children}</div>
      ) : null}
    </motion.div>
  );
}
