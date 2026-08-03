import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@partnerflow/shared-types"],
};

export default nextConfig;
