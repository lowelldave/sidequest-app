"use client";

import { IMAGE_BUCKET, getSupabase } from "./supabase/client";

/**
 * Toy pictures live in the Supabase Storage bucket "toy-images". A toy stores
 * just the paths of its pictures (see `Toy.images`); this module uploads,
 * removes and builds URLs for the files behind those paths.
 */

/** Longest edge of a stored image, in pixels. Larger uploads are scaled down. */
const MAX_EDGE = 1200;
/** Most images a single toy can have. */
export const MAX_IMAGES_PER_TOY = 8;

/** The public URL of a stored picture. */
export function imageUrl(path: string): string {
  return getSupabase().storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Scales an uploaded picture down, re-encodes it as JPEG and uploads it.
 * Returns the new picture's storage path. Throws with a readable message on failure.
 */
export async function saveImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error(`"${file.name}" isn't an image.`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`Couldn't read "${file.name}". Try a JPG, PNG or WebP picture.`);
  }

  let blob: Blob | null;
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
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  } finally {
    bitmap.close();
  }
  if (!blob) throw new Error("Couldn't process the picture.");

  const supabase = getSupabase();
  // Each owner's pictures go in a folder named after their user id, which is what the
  // sign-in storage policies check. Before sign-in exists, everything goes in "shared".
  const { data } = await supabase.auth.getSession();
  const folder = data.session?.user.id ?? "shared";
  const path = `${folder}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    // The file at a given path never changes, so browsers may cache it for a year.
    cacheControl: "31536000",
  });
  if (error) throw new Error(`Couldn't upload "${file.name}": ${error.message}`);
  return path;
}

/** Deletes pictures that nothing uses any more. Failures are ignored: a leftover file is harmless. */
export async function removeImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await getSupabase().storage.from(IMAGE_BUCKET).remove(paths);
  } catch {
    // ignore
  }
}
