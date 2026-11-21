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
 * header says how many filters are on and offers a button to clear them. Open or
 * closed is remembered per list in this browser.
 */
export function FilterPanel({
  storageKey,
  activeCount,
  onReset,
  className = "",
  children,
}: {
  storageKey: string;
  /** How many kinds of filter are in use, for the badge shown in the header. */
  activeCount: number;
  /** Clears the search and filters. The Reset button shows in the header while any are on. */
  onReset?: () => void;
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
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium hover:bg-surface-2"
        >
          <svg
            viewBox="0 0 20 20"
            className={`size-4 shrink-0 text-muted transition-transform duration-300 ease-out motion-reduce:transition-none ${
              open ? "rotate-90" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 4l6 6-6 6" />
          </svg>
          <span className="truncate">Search and filters</span>
          {activeCount > 0 && (
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-fg">
              {activeCount} on
            </span>
          )}
          <span className="ml-auto shrink-0 text-xs font-normal text-muted">{open ? "Hide" : "Show"}</span>
        </button>
        {onReset && activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="h-8 shrink-0 rounded-lg px-3 text-xs font-medium text-accent hover:bg-surface-2"
          >
            Reset filters
          </button>
        )}
      </div>
      {/*
        The height eases between 0fr and 1fr (a grid row), and the content fades. While
        folded it's inert, so it can't be tabbed into or read out, but it stays mounted
        so typed searches and chosen filters are kept.
      */}
      <div
        id={bodyId}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </section>
  );
}
