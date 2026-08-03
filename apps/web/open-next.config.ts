import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No ISR/on-demand revalidation is used yet, so no incremental cache override
// (e.g. R2) is configured. Add one here if a future milestone needs it.
export default defineCloudflareConfig();
