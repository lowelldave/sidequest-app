"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { totalStock, type Toy } from "@/lib/types";
import { inputCls } from "./ui";

/**
 * A toy chooser you can type into. Matches the typed words against each toy's
 * name, manufacturer and SKU, and works from the keyboard (arrows, Enter, Escape).
 * Toys with nothing in stock can be marked unavailable, for sales. When nothing
 * matches, it can offer to add the searched name as a new toy (`onAddNew`).
 */
export function ToyPicker({
  toys,
  value,
  onChange,
  isDisabled,
  onAddNew,
  autoFocus = false,
}: {
  toys: Toy[];
  /** Id of the chosen toy, or "" for none. */
  value: string;
  onChange: (toyId: string) => void;
  /** Return true for toys that can't be chosen right now. */
  isDisabled?: (toy: Toy) => boolean;
  /**
   * When given, a search with no matches offers "Add <name> to inventory", and
   * choosing it calls this with the typed name (empty if nothing was typed).
   */
  onAddNew?: (name: string) => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const selected = toys.find((t) => t.id === value);
  const typed = query.trim();

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const sorted = [...toys].sort((a, b) => a.name.localeCompare(b.name));
    if (words.length === 0) return sorted;
    return sorted.filter((t) => {
      const haystack = `${t.name} ${t.manufacturer} ${t.sku}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [toys, query]);

  // With no match (or an empty inventory) the one option on offer is adding a toy.
  const canAdd = !!onAddNew && results.length === 0 && (typed !== "" || toys.length === 0);
  const addOptionId = `${id}-add`;

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (open) optionRefs.current[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function openList() {
    if (open) return;
    setQuery("");
    // Start on the current choice so Enter keeps it.
    const index = results.findIndex((t) => t.id === value);
    setActive(Math.max(index, 0));
    setOpen(true);
  }

  function addNew() {
    setOpen(false);
    setQuery("");
    onAddNew?.(typed);
  }

  function choose(toy: Toy) {
    if (isDisabled?.(toy)) return;
    onChange(toy.id);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) openList();
        else setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) openList();
        else setActive((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        // Never let Enter submit the form while picking a toy.
        e.preventDefault();
        if (open && results[active]) choose(results[active]);
        else if (open && canAdd) addNew();
        break;
      case "Escape":
        if (open) {
          // Close just the list; a second Escape then closes the dialog. React listens on
          // `document` itself in Next.js, so stopPropagation alone wouldn't reach the dialog's
          // own document-level key handler: it has to be stopped from running at all.
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          setOpen(false);
          setQuery("");
        }
        break;
    }
  }

  const activeId = !open
    ? undefined
    : results[active]
      ? `${id}-option-${results[active].id}`
      : canAdd
        ? addOptionId
        : undefined;

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        Toy
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        autoComplete="off"
        autoFocus={autoFocus}
        className={inputCls}
        placeholder="Search toys by name, manufacturer or SKU"
        value={open ? query : (selected?.name ?? "")}
        onFocus={(e) => {
          openList();
          e.currentTarget.select();
        }}
        onClick={openList}
        onBlur={() => {
          setOpen(false);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {/* Options use mousedown + preventDefault so clicking one doesn't blur the input first. */}
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Toys"
          className="absolute inset-x-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <>
              <li className="px-3 py-2 text-sm text-muted" role="presentation">
                {typed ? <>No toys match &ldquo;{typed}&rdquo;.</> : "There are no toys in the inventory yet."}
              </li>
              {canAdd && (
                <li
                  id={addOptionId}
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={addNew}
                  className="mx-1 flex cursor-pointer items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm font-medium text-accent"
                >
                  <span aria-hidden="true" className="text-base leading-none">
                    +
                  </span>
                  {typed ? <>Add &ldquo;{typed}&rdquo; to inventory</> : "Add a new toy to inventory"}
                </li>
              )}
            </>
          ) : (
            results.map((t, i) => {
              const disabled = isDisabled?.(t) ?? false;
              return (
                <li
                  key={t.id}
                  id={`${id}-option-${t.id}`}
                  ref={(el) => {
                    optionRefs.current[i] = el;
                  }}
                  role="option"
                  aria-selected={t.id === value}
                  aria-disabled={disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(t)}
                  onMouseMove={() => i !== active && setActive(i)}
                  className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${
                    i === active ? "bg-surface-2" : ""
                  } ${disabled ? "cursor-not-allowed text-muted" : "cursor-pointer"}`}
                >
                  <span className="min-w-0">
                    <span className={`block truncate ${t.id === value ? "font-semibold" : "font-medium"}`}>
                      {t.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {[t.manufacturer, t.sku].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {disabled ? "Out of stock" : `${totalStock(t)} in stock`}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
