/**
 * @myfin/design-tokens — Shared design system tokens
 * Used by both Next.js Web and Expo Mobile apps.
 */

// ─── Colors ──────────────────────────────────────────────────────────

export const colors = {
  // Primary — Deep teal/emerald for financial trust
  primary: {
    50: '#E6FAF5',
    100: '#B3F0E0',
    200: '#80E6CC',
    300: '#4DDCB7',
    400: '#26D4A8',
    500: '#0DAB76', // Main primary
    600: '#0A8F63',
    700: '#077350',
    800: '#05573D',
    900: '#023B2A',
  },
  // Secondary — Warm amber for accents
  secondary: {
    50: '#FFF8E1',
    100: '#FFECB3',
    200: '#FFE082',
    300: '#FFD54F',
    400: '#FFCA28',
    500: '#FFC107', // Main secondary
    600: '#FFB300',
    700: '#FFA000',
    800: '#FF8F00',
    900: '#FF6F00',
  },
  // Neutrals
  neutral: {
    0: '#FFFFFF',
    50: '#F8FAFB',
    100: '#F1F3F5',
    200: '#E4E7EB',
    300: '#CDD3DA',
    400: '#9BA5B1',
    500: '#6B7785',
    600: '#4A5568',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#0B0F14',
  },
  // Semantic
  success: { light: '#D1FAE5', main: '#10B981', dark: '#065F46' },
  warning: { light: '#FEF3C7', main: '#F59E0B', dark: '#92400E' },
  error: { light: '#FEE2E2', main: '#EF4444', dark: '#991B1B' },
  info: { light: '#DBEAFE', main: '#3B82F6', dark: '#1E40AF' },

  // Financial-specific (§5.5: color alone won't convey meaning, but helpful)
  income: { light: '#D1FAE5', main: '#10B981', dark: '#065F46' },
  expense: { light: '#FEE2E2', main: '#EF4444', dark: '#991B1B' },
  transfer: { light: '#DBEAFE', main: '#3B82F6', dark: '#1E40AF' },
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

// ─── Typography ──────────────────────────────────────────────────────

export const fontFamilies = {
  /** Primary font for both Latin and Bangla text */
  sans: "'Noto Sans Bengali', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  /** Monospace for amounts and codes */
  mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeights = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
} as const;

// ─── Border Radius ───────────────────────────────────────────────────

export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────

export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  md: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
  lg: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
  xl: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
} as const;

// ─── Breakpoints ─────────────────────────────────────────────────────

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// ─── Z-Index ─────────────────────────────────────────────────────────

export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 1080,
} as const;

// ─── Animation ───────────────────────────────────────────────────────

export const transitions = {
  fast: '150ms ease',
  normal: '250ms ease',
  slow: '350ms ease',
} as const;
