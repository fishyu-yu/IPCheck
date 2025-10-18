"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { setMode, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="relative">
        <button
          type="button"
          aria-label="Toggle theme"
          className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors hover:bg-muted"
          title="Toggle theme"
        >
          <Sun className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Theme</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Toggle theme"
        className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors hover:bg-muted"
        onClick={() => toggle()}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        title="Click to toggle Light/Dark; right-click for options"
      >
        <Sun className="h-4 w-4 dark:hidden" aria-hidden="true" />
        <Moon className="hidden h-4 w-4 dark:inline-block" aria-hidden="true" />
        <span className="sr-only">Theme</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Theme options"
          className="absolute right-0 z-10 mt-2 min-w-[10rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <button
            role="menuitem"
            className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => setMode("light")}
          >
            Light
          </button>
          <button
            role="menuitem"
            className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => setMode("dark")}
          >
            Dark
          </button>
          <button
            role="menuitem"
            className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => setMode("system")}
          >
            System
          </button>
          <button
            role="menuitem"
            className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => setMode("time")}
          >
            Time of day
          </button>
        </div>
      )}
    </div>
  );
}

export default ThemeToggle;