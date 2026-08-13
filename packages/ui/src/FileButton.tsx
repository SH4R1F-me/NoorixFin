'use client';

import { useRef, type ChangeEvent, type ReactNode } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from './Button';

export interface FileButtonProps {
  accept?: string;
  disabled?: boolean;
  children: ReactNode;
  leadingIcon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  ariaLabel?: string;
  onFile: (file: File) => void;
}

/** Keyboard-accessible file chooser with the same instant spring press response as Button. */
export function FileButton({
  accept,
  disabled,
  children,
  leadingIcon,
  variant = 'ghost',
  size = 'sm',
  ariaLabel,
  onFile,
}: FileButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const changed = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    event.target.value = '';
  };
  return (
    <span className="nx-file-button">
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        leadingIcon={leadingIcon}
        aria-label={ariaLabel}
        onClick={() => inputRef.current?.click()}
      >
        {children}
      </Button>
      <input
        ref={inputRef}
        className="nx-visually-hidden"
        type="file"
        accept={accept}
        aria-label={ariaLabel ?? (typeof children === 'string' ? children : 'Choose file')}
        tabIndex={-1}
        onChange={changed}
      />
    </span>
  );
}
