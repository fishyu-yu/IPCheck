"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ThemeMode = "light" | "dark" | "system" | "time";

const STORAGE_KEY = "theme-preference";

function isDarkBySystem() {
  if (typeof window === "undefined") return false;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function isDarkByTime(now = new Date()) {
  const hour = now.getHours();
  return hour >= 19 || hour < 6; // 7pm–6am considered dark hours
}

function applyThemeClass(isDark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
}

function getStoredTheme(): ThemeMode | null {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val as ThemeMode | null;
  } catch {
    return null;
  }
}

function setStoredTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore write errors
  }
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => getStoredTheme() ?? "system");
  const mediaRef = useRef<MediaQueryList | null>(null);

  const effectiveDark = useMemo(() => {
    switch (mode) {
      case "light":
        return false;
      case "dark":
        return true;
      case "time":
        return isDarkByTime();
      case "system":
      default:
        return isDarkBySystem();
    }
  }, [mode]);

  useEffect(() => {
    // Persist selection
    setStoredTheme(mode);

    // Apply initial theme class
    applyThemeClass(effectiveDark);

    // Listen to system changes when in system mode
    if (mode === "system" && typeof window !== "undefined" && window.matchMedia) {
      mediaRef.current = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => applyThemeClass(e.matches);
      mediaRef.current.addEventListener("change", handler);
      return () => mediaRef.current?.removeEventListener("change", handler);
    }
  }, [mode, effectiveDark]);

  return {
    mode,
    setMode,
    isDark: effectiveDark,
    toggle() {
      setMode((prev) => (prev === "dark" ? "light" : "dark"));
    },
  };
}