'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';
import { Button } from './Button';
import { fluidSpring } from './motion';

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

interface DialogSurfaceProps {
  dialogRef: RefObject<HTMLDivElement | null>;
  titleId: string;
  bodyId?: string;
  reducedMotion: boolean;
  children: ReactNode;
}

/**
 * Presence state belongs to the element AnimatePresence is removing. Keeping
 * it here lets the spring finish visually while the outgoing dialog becomes
 * inert and disappears from the accessibility tree immediately.
 */
function DialogSurface({
  dialogRef,
  titleId,
  bodyId,
  reducedMotion,
  children,
}: DialogSurfaceProps) {
  const isPresent = useIsPresent();

  return (
    <motion.div
      ref={dialogRef}
      className="nx-dialog"
      role={isPresent ? 'alertdialog' : undefined}
      aria-hidden={!isPresent || undefined}
      inert={!isPresent || undefined}
      aria-modal={isPresent ? 'true' : undefined}
      aria-labelledby={isPresent ? titleId : undefined}
      aria-describedby={isPresent ? bodyId : undefined}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
      transition={reducedMotion ? { duration: 0 } : fluidSpring}
    >
      {children}
    </motion.div>
  );
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
  const reducedMotion = useReducedMotion();

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="nx-dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reducedMotion ? { duration: 0 } : fluidSpring}
        >
          <DialogSurface
            dialogRef={dialogRef}
            titleId={titleId}
            bodyId={body ? bodyId : undefined}
            reducedMotion={Boolean(reducedMotion)}
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
              <Button
                variant={destructive ? 'danger' : 'primary'}
                onClick={onConfirm}
                loading={busy}
              >
                {confirmLabel}
              </Button>
            </div>
          </DialogSurface>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
