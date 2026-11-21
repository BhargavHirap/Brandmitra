import type { NextConfig } from "next";

/**
 * The cloud preview serves the dev server through a tunnel hostname.
 * Next.js blocks cross-origin dev requests, so the preview host must be allowed.
 * That hostname changes every time the preview VM is recreated, so it is passed
 * in with BRANDMITRA_PREVIEW_HOST instead of being hard-coded here.
 * On your own machine this value is ignored (localhost is always allowed).
 */
const previewHosts = process.env.BRANDMITRA_PREVIEW_HOST
  ? [process.env.BRANDMITRA_PREVIEW_HOST, "*.style.dev"]
  : ["*.style.dev"];

const nextConfig: NextConfig = {
  allowedDevOrigins: previewHosts,
  poweredByHeader: false,
  // A menu photo is shrunk in the browser, but a large screenshot can still be
  // a few megabytes. The default 1 MB limit for server actions would reject it.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
