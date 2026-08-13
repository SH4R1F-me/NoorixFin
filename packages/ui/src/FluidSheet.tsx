'use client';

import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { fluidSpring, momentumSpring, projectMomentum } from './motion';

export interface FluidSheetProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
  dismissThreshold?: number;
}

/**
 * A bottom sheet whose drag is 1:1, uses pointer capture through Motion, hands
 * off release velocity, projects momentum, rubber-bands at its top boundary,
 * and can be re-grabbed while its spring is still moving.
 */
export function FluidSheet({
  open,
  title,
  children,
  onOpenChange,
  dismissThreshold = 180,
}: FluidSheetProps) {
  const y = useMotionValue(0);
  const reducedMotion = useReducedMotion();
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) sheetRef.current?.focus();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="nx-sheet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reducedMotion ? { duration: 0 } : fluidSpring}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onOpenChange(false);
          }}
        >
          <motion.div
            ref={sheetRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="nx-sheet nx-material nx-material--thick"
            style={{ y }}
            initial={reducedMotion ? { opacity: 0 } : { y: '100%' }}
            animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { y: '100%' }}
            transition={fluidSpring}
            drag={reducedMotion ? false : 'y'}
            // The downward path is deliberately unconstrained in normal use,
            // so the surface remains exactly under the pointer. Only the top
            // edge rubber-bands; the generous bottom bound is never a target.
            dragConstraints={{ top: 0, bottom: 10_000 }}
            dragElastic={{ top: 0.06, bottom: 0 }}
            dragMomentum={false}
            onDragEnd={(_event, info) => {
              const projected = y.get() + projectMomentum(info.velocity.y, 0.99);
              if (projected > dismissThreshold || info.velocity.y > 900) {
                onOpenChange(false);
                return;
              }
              animate(y, 0, { ...momentumSpring, velocity: info.velocity.y });
            }}
          >
            <div className="nx-sheet__grabber" aria-hidden="true" />
            <h2 id={titleId} className="nx-sheet__title">
              {title}
            </h2>
            <div className="nx-sheet__body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
