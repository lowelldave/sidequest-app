"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { MAX_IMAGES_PER_TOY, saveImage, useImageUrl } from "@/lib/images";
import type { Toy } from "@/lib/types";

/** The default picture for a toy that has no images. */
export function NoImage({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="img"
      aria-label="No image"
      className="flex h-full w-full flex-col items-center justify-center gap-1 bg-surface-2 text-muted"
    >
      <svg
        viewBox="0 0 24 24"
        className={compact ? "size-5" : "size-12"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="1.8" />
        <path d="m21 16-5-5-8 8" />
      </svg>
      {!compact && <span className="text-xs font-medium">No image</span>}
    </div>
  );
}

/**
 * One stored image filling its container. Shows a blank tile while loading
 * and the "No image" picture if the image can't be found.
 */
export function StoredImage({
  id,
  alt,
  fit = "cover",
  compact = false,
}: {
  id: string | undefined;
  alt: string;
  fit?: "cover" | "contain";
  compact?: boolean;
}) {
  const url = useImageUrl(id);
  if (url === undefined) return <div className="h-full w-full animate-pulse bg-surface-2" />;
  if (url === null) return <NoImage compact={compact} />;
  return (
    // A plain <img>: these are local blob URLs, which next/image can't optimise.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      draggable={false}
      className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
    />
  );
}

/** A toy's cover picture (its first image), or the "No image" default. Fills its container. */
export function ToyCover({ toy, compact = false }: { toy: Toy; compact?: boolean }) {
  if (toy.images.length === 0) return <NoImage compact={compact} />;
  return <StoredImage id={toy.images[0]} alt={toy.name} compact={compact} />;
}

/** Swipeable, keyboard-friendly carousel of a toy's pictures with thumbnails underneath. */
export function ImageCarousel({ ids, alt }: { ids: string[]; alt: string }) {
  const [requested, setRequested] = useState(0);
  const touchX = useRef<number | null>(null);
  const count = ids.length;
  // The list can shrink while this is open (images removed in the editor).
  const index = Math.min(requested, Math.max(count - 1, 0));

  if (count === 0) {
    return (
      <div className="aspect-[4/3] overflow-hidden rounded-xl border border-line">
        <NoImage />
      </div>
    );
  }

  const go = (to: number) => setRequested((to + count) % count);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(index + 1);
    }
  }

  return (
    <div
      className="space-y-2"
      role="group"
      aria-roledescription="carousel"
      aria-label={`${alt} pictures`}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div
        className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-surface-2"
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null || count < 2) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {ids.map((id, i) => (
            <div
              key={id}
              className="h-full w-full shrink-0"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={i !== index}
            >
              <StoredImage id={id} alt={`${alt}, picture ${i + 1}`} fit="contain" />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous picture"
              onClick={() => go(index - 1)}
              className="absolute top-1/2 left-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-lg shadow ring-1 ring-line hover:bg-surface"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next picture"
              onClick={() => go(index + 1)}
              className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-lg shadow ring-1 ring-line hover:bg-surface"
            >
              ›
            </button>
            <span
              className="absolute right-2 bottom-2 rounded-full bg-surface/90 px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-line"
              aria-live="polite"
            >
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {ids.map((id, i) => (
            <li key={id} className="shrink-0">
              <button
                type="button"
                aria-label={`Show picture ${i + 1}`}
                aria-current={i === index}
                onClick={() => setRequested(i)}
                className={`block size-14 overflow-hidden rounded-lg border-2 ${
                  i === index ? "border-accent" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <StoredImage id={id} alt="" compact />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Upload box plus thumbnails for the add/edit form. The parent owns the list of image ids. */
export function ImageField({
  ids,
  onAdd,
  onRemove,
  onMakeCover,
}: {
  ids: string[];
  onAdd: (newIds: string[]) => void;
  onRemove: (id: string) => void;
  onMakeCover: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const room = MAX_IMAGES_PER_TOY - ids.length;

  async function upload(files: File[]) {
    if (files.length === 0 || room <= 0) return;
    setBusy(true);
    setProblem(null);
    const added: string[] = [];
    const errors: string[] = [];
    for (const file of files.slice(0, room)) {
      try {
        added.push(await saveImage(file));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "Couldn't add that picture.");
      }
    }
    if (files.length > room) errors.push(`Only ${MAX_IMAGES_PER_TOY} pictures per toy: the rest were skipped.`);
    if (added.length > 0) onAdd(added);
    setProblem(errors.length > 0 ? errors.join(" ") : null);
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    void upload(Array.from(e.dataTransfer.files));
  }

  return (
    <div className="space-y-2">
      {ids.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {ids.map((id, i) => (
            <li key={id} className="relative">
              <div className="aspect-square overflow-hidden rounded-lg border border-line">
                <StoredImage id={id} alt={`Picture ${i + 1}`} compact />
              </div>
              {i === 0 ? (
                <span className="absolute bottom-1 left-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-fg">
                  Cover
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onMakeCover(id)}
                  className="absolute bottom-1 left-1 rounded bg-surface/90 px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-line hover:bg-surface"
                >
                  Make cover
                </button>
              )}
              <button
                type="button"
                aria-label={`Remove picture ${i + 1}`}
                onClick={() => onRemove(id)}
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-surface/90 text-xs ring-1 ring-line hover:bg-surface"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center text-sm ${
          dragging ? "border-accent bg-surface-2" : "border-line hover:bg-surface-2"
        } ${room <= 0 ? "pointer-events-none opacity-50" : ""}`}
      >
        <span className="font-medium">
          {busy ? "Adding pictures…" : ids.length === 0 ? "Upload pictures" : "Add more pictures"}
        </span>
        <span className="text-xs text-muted">
          {room <= 0
            ? `Limit of ${MAX_IMAGES_PER_TOY} reached`
            : "Click to choose, or drop files here. JPG, PNG or WebP."}
        </span>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={busy || room <= 0}
          onChange={(e) => void upload(Array.from(e.target.files ?? []))}
        />
      </label>

      {problem && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {problem}
        </p>
      )}
      {ids.length === 0 && (
        <p className="text-xs text-muted">With no pictures, the toy shows a &quot;No image&quot; placeholder.</p>
      )}
    </div>
  );
}
