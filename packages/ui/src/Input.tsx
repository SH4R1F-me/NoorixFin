import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: ReactNode;
  /** Shown under the field, and read out with it. */
  hint?: ReactNode;
  /** Any value makes the field invalid. Replaces the hint when present. */
  error?: ReactNode;
  className?: string;
  fieldClassName?: string;
}

/**
 * A labelled text input.
 *
 * The point of this component is the wiring, which is what hand-rolled fields
 * across the app get wrong most often:
 *
 * · The label is a real `<label htmlFor>`, so clicking it focuses the field and
 *   a screen reader announces the two together. A `<span>` above an input looks
 *   identical and does neither.
 * · `aria-describedby` points at the hint **or** the error, so the message is
 *   read with the field rather than being visible only to sighted users.
 * · `aria-invalid` carries the error state, because a red border is colour
 *   alone and §5.5 forbids that as the only signal.
 * · The error text is `role="alert"`, so it is announced when it appears
 *   instead of being silently painted below a field the user has left.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, required, className, fieldClassName, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const messageId = `${inputId}-message`;
  const invalid = Boolean(error);

  return (
    <div className={cx('nx-field', fieldClassName)}>
      <label className="nx-label" htmlFor={inputId}>
        {label}
        {/* The asterisk is decorative; `required` is what assistive tech reads,
            so the symbol is hidden to avoid it being announced as "star". */}
        {required ? (
          <span className="nx-required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className={cx('nx-input', invalid && 'nx-input--invalid', className)}
        {...rest}
      />

      {error ? (
        <p id={messageId} className="nx-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="nx-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
