"use client";

import { savePreferences } from "@/lib/account";
import { setTheme, useTheme } from "@/lib/theme";

/** Floating light/dark switch, fixed to the bottom-right corner. */
export function ThemeToggle() {
  const theme = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={theme === null ? undefined : dark}
      aria-label="Dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        const next = dark ? "light" : "dark";
        setTheme(next);
        // Remembered in the profile too, so it follows them to other devices.
        savePreferences({ theme: next });
      }}
      className={`fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full border border-line bg-surface p-1.5 pl-3 text-xs font-medium text-muted shadow-lg transition-opacity hover:text-foreground ${
        theme === null ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <span className="w-8 text-left">{dark ? "Dark" : "Light"}</span>
      <span
        aria-hidden="true"
        className={`relative flex h-7 w-12 items-center rounded-full transition-colors ${
          dark ? "bg-accent" : "bg-surface-2"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 flex size-6 items-center justify-center rounded-full bg-surface text-sm shadow transition-transform ${
            dark ? "translate-x-5" : "translate-x-0"
          }`}
        >
          {dark ? "🌙" : "☀️"}
        </span>
      </span>
    </button>
  );
}
