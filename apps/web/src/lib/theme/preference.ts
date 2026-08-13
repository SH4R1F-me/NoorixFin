export const THEME_COOKIE = 'nf_theme';
export type ThemePreference = 'SYSTEM' | 'LIGHT' | 'DARK';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'SYSTEM' || value === 'LIGHT' || value === 'DARK';
}
