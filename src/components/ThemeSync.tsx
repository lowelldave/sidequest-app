"use client";

import { useTheme } from "@/lib/theme";

/**
 * Renders nothing. It keeps the saved light or dark choice applied to the page: in
 * development, React's Strict Mode remount resets <html> and drops the choice the inline
 * script set, and this puts it back before anything is painted.
 */
export function ThemeSync() {
  useTheme();
  return null;
}
