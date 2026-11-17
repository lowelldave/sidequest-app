"use client";

import { useEffect } from "react";
import { DEFAULT_ACCENT, DEFAULT_SHOP_NAME, accentPalette, useShopSettings } from "@/lib/shop";

/**
 * Applies the shop's colour and name, set by the admin in Shop setup: the
 * accent colour (with a lighter shade for dark mode) and the browser tab title.
 */
export function Branding() {
  const shop = useShopSettings();

  // Page titles are written as "<page> · SideQuest: Toys and Figures"; swap in the shop's name.
  useEffect(() => {
    if (shop.name === DEFAULT_SHOP_NAME) return;
    const fix = () => {
      if (document.title.includes(DEFAULT_SHOP_NAME)) {
        document.title = document.title.replace(DEFAULT_SHOP_NAME, shop.name);
      }
    };
    fix();
    const observer = new MutationObserver(fix);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [shop.name]);

  if (shop.accent.toLowerCase() === DEFAULT_ACCENT) return null;
  const c = accentPalette(shop.accent);
  const dark = `--accent: ${c.dark}; --accent-fg: ${c.darkFg};`;
  const css = `
:root { --accent: ${c.light}; --accent-fg: ${c.lightFg}; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${dark} } }
:root[data-theme="dark"] { ${dark} }`;
  return <style>{css}</style>;
}
