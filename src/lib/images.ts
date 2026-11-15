"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Toy photos live in the browser's IndexedDB, not in localStorage: localStorage
 * holds only about 5 MB, which a handful of photos would fill. A toy stores just
 * the ids of its images (see `Toy.images`); this module saves, loads and removes
 * the image files behind those ids.
 */

const DB_NAME = "toyshop-images";
const STORE = "images";

/** Longest edge of a stored image, in pixels. Larger uploads are scaled down. */
const MAX_EDGE = 1200;
/** Most images a single toy can have. */
export const MAX_IMAGES_PER_TOY = 8;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ---------- Object URLs, shared by every component showing an image ----------

const urls = new Map<string, string>();
const loading = new Set<string>();
/** Ids that were looked up and aren't stored (deleted, or the browser cleared its storage). */
const missing = new Set<string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function ensureLoaded(id: string) {
  if (urls.has(id) || loading.has(id)) return;
  loading.add(id);
  run<Blob | undefined>("readonly", (s) => s.get(id))
    .then((blob) => {
      if (blob) urls.set(id, URL.createObjectURL(blob));
      else missing.add(id);
    })
    .catch(() => {
      // Storage unavailable: callers show the "no image" picture.
      missing.add(id);
    })
    .finally(() => {
      loading.delete(id);
      notify();
    });
}

/**
 * The displayable URL of a stored image.
 * `undefined` while it is still loading, `null` if there is no such image.
 */
export function useImageUrl(id: string | undefined): string | null | undefined {
  useEffect(() => {
    if (id) ensureLoaded(id);
  }, [id]);
  return useSyncExternalStore(
    subscribe,
    () => (id ? (urls.get(id) ?? (missing.has(id) ? null : undefined)) : null),
    () => (id ? undefined : null),
  );
}

// ---------- Saving and removing ----------

/**
 * Scales an uploaded picture down, re-encodes it as JPEG and stores it.
 * Returns the new image's id. Throws if the file isn't an image the browser can read.
 */
export async function saveImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error(`"${file.name}" isn't an image.`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`Couldn't read "${file.name}". Try a JPG, PNG or WebP picture.`);
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process the picture.");
    // JPEG has no transparency: put transparent PNGs on white.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("Couldn't process the picture.");
    const id = crypto.randomUUID();
    await run("readwrite", (s) => s.put(blob, id));
    urls.set(id, URL.createObjectURL(blob));
    notify();
    return id;
  } finally {
    bitmap.close();
  }
}

/** Deletes images that nothing uses any more. Failures are ignored: a leftover image is harmless. */
export async function removeImages(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  for (const id of ids) {
    const url = urls.get(id);
    if (url) URL.revokeObjectURL(url);
    urls.delete(id);
    missing.delete(id);
  }
  notify();
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      ids.forEach((id) => store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

/** Deletes every stored image (used when all data is cleared or replaced). */
export async function clearImages(): Promise<void> {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
  missing.clear();
  notify();
  try {
    await run("readwrite", (s) => s.clear());
  } catch {
    // ignore
  }
}
