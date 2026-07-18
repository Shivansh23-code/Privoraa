export const VALID_THEMES = new Set(['system', 'light', 'dark']);

export function normalizeTheme(value) {
  return VALID_THEMES.has(value) ? value : 'system';
}

export function resolveTheme(theme, systemIsDark) {
  const normalized = normalizeTheme(theme);
  return normalized === 'system' ? (systemIsDark ? 'dark' : 'light') : normalized;
}
