import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E runs its own dev server; a separate dist dir keeps it from clashing with `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
