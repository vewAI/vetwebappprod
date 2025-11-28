"use client";

import { useEffect, useState, useCallback } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const THEME_STORAGE_KEY = "vewai-theme";

type Theme = "light" | "dark";

export function ThemeToggle({
  size = "icon",
  className,
}: {
  size?: "icon" | "sm" | "lg";
  className?: string;
}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false;
    const resolved: Theme = stored === "dark" || stored === "light"
      ? (stored as Theme)
      : prefersDark
      ? "dark"
      : "light";

    setTheme(resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");
    setIsReady(true);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);

  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      onClick={toggleTheme}
      className={className}
      aria-label={label}
      title={label}
      disabled={!isReady}
    >
      <Icon className="size-4" />
    </Button>
  );
}
