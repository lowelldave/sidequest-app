import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default settings. The app keeps its data in Supabase, so no extra Cloudflare
// storage (R2, KV, D1) is needed for caching.
export default defineCloudflareConfig();
