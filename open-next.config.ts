import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kv from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import queue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import tags from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache";

/**
 * Configuration for deploying Vantra to your own Cloudflare account.
 *
 * The cache uses Workers KV instead of R2, so a free Cloudflare account is
 * enough: no card, no paid storage. Freebuff Sites keeps using its own
 * generated config (freebuff.open-next.config.ts); this file does not affect it.
 */
export default defineCloudflareConfig({
  incrementalCache: kv,
  queue,
  tagCache: tags({ baseShardSize: 4 }),
});
