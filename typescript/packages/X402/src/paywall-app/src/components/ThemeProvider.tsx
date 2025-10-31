"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDarkMode: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "theme";
const VALID_THEMES = ["dark", "light"] as const;

const isValidTheme = (value: string): value is Theme =>
  VALID_THEMES.includes(value as Theme);

const getStoredTheme = (): Theme | null => {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && isValidTheme(stored) ? stored : null;
  } catch {
    return null;
  }
};

const getSystemTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export function ThemeProvider({
  children,
  defaultTheme = "light",
}: ThemeProviderProps) {
  // Always start with the default theme for SSR consistency
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate with the actual theme after mount
  useEffect(() => {
    const storedTheme = getStoredTheme();
    const systemTheme = getSystemTheme();

    // Priority: stored theme > system theme > default theme
    const actualTheme = storedTheme || systemTheme;

    setThemeState(actualTheme);
    setIsHydrated(true);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (!isHydrated) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      // Only auto-update if no theme is stored (user hasn't made explicit choice)
      const storedTheme = getStoredTheme();
      if (!storedTheme) {
        const newSystemTheme = mediaQuery.matches ? "dark" : "light";
        setThemeState(newSystemTheme);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [isHydrated]);

  const setTheme = (newTheme: Theme) => {
    if (!isValidTheme(newTheme)) return;

    setThemeState(newTheme);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, newTheme);
      } catch {
        // Silently fail if localStorage is unavailable
      }
    }
  };

  // Apply theme to DOM
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        isDarkMode: theme === "dark",
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
