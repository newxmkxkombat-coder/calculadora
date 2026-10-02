import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../constants';

export type Theme = 'dark' | 'light';

const THEME_COLORS: Record<Theme, string> = { dark: '#0b1120', light: '#f1f5f9' };

const readTheme = (): Theme => {
  try {
    return localStorage.getItem(STORAGE_KEYS.theme) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
    try {
      localStorage.setItem(STORAGE_KEYS.theme, theme);
    } catch {
      /* sin almacenamiento: el tema solo dura la sesión */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), []);

  return { theme, toggleTheme };
};
