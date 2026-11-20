import type { NextConfig } from "next";

/**
 * The cloud preview serves the dev server through a tunnel hostname.
 * Next.js blocks cross-origin dev requests, so the preview host must be allowed.
 * On your own machine this value is ignored (localhost is always allowed).
 */
const previewHost =
  process.env.BRANDMITRA_PREVIEW_HOST ??
  "pv-5250c2c90b95-1488eb40-a4bd-4355-b4ab-4c3dbe2fcc85.style.dev";

const nextConfig: NextConfig = {
  allowedDevOrigins: [previewHost, "*.style.dev"],
  poweredByHeader: false,
};

export default nextConfig;
