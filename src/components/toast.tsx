"use client";

import { useSyncExternalStore } from "react";

/**
 * Brief notifications that appear in the corner and dismiss themselves.
 * Call `toast(...)` from anywhere in client code; `<Toaster />` (mounted once in
 * the root layout) shows them.
 */

type Tone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  tone: Tone;
  title: string;
  message?: string;
};

const NONE: ToastItem[] = [];
let items: ToastItem[] = NONE;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function dismiss(id: number) {
  const next = items.filter((t) => t.id !== id);
  if (next.length === items.length) return;
  items = next.length === 0 ? NONE : next;
  emit();
}

/** Shows a notification. Errors stay a little longer than successes. */
export function toast(item: { tone?: Tone; title: string; message?: string }) {
  const tone = item.tone ?? "info";
  const id = nextId++;
  items = [...items, { id, tone, title: item.title, message: item.message }];
  emit();
  window.setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4500);
}

const TONE_STYLES: Record<Tone, { box: string; icon: string; symbol: string }> = {
  success: {
    box: "border-emerald-300 dark:border-emerald-800",
    icon: "bg-emerald-600 text-white",
    symbol: "✓",
  },
  error: {
    box: "border-red-300 dark:border-red-900",
    icon: "bg-red-600 text-white",
    symbol: "!",
  },
  info: {
    box: "border-line",
    icon: "bg-accent text-accent-fg",
    symbol: "i",
  },
};

export function Toaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => items,
    () => NONE,
  );

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed top-4 right-4 left-4 z-[70] ml-auto flex max-w-sm flex-col gap-2"
    >
      {list.map((t) => {
        const style = TONE_STYLES[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface p-3 shadow-lg motion-safe:animate-[toast-in_0.2s_ease-out] ${style.box}`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${style.icon}`}
            >
              {style.symbol}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{t.title}</p>
              {t.message && <p className="mt-0.5 text-muted">{t.message}</p>}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded px-1 text-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
