import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cx } from './cx';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  fieldClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, id, required, className, fieldClassName, children, ...rest },
  ref,
) {
  const generated = useId();
  const selectId = id ?? generated;
  const messageId = `${selectId}-message`;
  const invalid = Boolean(error);
  return (
    <div className={cx('nx-field', fieldClassName)}>
      <label className="nx-label" htmlFor={selectId}>
        {label}
        {required ? (
          <span className="nx-required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <select
        ref={ref}
        id={selectId}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className={cx('nx-select', invalid && 'nx-input--invalid', className)}
        {...rest}
      >
        {children}
      </select>
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
