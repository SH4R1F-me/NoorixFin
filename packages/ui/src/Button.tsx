import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks activation without collapsing the layout. */
  loading?: boolean;
  /** Full width — for forms and mobile layouts. */
  block?: boolean;
  leadingIcon?: ReactNode;
  className?: string;
}

/**
 * The button.
 *
 * Two details here are the reason a shared component beats an inline style
 * object, and both are about the loading state:
 *
 * 1. **`aria-disabled`, not `disabled`, while loading.** A `disabled` button is
 *    removed from the tab order, so a keyboard user who submits a form has
 *    focus destroyed underneath them and is dumped back at the top of the page.
 *    `aria-disabled` keeps focus and still announces the state; the click is
 *    blocked in the handler instead.
 *
 * 2. **The label stays in the DOM.** Swapping the text for a spinner changes
 *    the button's width mid-interaction, which shifts everything around it.
 *    The label is hidden from assistive tech and kept for layout, so the button
 *    does not resize at the moment the user is looking at it.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    block = false,
    leadingIcon,
    children,
    disabled,
    onClick,
    type = 'button',
    className,
    ...rest
  },
  ref,
) {
  const inert = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      // Genuinely disabled buttons keep `disabled`; only the loading state uses
      // the aria form, because only that one is temporary.
      disabled={disabled}
      aria-disabled={inert || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (inert) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={cx(
        'nx-btn',
        `nx-btn--${variant}`,
        `nx-btn--${size}`,
        block && 'nx-btn--block',
        className,
      )}
      {...rest}
    >
      {loading ? <span className="nx-spinner" aria-hidden="true" /> : leadingIcon}
      <span aria-hidden={loading || undefined}>{children}</span>
    </button>
  );
});
