import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { normalizeTheme, resolveTheme, VALID_THEMES } from './themePreference';

const STORAGE_KEY = 'privoraa-theme';
const ThemeContext = createContext({ theme: 'system', resolvedTheme: 'light', setTheme: () => {} });

function savedTheme() {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  return normalizeTheme(stored);
}

function systemTheme() {
  return resolveTheme('system', typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(savedTheme);
  const [resolvedTheme, setResolvedTheme] = useState(() => theme === 'system' ? systemTheme() : theme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = resolveTheme(theme, media.matches);
      const root = document.documentElement;
      root.classList.toggle('dark', resolved === 'dark');
      root.classList.toggle('light', resolved === 'light');
      root.style.colorScheme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute(
        'content', resolved === 'dark' ? '#090a0c' : '#f7f7f5'
      );
      setResolvedTheme(resolved);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = (next) => {
    if (!VALID_THEMES.has(next)) return;
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  };

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
export { ThemeContext, ThemeProvider };
