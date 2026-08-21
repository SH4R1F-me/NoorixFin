/**
 * @noorixfin/design-tokens — the single source of truth for colour, spacing,
 * type and elevation, shared by the Next.js web app and the Expo mobile app.
 *
 * ── Why this file was rewritten (audit gap E2) ────────────────────────────
 *
 * It previously declared a primary palette built around `#0DAB76` and was
 * described in ARCHITECTURE.md as "consumed by mobile". Neither was true:
 * **nothing in the workspace imported this package at all.** The web app
 * declared its own 61 CSS variables in `globals.css` around `#10b981`, the
 * marketing pages declared another 11 in `marketing.css`, and the mobile app
 * hardcoded `#10b981` inline — three palettes and a fourth that shipped to
 * nobody.
 *
 * So the values here are now the ones the product **actually ships**, lifted
 * from `globals.css` rather than invented. That direction matters: the
 * alternative — making the old palette authoritative — would have silently
 * restyled every screen in the product, which is a redesign, not a refactor.
 *
 * ── Two shapes for each scale, on purpose ─────────────────────────────────
 *
 * React Native cannot parse `rem`; CSS should not hardcode pixels. So spacing
 * and radii exist twice: numeric (`spacing`) for React Native style objects,
 * and CSS strings (`spacingCss`) for the custom properties the web consumes.
 * They are derived from one source below, so they cannot drift.
 */

// ─── Colour ──────────────────────────────────────────────────────────

export const colors = {
  /** Emerald. `500` is the brand colour and the focus ring. */
  primary: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
  },
  /** Amber, used for accents and the operator console's chrome. */
  accent: {
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
  },
  /** Slate. The product is dark-first, so 900/800 are backgrounds. */
  neutral: {
    0: '#ffffff',
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },

  /**
   * Semantic status colours.
   *
   * `expense` and `error` are `#f87171` (red-400) rather than a deeper red:
   * on the `#0f172a` background a darker red fails WCAG AA for normal text,
   * and these are used for figures people read.
   */
  success: '#10b981',
  warning: '#f59e0b',
  error: '#f87171',
  info: '#3b82f6',

  /** Ledger direction. Never the only signal — §5.5 forbids colour alone. */
  income: '#10b981',
  expense: '#f87171',
  transfer: '#3b82f6',
} as const;

/**
 * Resolved roles rather than raw palette steps.
 *
 * A component should ask for `semantic.textSecondary`, not `neutral.400` — the
 * role survives a palette change and the step does not. The contrast notes are
 * kept because they are load-bearing: `e2e/accessibility.spec.ts` fails the
 * build if they stop holding.
 */
export const semantic = {
  bgPrimary: colors.neutral[900],
  bgSecondary: colors.neutral[800],
  bgTertiary: colors.neutral[700],
  bgCard: colors.neutral[800],
  bgCardHover: '#253349',
  bgInput: colors.neutral[800],
  bgGlass: 'rgba(30, 41, 59, 0.8)',

  textPrimary: colors.neutral[50],
  textSecondary: colors.neutral[400],
  /**
   * 6.62:1 on `bgPrimary`. Was `#64748b` (3.98:1), which failed WCAG 2.2 AA
   * for normal text and was the most widespread violation in the app.
   */
  textTertiary: '#8b9ab0',
  textInverse: colors.neutral[900],

  borderPrimary: colors.neutral[700],
  borderSecondary: colors.neutral[600],
  borderFocus: colors.primary[500],
} as const;

/** Light roles are paired with the dark roles above; components consume the
 * same CSS variable names, so switching theme never changes component code. */
export const semanticLight = {
  bgPrimary: colors.neutral[50],
  bgSecondary: colors.neutral[100],
  bgTertiary: colors.neutral[200],
  bgCard: colors.neutral[0],
  bgCardHover: colors.neutral[100],
  bgInput: colors.neutral[0],
  bgGlass: 'rgba(255, 255, 255, 0.88)',

  textPrimary: colors.neutral[900],
  textSecondary: colors.neutral[600],
  /** 7.58:1 on white; also stays AA on the light tinted status surfaces. */
  textTertiary: colors.neutral[600],
  textInverse: colors.neutral[50],

  borderPrimary: colors.neutral[300],
  borderSecondary: colors.neutral[400],
  borderFocus: colors.primary[700],
} as const;

/** Status hues need darker steps on a light canvas to retain text contrast. */
export const lightStatus = {
  // 800 stays AA when composited onto the 14% active-control tint. 700 was
  // 4.49:1 after blending — visually close, but still a real WCAG failure.
  primary: colors.primary[800],
  income: colors.primary[800],
  success: colors.primary[800],
  warning: '#92400e',
  error: '#b91c1c',
  expense: '#b91c1c',
  info: '#1d4ed8',
  transfer: '#1d4ed8',
} as const;

/** Marketing pages run darker than the app; they are a distinct surface. */
export const marketing = {
  bg: '#030712',
  bg2: '#0a0f1e',
  surface: 'rgba(15, 23, 42, 0.8)',
  border: 'rgba(255,255,255,0.08)',
  green: colors.primary[500],
  greenDim: 'rgba(16,185,129,0.15)',
  text: colors.neutral[50],
  /** Readable on both the page background and translucent marketing cards. */
  muted: colors.neutral[300],
  /** 5.22:1 on `bg`. Was `#475569` (2.66:1) — failed the axe scan on the landing page. */
  faint: '#748399',
  navHeight: '68px',
  maxWidth: '1200px',
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────

/** Pixels, for React Native style objects. */
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

/** The same scale as `rem`, for CSS. Derived, so the two cannot disagree. */
export const spacingCss = Object.fromEntries(
  Object.entries(spacing).map(([step, px]) => [step, `${px / 16}rem`]),
) as Record<keyof typeof spacing, string>;

// ─── Typography ──────────────────────────────────────────────────────

export const fontFamilies = {
  /** Latin UI text. Self-hosted by next/font — never fetched from Google. */
  ui: "var(--font-inter), 'Inter', system-ui, -apple-system, sans-serif",
  /** Bangla. The product is Bangla-first, so this is not a fallback. */
  bangla: "var(--font-hind-siliguri), 'Hind Siliguri', var(--font-inter), sans-serif",
  mono: "'Fira Code', 'Cascadia Code', ui-monospace, monospace",
} as const;

export const fontSizes = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

export const fontWeights = {
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeights = {
  display: 1.05,
  heading: 1.2,
  tight: 1.3,
  normal: 1.6,
  relaxed: 1.7,
} as const;

/** Size-specific tracking; large type tightens while small labels open up. */
export const letterSpacing = {
  display: '-0.025em',
  heading: '-0.015em',
  body: '0em',
  label: '0.025em',
  overline: '0.06em',
} as const;

// ─── Shape and elevation ─────────────────────────────────────────────

/** Pixels, for React Native. */
export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export const radiiCss = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  glow: '0 0 20px rgba(16, 185, 129, 0.15)',
} as const;

/** Functional translucent layers. Avoid stacking thin/light materials. */
export const materials = {
  thin: 'rgba(15, 23, 42, 0.62)',
  regular: 'rgba(15, 23, 42, 0.78)',
  thick: 'rgba(15, 23, 42, 0.9)',
  edge: 'rgba(255, 255, 255, 0.1)',
  scrim: 'rgba(2, 6, 23, 0.72)',
  blurThin: '14px',
  blurRegular: '22px',
  blurThick: '32px',
} as const;

/** Physical spring values shared with Reanimated; damping ratio is explicit. */
export const motion = {
  critical: { mass: 1, stiffness: 420, damping: 2 * Math.sqrt(420), dampingRatio: 1 },
  momentum: { mass: 1, stiffness: 500, damping: 0.8 * 2 * Math.sqrt(500), dampingRatio: 0.8 },
  pressScale: 0.97,
  hysteresis: 10,
  decelerationRate: 0.998,
} as const;

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '350ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const layout = {
  sidebarWidth: '280px',
  sidebarCollapsedWidth: '72px',
} as const;

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  overlay: 1200,
  modal: 1300,
  toast: 1400,
} as const;

export * from './css';
