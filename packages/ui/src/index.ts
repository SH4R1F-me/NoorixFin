/**
 * @noorixfin/ui — the shared component library (audit gap E2).
 *
 * The audit found four shared components in `apps/web/src/components/` against
 * **662 inline `style={{}}` objects across 50 files**. That is not a styling
 * preference, it is why the product shipped three different palettes at once:
 * a value written inline is a value nobody can change centrally.
 *
 * Two rules this package keeps:
 *
 * 1. **No literal design values.** Every colour, radius, spacing step and
 *    duration in `ui.css` is a `var(--…)` from `@noorixfin/design-tokens`. A
 *    component library with its own hardcoded palette would have been a fourth.
 * 2. **Accessibility lives in the component, not in the call site.** Label
 *    association, `aria-describedby` wiring, focus return, focus trapping and
 *    reduced-motion handling are the things hand-rolled markup gets wrong, and
 *    they are the main reason to have this package at all.
 *
 * Usage — import the stylesheet once, at the app's root layout:
 *
 * ```tsx
 * import '@noorixfin/ui/ui.css';
 * import { Button, Card } from '@noorixfin/ui';
 * ```
 *
 * Class names are prefixed `nx-` so they can coexist with the app's existing
 * global CSS while the 662 inline styles are migrated incrementally.
 */
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { ActionLink, type ActionLinkProps } from './ActionLink';
export { FileButton, type FileButtonProps } from './FileButton';
export { Input, type InputProps } from './Input';
export { Select, type SelectProps } from './Select';
export { Card, type CardProps } from './Card';
export { Badge, type BadgeProps, type BadgeTone } from './Badge';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { Skeleton, SkeletonText, type SkeletonProps } from './Skeleton';
export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';
export { Table, type TableProps, type Column } from './Table';
export { cx, type ClassValue } from './cx';
export { Material, type MaterialProps } from './Material';
export { FluidSheet, type FluidSheetProps } from './FluidSheet';
export { fluidSpring, momentumSpring, projectMomentum } from './motion';
