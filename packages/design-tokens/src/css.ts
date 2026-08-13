/**
 * CSS custom properties, generated from the tokens.
 *
 * The web app declared these by hand in `globals.css`, which is how the
 * palette in this package drifted away from the one that ships without anyone
 * noticing (audit gap E2). Generating them means there is exactly one place a
 * colour is decided, and `tokens.css` is a build artefact rather than a second
 * copy someone has to remember to update.
 *
 * The names are **unchanged** from what `globals.css` already used. That is
 * deliberate and it is what makes this adoptable: 662 inline `style={{}}`
 * usages across 50 files reference `var(--color-primary-500)` and friends
 * today, and renaming would have meant touching every one of them to gain
 * nothing a user could see.
 */
import {
  colors,
  fontFamilies,
  layout,
  marketing,
  materials,
  radiiCss,
  semantic,
  semanticLight,
  lightStatus,
  shadows,
  spacingCss,
  transitions,
  letterSpacing,
  lineHeights,
} from './index';

/** Every custom property the app defines, as `name → value`. */
export function cssVariables(theme: 'dark' | 'light' = 'dark'): Record<string, string> {
  const vars: Record<string, string> = {};
  const roles = theme === 'light' ? semanticLight : semantic;

  for (const [step, value] of Object.entries(colors.primary)) {
    vars[`--color-primary-${step}`] = value;
  }
  for (const [step, value] of Object.entries(colors.accent)) {
    vars[`--color-accent-${step}`] = value;
  }

  vars['--color-income'] = colors.income;
  vars['--color-expense'] = colors.expense;
  vars['--color-transfer'] = colors.transfer;
  vars['--color-warning'] = colors.warning;
  vars['--color-error'] = colors.error;
  vars['--color-success'] = colors.success;

  if (theme === 'light') {
    vars['--color-primary-400'] = lightStatus.primary;
    vars['--color-primary-500'] = lightStatus.primary;
    vars['--color-primary-600'] = lightStatus.primary;
    vars['--color-income'] = lightStatus.income;
    vars['--color-expense'] = lightStatus.expense;
    vars['--color-transfer'] = lightStatus.transfer;
    vars['--color-warning'] = lightStatus.warning;
    vars['--color-error'] = lightStatus.error;
    vars['--color-success'] = lightStatus.success;
  }

  vars['--font-ui'] = fontFamilies.ui;
  vars['--font-bangla'] = fontFamilies.bangla;

  for (const [step, value] of Object.entries(spacingCss)) {
    // The app only ever used a subset; emitting the whole scale is harmless
    // and means a new step does not need a second edit here.
    vars[`--space-${step}`] = value;
  }

  for (const [name, value] of Object.entries(radiiCss)) {
    vars[`--radius-${name}`] = value;
  }
  for (const [name, value] of Object.entries(shadows)) {
    vars[`--shadow-${name}`] = value;
  }
  for (const [name, value] of Object.entries(transitions)) {
    vars[`--transition-${name}`] = value;
  }
  for (const [name, value] of Object.entries(materials)) {
    vars[`--material-${name.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`] = value;
  }
  for (const [name, value] of Object.entries(letterSpacing)) {
    vars[`--tracking-${name}`] = value;
  }
  for (const [name, value] of Object.entries(lineHeights)) {
    vars[`--leading-${name}`] = String(value);
  }

  vars['--bg-primary'] = roles.bgPrimary;
  vars['--bg-secondary'] = roles.bgSecondary;
  vars['--bg-tertiary'] = roles.bgTertiary;
  vars['--bg-card'] = roles.bgCard;
  vars['--bg-card-hover'] = roles.bgCardHover;
  vars['--bg-input'] = roles.bgInput;
  vars['--bg-glass'] = roles.bgGlass;

  vars['--text-primary'] = roles.textPrimary;
  vars['--text-secondary'] = roles.textSecondary;
  vars['--text-tertiary'] = roles.textTertiary;
  vars['--text-inverse'] = roles.textInverse;
  vars['--text-on-primary'] = theme === 'light' ? colors.neutral[0] : '#04120d';

  vars['--border-primary'] = roles.borderPrimary;
  vars['--border-secondary'] = roles.borderSecondary;
  vars['--border-focus'] = roles.borderFocus;

  vars['--sidebar-width'] = layout.sidebarWidth;
  vars['--sidebar-collapsed-width'] = layout.sidebarCollapsedWidth;

  // Marketing surface. Prefixed `--m-` because these are a different surface
  // with a darker background, not overrides of the app's values.
  vars['--m-bg'] = marketing.bg;
  vars['--m-bg2'] = marketing.bg2;
  vars['--m-surface'] = marketing.surface;
  vars['--m-border'] = marketing.border;
  vars['--m-green'] = marketing.green;
  vars['--m-green-dim'] = marketing.greenDim;
  vars['--m-text'] = marketing.text;
  vars['--m-muted'] = marketing.muted;
  vars['--m-faint'] = marketing.faint;
  vars['--m-nav-h'] = marketing.navHeight;
  vars['--m-max-w'] = marketing.maxWidth;

  return vars;
}

/** The `:root { … }` block, ready to write to a stylesheet. */
export function toCssText(): string {
  const block = (selector: string, theme: 'dark' | 'light', indent = '') => {
    const entries = Object.entries(cssVariables(theme))
      .map(([name, value]) => `  ${name}: ${value};`)
      .join('\n');
    return `${indent}${selector} {\n${entries
      .split('\n')
      .map((line) => `${indent}${line}`)
      .join('\n')}\n${indent}}`;
  };

  return [
    '/*',
    ' * GENERATED FILE — do not edit.',
    ' *',
    ' * Source: packages/design-tokens/src/*.ts',
    ' * Regenerate: pnpm --filter @noorixfin/design-tokens generate',
    ' *',
    ' * Editing this file directly is how the palette drifted last time: the',
    ' * values here and the ones in the tokens package silently disagreed, and',
    ' * three different greens shipped at once.',
    ' */',
    block(':root, [data-theme="dark"]', 'dark'),
    '',
    block('[data-theme="light"]', 'light'),
    '',
    '@media (prefers-color-scheme: light) {',
    block(':root:not([data-theme])', 'light', '  '),
    '}',
    '',
  ].join('\n');
}
