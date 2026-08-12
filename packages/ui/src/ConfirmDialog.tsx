'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive and is announced as such. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A modal confirmation.
 *
 * The audit asked for a destructive-action confirmation pattern for the admin
 * console (purge, suspend, revoke). The parts that make this safe rather than
 * merely decorative:
 *
 * · **Focus moves into the dialog** on open, and returns to whatever opened it
 *   on close. Without the return, a keyboard user is dropped at the top of the
 *   document after every confirmation.
 * · **Focus is trapped** while open — Tab from the last control wraps to the
 *   first, so it is not possible to tab into the page behind an overlay that
 *   still covers it.
 * · **Cancel is focused first, not confirm.** For a destructive action the
 *   default must be the safe one: a user who opens the dialog and presses
 *   Enter reflexively should cancel, not purge a workspace.
 * · **Escape cancels**, and the backdrop is inert — a misclick beside a dialog
 *   should not confirm anything, and dismissing on backdrop click is a coin
 *   flip on whether the user meant it.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      // Wrap in both directions. Without the shift branch, Shift+Tab from the
      // first control escapes the dialog and lands behind the overlay.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="nx-dialog-backdrop">
      <div
        ref={dialogRef}
        className="nx-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={body ? bodyId : undefined}
      >
        <h2 id={titleId} className="nx-dialog__title">
          {title}
        </h2>
        {body ? (
          <div id={bodyId} className="nx-dialog__body">
            {body}
          </div>
        ) : null}

        <div className="nx-dialog__actions">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
