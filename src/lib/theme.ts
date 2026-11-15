"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "toyshop:theme";

/**
 * Runs in <head> before the first paint. Applies a saved choice as
 * `data-theme` on <html>; with no saved choice the attribute stays off and
 * the CSS follows the operating system's light/dark setting.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function readStored(): Theme | null {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY) return;
    const t = readStored();
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
    listener();
  };
  media.addEventListener("change", listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getServerSnapshot(): Theme | null {
  return null;
}

/** The theme in effect: a saved choice, otherwise the system setting. Null before hydration. */
export function useTheme(): Theme | null {
  // In development, React's Strict Mode remount resets <html> to its JSX
  // attributes, clearing what the inline script set. Re-apply before paint.
  // In production this is a no-op.
  useLayoutEffect(() => {
    const t = readStored();
    if (t && document.documentElement.getAttribute("data-theme") !== t) {
      document.documentElement.setAttribute("data-theme", t);
      notify();
    }
  }, []);
  return useSyncExternalStore<Theme | null>(subscribe, getSnapshot, getServerSnapshot);
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Blocked storage: the choice still applies until the page reloads.
  }
  document.documentElement.setAttribute("data-theme", theme);
  notify();
}
