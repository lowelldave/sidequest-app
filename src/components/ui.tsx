"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import type { Quality } from "@/lib/types";

// On a phone the text is 16px: smaller text makes iPhones zoom the page in when a field is tapped.
export const inputCls =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-base text-foreground placeholder:text-muted sm:text-sm";

/** A password field that starts hidden and has a button to show what was typed. */
export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? "text" : "password"} className={`${className || inputCls} pr-11`} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        title={shown ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:opacity-90",
  secondary: "border border-line bg-surface text-foreground hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-foreground",
  danger: "text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50",
};

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`}>{children}</section>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-8 rounded-full border px-3 text-sm whitespace-nowrap transition-colors ${
        active
          ? "border-accent bg-accent text-accent-fg"
          : "border-line bg-surface text-foreground hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}

type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "violet";

const TONE_STYLES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-foreground",
  green: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300",
  blue: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-300",
};

/** Badge colour for each quality grade, used wherever a quality is shown. */
export const QUALITY_TONE: Record<Quality, Tone> = {
  MISB: "violet",
  MIB: "blue",
  BIB: "green",
  Loose: "amber",
  Damaged: "red",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </div>
  );
}

export function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading shop data">
      <div className="h-8 w-48 rounded-lg bg-surface-2" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-2" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-surface-2" />
    </div>
  );
}

/** The open dialogs, oldest first. Only the last one (on top) reacts to Escape. */
const openModals: symbol[] = [];
/** What the page's overflow was before the first dialog opened, to put back when the last closes. */
let pageOverflowBeforeModal = "";

export function Modal({
  title,
  onClose,
  size = "md",
  children,
}: {
  title: string;
  onClose: () => void;
  /** "md" suits forms; "xl" is wide, for things like the toy details with pictures. */
  size?: "md" | "xl";
  children: ReactNode;
}) {
  // Always call the latest onClose, without re-registering (which would reshuffle the stack).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const me = Symbol("modal");
    openModals.push(me);
    // The page behind a dialog shouldn't scroll while it's open (the first dialog locks it, the last one frees it).
    if (openModals.length === 1) {
      pageOverflowBeforeModal = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    const onKey = (e: KeyboardEvent) => {
      // A dialog opened from inside another one (such as adding a toy during a
      // transaction) takes Escape first; the one underneath stays open.
      if (e.key === "Escape" && openModals[openModals.length - 1] === me) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      openModals.splice(openModals.indexOf(me), 1);
      if (openModals.length === 0) document.body.style.overflow = pageOverflowBeforeModal;
    };
  }, []);

  // On a phone this is a bottom sheet: full width, a fixed header with a big close
  // button, and a body that scrolls on its own. From "sm" up it's a centred dialog.
  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal-panel flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-xl sm:max-h-[90dvh] sm:rounded-2xl ${
          size === "xl" ? "max-w-4xl" : "max-w-lg"
        }`}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" aria-hidden="true" />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2 sm:border-0 sm:px-5 sm:pt-5 sm:pb-0">
          <h2 className="line-clamp-2 min-w-0 text-base font-semibold sm:text-lg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground sm:mr-0 sm:size-8"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * The buttons at the bottom of a dialog. On a phone they stack full-width with the main
 * action on top (so list the main action last); from "sm" up they sit in a row on the
 * right. Anything in `start` (such as a Delete button) goes to the left of the row.
 */
export function ModalActions({
  start,
  className = "",
  children,
}: {
  start?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const fill = "[&>*]:w-full sm:[&>*]:w-auto";
  return (
    <div
      className={`mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center ${
        start ? "sm:justify-between" : "sm:justify-end"
      } ${className}`}
    >
      {start && <div className={`flex ${fill}`}>{start}</div>}
      <div className={`flex flex-col-reverse gap-2 sm:flex-row ${fill}`}>{children}</div>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/60 dark:text-red-300">
      {message}
    </p>
  );
}
