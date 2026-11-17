"use client";

import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import {
  ACCENT_PRESETS,
  DEFAULT_SHOP_NAME,
  accentPalette,
  logoUrl,
  removeLogoFile,
  saveShopSettings,
  uploadLogo,
  useShopSettings,
  type ShopSettings,
  type ShopSettingsInput,
} from "@/lib/shop";
import { CURRENCIES, QUALITIES, type Currency, type Quality } from "@/lib/types";
import { toast } from "../toast";
import { Button, Field, FormError, inputCls } from "../ui";
import { Section, SettingsStack } from "./parts";

export function ShopSetup() {
  const shop = useShopSettings();
  // Re-mount the form when the saved settings arrive or change, so it starts from them.
  return <ShopSetupForm key={shop.updated_at || "default"} shop={shop} />;
}

function ShopSetupForm({ shop }: { shop: ShopSettings }) {
  const [form, setForm] = useState<ShopSettingsInput>(() => {
    const { updated_at, ...rest } = shop;
    void updated_at;
    return rest;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ShopSettingsInput>(key: K, value: ShopSettingsInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const changed = (Object.keys(form) as (keyof ShopSettingsInput)[]).some((k) => form[k] !== shop[k]);

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const path = await uploadLogo(file);
      // An earlier upload in this same visit that won't be saved now.
      if (form.logo_path && form.logo_path !== shop.logo_path) void removeLogoFile(form.logo_path);
      set("logo_path", path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload the logo.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("Give the shop a name.");
    if (!/^#[0-9a-f]{6}$/i.test(form.accent)) return setError("Pick a colour.");
    if (!Number.isInteger(form.default_reorder_level) || form.default_reorder_level < 0) {
      return setError("The low-stock level must be a whole number, zero or more.");
    }
    setBusy(true);
    setError(null);
    try {
      const oldLogo = shop.logo_path;
      await saveShopSettings({ ...form, name: form.name.trim() });
      if (oldLogo && oldLogo !== form.logo_path) void removeLogoFile(oldLogo);
      toast({ tone: "success", title: "Shop setup saved" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  const palette = accentPalette(form.accent);
  const presetMatch = ACCENT_PRESETS.find((p) => p.value.toLowerCase() === form.accent.toLowerCase());

  return (
    <form onSubmit={submit}>
      <SettingsStack>
        <Section title="Name and logo" description="Shown on the sign-in page, in the sidebar, in the browser tab and on invoices.">
          <Field label="Shop name" className="max-w-md">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={60}
              required
            />
          </Field>
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-muted">Logo</p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex gap-2">
                {/* Preview on both backgrounds, since one logo is used in light and dark mode. */}
                {(["#ffffff", "#1a1a19"] as const).map((bg) => (
                  <div
                    key={bg}
                    className="flex h-24 w-36 items-center justify-center rounded-lg border border-line p-2"
                    style={{ background: bg }}
                  >
                    {form.logo_path ? (
                      // eslint-disable-next-line @next/next/no-img-element -- uploaded logos have any size
                      <img src={logoUrl(form.logo_path)} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <Image
                        src={bg === "#ffffff" ? "/logo.png" : "/logo-dark.png"}
                        alt=""
                        width={480}
                        height={318}
                        className="max-h-full w-auto"
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => void pickLogo(e.target.files?.[0])}
                />
                <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
                  {uploading ? "Uploading…" : "Upload logo"}
                </Button>
                {form.logo_path && (
                  <Button variant="ghost" onClick={() => set("logo_path", "")}>
                    Use the SideQuest logo
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              A PNG with a transparent background looks best on both light and dark mode. Up to 2 MB.
            </p>
          </div>
        </Section>

        <Section title="Colour scheme" description="The colour of buttons, links and highlights. Dark mode uses a lighter shade.">
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((p) => {
              const active = p.value.toLowerCase() === form.accent.toLowerCase();
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => set("accent", p.value)}
                  aria-pressed={active}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                    active ? "border-foreground" : "border-line hover:bg-surface-2"
                  }`}
                >
                  <span className="size-4 rounded-full" style={{ background: p.value }} aria-hidden="true" />
                  {p.name}
                </button>
              );
            })}
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                presetMatch ? "border-line hover:bg-surface-2" : "border-foreground"
              }`}
            >
              <input
                type="color"
                value={form.accent}
                onChange={(e) => set("accent", e.target.value)}
                className="size-4 cursor-pointer rounded-full border-0 bg-transparent p-0"
                aria-label="Custom colour"
              />
              Custom
            </label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["Light mode", "#ffffff", "#1b1a17", palette.light, palette.lightFg],
                ["Dark mode", "#1a1a19", "#f0efec", palette.dark, palette.darkFg],
              ] as const
            ).map(([label, bg, fg, accent, accentFg]) => (
              <div key={label} className="rounded-lg border border-line p-4" style={{ background: bg, color: fg }}>
                <p className="text-xs opacity-70">{label}</p>
                <div className="mt-2 flex items-center gap-3">
                  <span
                    className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium"
                    style={{ background: accent, color: accentFg }}
                  >
                    + New transaction
                  </span>
                  <span className="text-sm font-medium" style={{ color: accent }}>
                    A link
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Currency" description="Used for every price and total in the shop, for everyone.">
          <Field label="Currency" className="max-w-xs">
            <select className={inputCls} value={form.currency} onChange={(e) => set("currency", e.target.value as Currency)}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </Section>

        <Section title="Invoice details" description="Printed under the logo on every invoice, refund receipt and restock record.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Address" className="sm:col-span-2">
              <textarea
                className={`${inputCls} h-auto py-2`}
                rows={3}
                value={form.invoice_address}
                onChange={(e) => set("invoice_address", e.target.value)}
                placeholder={"123 Example Street\nCity, Postcode"}
                maxLength={300}
              />
            </Field>
            <Field label="Phone">
              <input className={inputCls} value={form.invoice_phone} onChange={(e) => set("invoice_phone", e.target.value)} maxLength={40} />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className={inputCls}
                value={form.invoice_email}
                onChange={(e) => set("invoice_email", e.target.value)}
                maxLength={120}
              />
            </Field>
            <Field label="Message at the bottom of sales invoices" className="sm:col-span-2">
              <input
                className={inputCls}
                value={form.invoice_footer}
                onChange={(e) => set("invoice_footer", e.target.value)}
                placeholder="Thank you for shopping with us."
                maxLength={140}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">
            Invoices use the PDF&apos;s built-in fonts, which print Western European letters only.
          </p>
        </Section>

        <Section title="Inventory defaults" description="Filled in for you when someone adds a new toy.">
          <div className="grid max-w-md gap-3 sm:grid-cols-2">
            <Field label="Quality">
              <select
                className={inputCls}
                value={form.default_quality}
                onChange={(e) => set("default_quality", e.target.value as Quality)}
              >
                {QUALITIES.map((q) => (
                  <option key={q}>{q}</option>
                ))}
              </select>
            </Field>
            <Field label="Low-stock level">
              <input
                type="number"
                min="0"
                step="1"
                className={inputCls}
                value={form.default_reorder_level}
                onChange={(e) => set("default_reorder_level", Number(e.target.value))}
              />
            </Field>
          </div>
        </Section>

        <FormError message={error} />
        <div className="sticky bottom-4 z-10 flex justify-end gap-2 rounded-xl border border-line bg-surface p-3 shadow-lg">
          <p className="mr-auto self-center text-sm text-muted">
            {changed ? "You have unsaved changes." : `Saved${shop.name === DEFAULT_SHOP_NAME ? "" : ` for ${shop.name}`}.`}
          </p>
          <Button
            onClick={() => {
              const { updated_at, ...rest } = shop;
              void updated_at;
              if (form.logo_path && form.logo_path !== shop.logo_path) void removeLogoFile(form.logo_path);
              setForm(rest);
              setError(null);
            }}
            disabled={!changed || busy}
          >
            Discard
          </Button>
          <Button variant="primary" type="submit" disabled={!changed || busy || uploading}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </SettingsStack>
    </form>
  );
}
