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
  shadows,
  spacingCss,
  transitions,
  letterSpacing,
  lineHeights,
} from './index';

/** Every custom property the app defines, as `name → value`. */
export function cssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};

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

  vars['--bg-primary'] = semantic.bgPrimary;
  vars['--bg-secondary'] = semantic.bgSecondary;
  vars['--bg-tertiary'] = semantic.bgTertiary;
  vars['--bg-card'] = semantic.bgCard;
  vars['--bg-card-hover'] = semantic.bgCardHover;
  vars['--bg-input'] = semantic.bgInput;
  vars['--bg-glass'] = semantic.bgGlass;

  vars['--text-primary'] = semantic.textPrimary;
  vars['--text-secondary'] = semantic.textSecondary;
  vars['--text-tertiary'] = semantic.textTertiary;
  vars['--text-inverse'] = semantic.textInverse;

  vars['--border-primary'] = semantic.borderPrimary;
  vars['--border-secondary'] = semantic.borderSecondary;
  vars['--border-focus'] = semantic.borderFocus;

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
  const entries = Object.entries(cssVariables())
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');

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
    ':root {',
    entries,
    '}',
    '',
  ].join('\n');
}
