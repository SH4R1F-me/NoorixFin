/**
 * Mobile design tokens — consistent with @noorixfin/design-tokens.
 *
 * Uses the same palette as the web app (tokens.css → CSS variables),
 * adapted for React Native's StyleSheet API.
 */

export const Colors = {
  // Background layers
  bg: '#0a0f1e',
  bgCard: '#0f1729',
  bgElevated: '#162040',
  bgSurface: '#1a2540',

  // Borders
  border: 'rgba(99,130,191,0.15)',
  borderStrong: 'rgba(99,130,191,0.3)',

  // Accent (primary action)
  accent: '#5b7fff',
  accentLight: 'rgba(91,127,255,0.15)',

  // Semantic
  ok: '#10b981',
  warn: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Text
  text: '#f8fafc',
  textDim: '#94a3b8',
  textFaint: '#64748b',

  // Amount colors
  income: '#10b981',
  expense: '#f8fafc',
  transfer: '#a3a3a3',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Typography = {
  h1: { fontSize: 28, fontWeight: '800' as const, color: Colors.text },
  h2: { fontSize: 22, fontWeight: '700' as const, color: Colors.text },
  h3: { fontSize: 18, fontWeight: '600' as const, color: Colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: Colors.text },
  bodyDim: { fontSize: 15, fontWeight: '400' as const, color: Colors.textDim },
  caption: { fontSize: 13, fontWeight: '400' as const, color: Colors.textFaint },
  label: { fontSize: 11, fontWeight: '600' as const, color: Colors.textFaint, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  amount: { fontSize: 15, fontWeight: '700' as const },
  amountLg: { fontSize: 24, fontWeight: '800' as const },
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;
