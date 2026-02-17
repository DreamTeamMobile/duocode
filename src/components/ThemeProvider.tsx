import { useEffect, type ReactNode } from 'react';
import { useUIStore } from '../stores/uiStore';

const THEME_STORAGE_KEY = 'duocode-theme';

interface ThemeProviderProps {
  children: ReactNode;
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  // On mount, load saved theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
    }
  }, [setTheme]);

  // Sync theme to <html> data-theme attribute and localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return children;
}
