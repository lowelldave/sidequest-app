"use client";

import { useState } from "react";
import { inputCls } from "./ui";

/** The choices in the "per page" dropdown. */
export const PAGE_SIZES = [12, 24, 48, 96] as const;
const DEFAULT_PAGE_SIZE = 24;

function readSize(storageKey: string): number {
  try {
    const saved = Number(localStorage.getItem(storageKey));
    if ((PAGE_SIZES as readonly number[]).includes(saved)) return saved;
  } catch {
    // Blocked storage: the default is used.
  }
  return DEFAULT_PAGE_SIZE;
}

export type Paging<T> = {
  page: number;
  pageCount: number;
  size: number;
  total: number;
  /** 1-based position of the first and last item on this page (0 when there are none). */
  from: number;
  to: number;
  pageItems: T[];
  setPage: (page: number) => void;
  setSize: (size: number) => void;
};

/**
 * Splits `items` into pages. The page goes back to 1 when `resetKey` changes (pass
 * something that describes the current filters and sorting), and the chosen page
 * size is remembered in this browser under `storageKey`. Changing page scrolls to
 * the element with the id `anchorId`, which should wrap the list.
 */
export function usePagination<T>(
  items: T[],
  { storageKey, resetKey, anchorId }: { storageKey: string; resetKey: string; anchorId: string },
): Paging<T> {
  const [state, setState] = useState({ page: 1, key: resetKey });
  const [size, setSizeState] = useState(() => readSize(storageKey));

  const pageCount = Math.max(1, Math.ceil(items.length / size));
  // A page chosen under other filters doesn't count; and a page past the end (after deleting) is pulled back.
  const requested = state.key === resetKey ? state.page : 1;
  const page = Math.min(Math.max(1, requested), pageCount);
  const start = (page - 1) * size;

  return {
    page,
    pageCount,
    size,
    total: items.length,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + size, items.length),
    pageItems: items.slice(start, start + size),
    setPage: (p) => {
      setState({ page: p, key: resetKey });
      requestAnimationFrame(() =>
        document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    },
    setSize: (n) => {
      try {
        localStorage.setItem(storageKey, String(n));
      } catch {
        // Blocked storage: the choice still applies until the page is reloaded.
      }
      setSizeState(n);
      setState({ page: 1, key: resetKey });
    },
  };
}

/** Page numbers to show: the first, the last, and the ones around the current page, with gaps as null. */
function pageNumbers(page: number, count: number): (number | null)[] {
  const wanted = new Set([1, count, page - 1, page, page + 1]);
  const shown = [...wanted].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const result: (number | null)[] = [];
  shown.forEach((n, i) => {
    if (i > 0 && n - shown[i - 1] > 1) result.push(null);
    result.push(n);
  });
  return result;
}

const pageButton =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors disabled:opacity-40";

/** The bar under a list: which items are shown, a "per page" dropdown, and the page buttons. */
export function Pagination<T>({ paging, noun = "items" }: { paging: Paging<T>; noun?: string }) {
  const { page, pageCount, size, total, from, to, setPage, setSize } = paging;
  // With only a few items there's nothing to page through or choose.
  if (total <= PAGE_SIZES[0]) return null;

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        <span aria-live="polite">
          {from}–{to} of {total} {noun}
        </span>
        <label className="flex items-center gap-2">
          <span className="whitespace-nowrap">Per page</span>
          <select
            className={`${inputCls} h-9 w-auto py-0`}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`${pageButton} border-line bg-surface hover:bg-surface-2`}
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            ‹ <span className="ml-1 hidden sm:inline">Previous</span>
          </button>
          {/* Numbers need room, so a narrow screen shows "Page 2 of 5" instead. */}
          <span className="px-2 text-sm text-muted sm:hidden">
            Page {page} of {pageCount}
          </span>
          <div className="hidden items-center gap-1 sm:flex">
            {pageNumbers(page, pageCount).map((n, i) =>
              n === null ? (
                <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  aria-label={`Page ${n}`}
                  aria-current={n === page ? "page" : undefined}
                  className={`${pageButton} tabular-nums ${
                    n === page
                      ? "border-transparent bg-accent text-accent-fg"
                      : "border-line bg-surface hover:bg-surface-2"
                  }`}
                >
                  {n}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            className={`${pageButton} border-line bg-surface hover:bg-surface-2`}
            onClick={() => setPage(page + 1)}
            disabled={page >= pageCount}
            aria-label="Next page"
          >
            <span className="mr-1 hidden sm:inline">Next</span> ›
          </button>
        </div>
      )}
    </nav>
  );
}
