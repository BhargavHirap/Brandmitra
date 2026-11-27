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
  /*
   * Baseline hardening on every response. These are cheap and cannot break a
   * page: the browser stops guessing a file's type, stops leaking the full URL
   * of our pages to other sites, and refuses device permissions this app never
   * asks for.
   *
   * Clickjacking is blocked with `frame-ancestors` rather than
   * `X-Frame-Options: DENY` because the app is also viewed inside the editor's
   * preview panel, and DENY would blank that. The allowlist keeps every other
   * origin out.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://*.freebuff.com https://*.freebuff.site https://*.style.dev https://*.agent37.app",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
