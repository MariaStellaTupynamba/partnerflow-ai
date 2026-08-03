import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@partnerflow/shared-types"],
};

export default nextConfig;

// Enables using this project's Cloudflare bindings (vars, etc.) from `next dev`.
// No-op in production builds and in environments without the Cloudflare adapter installed.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
