/**
 * The one place the public site's address is written down.
 *
 * Metadata, the sitemap and robots all need an absolute origin; hard-coding it
 * in three files is how a preview deployment ends up advertising production.
 * Set `NEXT_PUBLIC_SITE_URL` when serving from another address.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://brandmitra-u2gvs6.freebuff.site"
).replace(/\/+$/, "");
