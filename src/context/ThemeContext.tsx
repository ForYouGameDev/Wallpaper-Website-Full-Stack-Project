import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Ctx = { dark: boolean; toggle: () => void };
const ThemeCtx = createContext<Ctx>({ dark: false, toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch { /* storage blocked */ }
  }, [dark]);
  const toggle = useCallback(() => setDark((d) => !d), []);
  return <ThemeCtx.Provider value={{ dark, toggle }}>{children}</ThemeCtx.Provider>;
}
