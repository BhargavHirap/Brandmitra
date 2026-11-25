/**
 * RAZORPAY — the money rail.
 *
 * Nothing here touches card numbers. A business is sent to Razorpay's own hosted
 * page to authorise a subscription; Razorpay collects the money, keeps the card
 * or UPI mandate, and tells us by webhook what actually happened. Our database
 * only ever learns "this business is on this plan until this date".
 *
 * Written against the REST API with `fetch` (no Node SDK) so it runs unchanged
 * inside a Cloudflare Worker and in local Node.
 *
 * Required secrets (Sites → Settings → Secrets, never in the repo):
 *   RAZORPAY_KEY_ID          key_id from Razorpay → Settings → API Keys
 *   RAZORPAY_KEY_SECRET      key_secret from the same screen
 *   RAZORPAY_WEBHOOK_SECRET  the secret you type when creating the webhook
 *
 * Without the first two, billing stays switched off and the app says so instead
 * of pretending to charge anyone.
 */

export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  apiBase: string;
  configured: boolean;
};

export function razorpayConfig(): RazorpayConfig {
  const keyId = (process.env.RAZORPAY_KEY_ID ?? "").trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET ?? "").trim();
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET ?? "").trim();
  // Overridable so a local stub can stand in for api.razorpay.com in tests.
  const apiBase = (process.env.RAZORPAY_API_BASE ?? "https://api.razorpay.com").replace(/\/+$/, "");
  return { keyId, keySecret, webhookSecret, apiBase, configured: Boolean(keyId && keySecret) };
}

export function isRazorpayConfigured(): boolean {
  return razorpayConfig().configured;
}

type ApiErrorBody = { error?: { description?: string; code?: string } };

async function call<T>(
  config: RazorpayConfig,
  path: string,
  init: { method: string; body?: string },
): Promise<T> {
  const credentials = btoa(`${config.keyId}:${config.keySecret}`);
  const res = await fetch(`${config.apiBase}${path}`, {
    method: init.method,
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/json",
    },
    body: init.body,
  });

  const body = (await res.json().catch(() => null)) as (T & ApiErrorBody) | null;
  if (!res.ok || !body) {
    const detail = body?.error?.description ?? `HTTP ${res.status}`;
    throw new Error(`Razorpay ${path} failed: ${detail}`);
  }
  return body as T;
}

/**
 * Creates the matching Razorpay plan for one of our plans.
 *
 * Razorpay needs its own plan id before it can bill anything, so we create one
 * the first time a plan is bought and keep the id in `razorpay_plans` — the
 * amount lives in our `plans` table, and nobody has to copy ids by hand.
 */
export async function createRazorpayPlan(
  config: RazorpayConfig,
  input: { planId: string; name: string; amountInPaise: number },
): Promise<string> {
  const plan = await call<{ id: string }>(config, "/v1/plans", {
    method: "POST",
    body: JSON.stringify({
      period: "monthly",
      interval: 1,
      item: {
        name: input.name,
        amount: input.amountInPaise,
        currency: "INR",
        description: `Vantra ${input.name} — monthly`,
      },
      notes: { plan: input.planId },
    }),
  });
  return plan.id;
}

/**
 * Starts a subscription and returns Razorpay's hosted page to send the buyer to.
 * `total_count` is the maximum number of monthly debits before the mandate ends;
 * ten years is long enough to mean "until they cancel".
 */
export async function createRazorpaySubscription(
  config: RazorpayConfig,
  input: {
    razorpayPlanId: string;
    businessId: string;
    planId: string;
    totalCount?: number;
  },
): Promise<{ id: string; short_url: string }> {
  const subscription = await call<{ id: string; short_url: string }>(
    config,
    "/v1/subscriptions",
    {
      method: "POST",
      body: JSON.stringify({
        plan_id: input.razorpayPlanId,
        total_count: input.totalCount ?? 120,
        quantity: 1,
        customer_notify: 1,
        notes: { business: input.businessId, plan: input.planId },
      }),
    },
  );
  return { id: subscription.id, short_url: subscription.short_url };
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

/**
 * Checks `X-Razorpay-Signature` against the raw request body.
 *
 * This is the only thing standing between the internet and "give this business a
 * paid plan", so it compares in constant time and refuses when no secret is set
 * rather than accepting everything.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!secret || !signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)),
  );
  const expected = toHex(digest);

  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return diff === 0;
}

/** Razorpay sends `current_end` as epoch seconds; we store ISO strings. */
export function isoFromEpochSeconds(value: unknown): string | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}
