"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "vewai-theme";

export type ThemeMode = "light" | "dark";

type ThemeContextType = {
  theme: ThemeMode;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function resolveTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  return prefersDark ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.setAttribute("data-color-scheme", theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const initial = resolveTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === "light" ? "dark" : "light";
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      applyTheme(next);
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
