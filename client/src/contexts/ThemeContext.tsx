import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";
type TaxMode = "white" | "blue";

interface ThemeContextType {
  theme: Theme;
  taxMode: TaxMode;
  toggleTheme?: () => void;
  setTaxMode: (mode: TaxMode) => void;
  switchable: boolean;
}

const THEME_STORAGE_KEY = "theme";
const TAX_MODE_STORAGE_KEY = "tax-mode";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultTaxMode?: TaxMode;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  defaultTaxMode = "white",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  const [taxMode, setTaxModeState] = useState<TaxMode>(() => {
    const stored = localStorage.getItem(TAX_MODE_STORAGE_KEY);
    return (stored as TaxMode) || defaultTaxMode;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.taxMode = taxMode;

    if (switchable) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
    localStorage.setItem(TAX_MODE_STORAGE_KEY, taxMode);
  }, [theme, taxMode, switchable]);

  const value = useMemo<ThemeContextType>(() => ({
    theme,
    taxMode,
    setTaxMode: setTaxModeState,
    toggleTheme: switchable
      ? () => setTheme(prev => (prev === "light" ? "dark" : "light"))
      : undefined,
    switchable,
  }), [theme, taxMode, switchable]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
