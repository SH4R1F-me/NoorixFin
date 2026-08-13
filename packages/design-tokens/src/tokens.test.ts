/**
 * Guards against the palette splitting in two again.
 *
 * The failure this prevents already happened once: this package declared a
 * primary of `#0DAB76`, `globals.css` declared `#10b981`, `marketing.css`
 * declared a third set, the mobile app hardcoded a fourth — and **nothing
 * imported this package**, so none of it was detectable by a type error, a
 * failing test or a broken build. It was found by reading four files and
 * noticing the greens differed.
 *
 * These tests make the same mistake loud: a stylesheet that starts declaring
 * its own tokens fails here rather than shipping a second palette.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  cssVariables,
  toCssText,
  colors,
  semantic,
  semanticLight,
  spacing,
  spacingCss,
  motion,
} from './index';

const REPO = join(__dirname, '..', '..', '..');
const WEB_STYLESHEETS = [
  join(REPO, 'apps/web/src/app/globals.css'),
  join(REPO, 'apps/web/src/app/(marketing)/marketing.css'),
];

describe('token generation', () => {
  it('emits a :root block containing every variable', () => {
    const css = toCssText();
    expect(css).toContain(':root, [data-theme="dark"] {');
    expect(css).toContain('[data-theme="light"] {');
    expect(css).toContain('@media (prefers-color-scheme: light)');
    for (const [name, value] of Object.entries(cssVariables())) {
      expect(css).toContain(`${name}: ${value};`);
    }
  });

  it('derives the rem scale from the pixel scale', () => {
    // Two shapes of one scale — React Native cannot parse rem, CSS should not
    // hardcode px. Derived rather than restated so they cannot disagree.
    expect(spacing[4]).toBe(16);
    expect(spacingCss[4]).toBe('1rem');
    expect(spacingCss[8]).toBe('2rem');
  });

  it('keeps the contrast-critical values that the a11y suite depends on', () => {
    // Both were changed to fix real axe failures. Reverting either re-breaks
    // e2e/accessibility.spec.ts, and this says so at the source.
    expect(semantic.textTertiary).toBe('#8b9ab0'); // 6.62:1 on bgPrimary
    expect(colors.primary[500]).toBe('#10b981'); // brand + focus ring
    expect(semanticLight.textTertiary).toBe('#475569'); // 7.58:1 on white
    expect(cssVariables('light')['--color-error']).toBe('#b91c1c');
  });

  it('keeps the default spring critically damped', () => {
    expect(motion.critical.dampingRatio).toBe(1);
    expect(motion.critical.damping).toBeCloseTo(2 * Math.sqrt(motion.critical.stiffness));
  });
});

describe('no stylesheet re-declares a token', () => {
  const generated = new Set(Object.keys(cssVariables()));

  for (const path of WEB_STYLESHEETS) {
    it(`${path.split('/apps/web/')[1]} declares no generated variable`, () => {
      if (!existsSync(path)) return; // path moved — the next test names it
      const css = readFileSync(path, 'utf8');

      // Any custom property DEFINED (not merely used via var()) in this file.
      const declared = [...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]!);
      const duplicated = declared.filter((name) => generated.has(name));

      // Naming them rather than counting, so the failure says what to delete.
      expect(duplicated).toEqual([]);
    });
  }

  it('is actually reading the stylesheets it claims to check', () => {
    // Without this, a moved or renamed file would make every assertion above
    // pass against an empty string — the exact shape of a test that guards
    // nothing while looking green.
    const found = WEB_STYLESHEETS.filter((p) => existsSync(p));
    expect(found.length).toBe(WEB_STYLESHEETS.length);
    for (const path of found) {
      expect(readFileSync(path, 'utf8').length).toBeGreaterThan(500);
    }
  });
});
