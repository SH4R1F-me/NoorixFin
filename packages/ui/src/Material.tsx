import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export interface MaterialProps extends HTMLAttributes<HTMLDivElement> {
  weight?: 'thin' | 'regular' | 'thick';
  floating?: boolean;
  children?: ReactNode;
}

/** Translucent functional chrome; weight communicates surface hierarchy. */
export function Material({
  weight = 'regular',
  floating = false,
  className,
  children,
  ...rest
}: MaterialProps) {
  return (
    <div
      className={cx(
        'nx-material',
        `nx-material--${weight}`,
        floating && 'nx-material--floating',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
