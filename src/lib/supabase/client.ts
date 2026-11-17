"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * The Supabase client for code running in the browser.
 *
 * It comes from `@supabase/ssr` rather than plain `supabase-js` so that the
 * sign-in session is kept in cookies, which the server (src/proxy.ts) reads too.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase isn't configured. Copy .env.example to .env.local, fill in your project's URL and publishable key, then restart the dev server.",
    );
  }
  client = createBrowserClient(url, key);
  return client;
}

/** Storage bucket holding toy pictures. */
export const IMAGE_BUCKET = "toy-images";
