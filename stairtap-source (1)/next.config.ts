import type { NextConfig } from "next";

// Static export for Cloudflare Pages. Server logic lives in public/_worker.js (copied to out/).
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
