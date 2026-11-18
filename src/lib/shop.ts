"use client";

import { useSyncExternalStore } from "react";
import { getSupabase } from "./supabase/client";
import type { Currency, Quality } from "./types";

/**
 * The shop's own settings: name, logo, colour, currency, invoice details and
 * defaults for new toys. Anyone can read them (the sign-in page shows the name
 * and logo); only the admin can change them.
 */

export type ShopSettings = {
  name: string;
  logo_path: string;
  accent: string;
  currency: Currency;
  invoice_address: string;
  invoice_phone: string;
  invoice_email: string;
  invoice_footer: string;
  default_reorder_level: number;
  default_quality: Quality;
  updated_at: string;
};

export const DEFAULT_SHOP_NAME = "SideQuest: Toys and Figures";
export const DEFAULT_ACCENT = "#4f46e5";
export const SHOP_ASSET_BUCKET = "shop-assets";

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  name: DEFAULT_SHOP_NAME,
  logo_path: "",
  accent: DEFAULT_ACCENT,
  currency: "USD",
  invoice_address: "",
  invoice_phone: "",
  invoice_email: "",
  invoice_footer: "",
  default_reorder_level: 5,
  default_quality: "MIB",
  updated_at: "",
};

/** Ready-made colour schemes; any other colour can be picked too. */
export const ACCENT_PRESETS: { name: string; value: string }[] = [
  { name: "Indigo", value: "#4f46e5" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Rose", value: "#e11d48" },
  { name: "Orange", value: "#ea580c" },
  { name: "Amber", value: "#b45309" },
  { name: "Emerald", value: "#059669" },
  { name: "Teal", value: "#0f766e" },
  { name: "Sky", value: "#0369a1" },
  { name: "Slate", value: "#475569" },
];

/** Kept in the browser so the right name and colour show before the database answers. */
const CACHE_KEY = "toyshop:shop:v1";

let settings: ShopSettings | null = null;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readCache(): ShopSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...DEFAULT_SHOP_SETTINGS, ...(JSON.parse(raw) as Partial<ShopSettings>) } : null;
  } catch {
    return null;
  }
}

function writeCache(value: ShopSettings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // Blocked storage: it only means a moment of default branding next time.
  }
}

export async function reloadShopSettings() {
  const { data, error } = await getSupabase().from("shop_settings").select("*").maybeSingle();
  if (error || !data) return;
  settings = { ...DEFAULT_SHOP_SETTINGS, ...(data as Partial<ShopSettings>) };
  writeCache(settings);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    settings = readCache();
    void reloadShopSettings();
  }
  return () => {
    listeners.delete(listener);
  };
}

/** The shop's settings: the last known copy at first, then the database's. */
export function useShopSettings(): ShopSettings {
  return useSyncExternalStore(
    subscribe,
    () => settings ?? DEFAULT_SHOP_SETTINGS,
    () => DEFAULT_SHOP_SETTINGS,
  );
}

/** For modules outside React (the data store, invoices). */
export function getShopSettings(): ShopSettings {
  return settings ?? DEFAULT_SHOP_SETTINGS;
}

export function subscribeShopSettings(listener: () => void): () => void {
  return subscribe(listener);
}

export type ShopSettingsInput = Omit<ShopSettings, "updated_at">;

/** The columns an admin may change; keep in step with the grants in supabase/migrations. */
const EDITABLE_FIELDS: (keyof ShopSettingsInput)[] = [
  "name",
  "logo_path",
  "accent",
  "currency",
  "invoice_address",
  "invoice_phone",
  "invoice_email",
  "invoice_footer",
  "default_reorder_level",
  "default_quality",
];

/** Saves the shop settings (admin only; the database refuses anyone else). */
export async function saveShopSettings(patch: Partial<ShopSettingsInput>) {
  // Send only the columns the database lets an admin change. The settings we hold
  // came from `select *`, so they also carry the table's `id`, which can't be updated
  // (the database answers 403 if it's included).
  const changes: Partial<ShopSettingsInput> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in patch) Object.assign(changes, { [key]: patch[key] });
  }
  const { data, error } = await getSupabase()
    .from("shop_settings")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", true)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only an admin can change the shop setup.");
  settings = { ...DEFAULT_SHOP_SETTINGS, ...(data as Partial<ShopSettings>) };
  writeCache(settings);
  emit();
}

export function logoUrl(path: string): string {
  return getSupabase().storage.from(SHOP_ASSET_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Uploads a new logo, scaled so its longest side is at most 960 px, and returns
 * its storage path. PNGs stay PNG so a transparent background is kept.
 */
export async function uploadLogo(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error(`"${file.name}" isn't an image.`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`Couldn't read "${file.name}". Try a JPG, PNG or WebP picture.`);
  }
  const MAX = 960;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the picture.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const png = file.type === "image/png" || file.type === "image/webp";
  const type = png ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  if (!blob) throw new Error("Couldn't process the picture.");
  const path = `logo/${crypto.randomUUID()}.${png ? "png" : "jpg"}`;
  const { error } = await getSupabase()
    .storage.from(SHOP_ASSET_BUCKET)
    .upload(path, blob, { contentType: type, cacheControl: "31536000" });
  if (error) throw new Error(`Couldn't upload the logo: ${error.message}`);
  return path;
}

export async function removeLogoFile(path: string) {
  if (!path) return;
  try {
    await getSupabase().storage.from(SHOP_ASSET_BUCKET).remove([path]);
  } catch {
    // A leftover file is harmless.
  }
}

// ---------- Colours ----------

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(hex: string, with_: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(with_);
  return rgbToHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * amount) as [number, number, number]);
}

/**
 * The accent colour for light and dark mode, each with readable text on top.
 * Dark mode uses a lighter shade so it stands out on the dark background.
 */
export function accentPalette(accent: string) {
  const light = accent;
  const lightFg = contrastRatio(light, "#ffffff") >= 4.5 ? "#ffffff" : "#1b1a17";
  let dark = mix(accent, "#ffffff", 0.4);
  // Keep lightening until it reads well on the dark surface.
  for (let i = 0; i < 4 && contrastRatio(dark, "#1a1a19") < 4.5; i++) dark = mix(dark, "#ffffff", 0.25);
  return { light, lightFg, dark, darkFg: "#121211" };
}
