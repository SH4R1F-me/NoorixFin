/** Mobile roles derived from the same tokens that generate the web CSS. */
import {
  colors,
  semantic,
  spacing,
  radii,
  letterSpacing,
  lineHeights,
} from '@noorixfin/design-tokens';

export const Colors = {
  bg: semantic.bgPrimary,
  bgCard: semantic.bgCard,
  bgElevated: semantic.bgSecondary,
  bgSurface: semantic.bgTertiary,
  border: 'rgba(99,130,191,0.15)',
  borderStrong: 'rgba(99,130,191,0.3)',
  accent: colors.primary[500],
  accentLight: 'rgba(16,185,129,0.15)',
  ok: colors.success,
  warn: colors.warning,
  error: colors.error,
  info: colors.info,
  text: semantic.textPrimary,
  textDim: semantic.textSecondary,
  textFaint: semantic.textTertiary,
  income: colors.income,
  expense: colors.expense,
  transfer: colors.transfer,
} as const;

export const Spacing = {
  xs: spacing[1],
  sm: spacing[2],
  md: spacing[4],
  lg: spacing[6],
  xl: spacing[8],
  xxl: spacing[12],
} as const;

export const Typography = {
  h1: {
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.7,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  h2: {
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.33,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  h3: {
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.2,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  body: {
    fontSize: 15,
    lineHeight: 15 * lineHeights.normal,
    letterSpacing: 0,
    fontWeight: '400' as const,
    color: Colors.text,
  },
  bodyDim: {
    fontSize: 15,
    lineHeight: 15 * lineHeights.normal,
    letterSpacing: 0,
    fontWeight: '400' as const,
    color: Colors.textDim,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.15,
    fontWeight: '400' as const,
    color: Colors.textFaint,
  },
  label: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600' as const,
    color: Colors.textFaint,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.66,
  },
  amount: { fontSize: 15, lineHeight: 20, letterSpacing: 0, fontWeight: '700' as const },
  amountLg: { fontSize: 24, lineHeight: 29, letterSpacing: -0.36, fontWeight: '800' as const },
} as const;

// Exported so callers can reason in the same optical vocabulary on both platforms.
export const OpticalType = { letterSpacing, lineHeights } as const;
export const Radius = { sm: radii.md, md: radii.lg, lg: radii.xl, full: radii.full } as const;
export const Shadow = {
  card: {
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;
