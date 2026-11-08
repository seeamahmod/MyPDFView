import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type ColorTokens } from './tokens';

type Theme = { c: ColorTokens; isDark: boolean };
const ThemeContext = createContext<Theme>({ c: light, isDark: false });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return <ThemeContext.Provider value={{ c: isDark ? dark : light, isDark }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
