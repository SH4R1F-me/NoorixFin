'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { cx } from './cx';
import { fluidSpring } from './motion';
import type { ButtonSize, ButtonVariant } from './Button';

export interface ActionLinkProps extends Omit<HTMLMotionProps<'a'>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}

export function ActionLink({
  variant = 'secondary',
  size = 'md',
  block = false,
  className,
  children,
  ...rest
}: ActionLinkProps) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.a
      className={cx(
        'nx-btn',
        `nx-btn--${variant}`,
        `nx-btn--${size}`,
        block && 'nx-btn--block',
        className,
      )}
      whileTap={!reducedMotion ? { scale: 0.97 } : undefined}
      transition={fluidSpring}
      {...rest}
    >
      {children}
    </motion.a>
  );
}
