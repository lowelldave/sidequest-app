"use client";

import { useId, useState, type ReactNode } from "react";

function readOpen(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) !== "closed";
  } catch {
    return true;
  }
}

/**
 * The box around a list's search and filters, which can be folded away to give the
 * list more room. Folding only hides it: whatever is filtered stays filtered, and the
 * header says how many filters are on. Open or closed is remembered per list in this browser.
 */
export function FilterPanel({
  storageKey,
  activeCount,
  className = "",
  children,
}: {
  storageKey: string;
  /** How many kinds of filter are in use, for the badge shown in the header. */
  activeCount: number;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(storageKey));
  const bodyId = useId();

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? "open" : "closed");
    } catch {
      // Blocked storage: it still folds until the page is reloaded.
    }
  }

  return (
    <section aria-label="Search and filters" className={`rounded-xl border border-line bg-surface ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium hover:bg-surface-2"
      >
        <svg
          viewBox="0 0 20 20"
          className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7 4l6 6-6 6" />
        </svg>
        Search and filters
        {activeCount > 0 && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-fg">
            {activeCount} on
          </span>
        )}
        <span className="ml-auto text-xs font-normal text-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {/* Hidden, not removed, so typed searches and chosen filters are kept while it's folded. */}
      <div id={bodyId} hidden={!open} className="px-4 pb-4">
        {children}
      </div>
    </section>
  );
}
