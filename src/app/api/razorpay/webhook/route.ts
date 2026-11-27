import { logAudit } from "@/lib/business";
import { getDb } from "@/lib/db";
import { isoFromEpochSeconds, razorpayConfig, verifyWebhookSignature } from "@/lib/razorpay";
import { clientIpFrom, logSecurityEvent } from "@/lib/security";

/**
 * RAZORPAY'S RECEIPT.
 *
 *   POST /api/razorpay/webhook
 *
 * Razorpay calls this after a subscription is authorised, charged, cancelled or
 * halted. It is the only place a paid plan is switched on, so its signature is
 * checked against the raw body before anything is read.
 *
 * It is deliberately not a logged-in route — Razorpay has no session. The shared
 * webhook secret is what proves the caller is Razorpay; without it the route
 * refuses to run rather than sitting open.
 *
 * Setup: Razorpay Dashboard → Settings → Webhooks → add
 *   https://<your-site>/api/razorpay/webhook
 * with the secret you put in RAZORPAY_WEBHOOK_SECRET, and the events
 *   subscription.activated, subscription.charged, subscription.cancelled,
 *   subscription.halted, subscription.completed, subscription.expired
 */

export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

type SubscriptionEntity = {
  id?: string;
  status?: string;
  current_end?: number;
  plan_id?: string;
  notes?: Record<string, string>;
};

type WebhookBody = {
  event?: string;
  payload?: { subscription?: { entity?: SubscriptionEntity } };
};

/** Events that mean "this business may use the paid plan now". */
const LIVE_EVENTS = new Set([
  "subscription.activated",
  "subscription.authenticated",
  "subscription.charged",
  "subscription.resumed",
]);

/** Events that mean "stop billing / stop access". */
const ENDED_EVENTS = new Set([
  "subscription.cancelled",
  "subscription.halted",
  "subscription.completed",
  "subscription.expired",
]);

async function handle(request: Request): Promise<Response> {
  const config = razorpayConfig();

  if (!config.webhookSecret) {
    return json(
      {
        ok: false,
        error: "RAZORPAY_WEBHOOK_SECRET is not set, so this route stays closed.",
        how: "Add it as a Worker secret, then use the same value in Razorpay → Settings → Webhooks.",
      },
      503,
    );
  }

  const rawBody = await request.text();
  const signature = (request.headers.get("x-razorpay-signature") ?? "").trim();

  // The body, the signature and the secret are never written to the log — only
  // the fact that this caller could not prove it was Razorpay.
  const valid = await verifyWebhookSignature(rawBody, signature, config.webhookSecret);
  if (!valid) {
    await logSecurityEvent({
      kind: "webhook_rejected",
      ip: clientIpFrom(request.headers),
      path: "/api/razorpay/webhook",
      detail: { reason: signature ? "bad_signature" : "missing_signature", bodyBytes: rawBody.length },
    });
    return json({ ok: false, error: "Bad or missing signature." }, 400);
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    await logSecurityEvent({
      kind: "webhook_rejected",
      ip: clientIpFrom(request.headers),
      path: "/api/razorpay/webhook",
      detail: { reason: "body_not_json", bodyBytes: rawBody.length },
    });
    return json({ ok: false, error: "Body was not JSON." }, 400);
  }

  const event = String(body.event ?? "");
  const entity = body.payload?.subscription?.entity ?? {};
  const razorpaySubscriptionId = String(entity.id ?? "");
  const status = String(entity.status ?? "");

  if (!razorpaySubscriptionId) {
    // Other event types (refunds, orders) are acknowledged and ignored.
    return json({ ok: true, ignored: "no subscription in payload", event });
  }

  const db = await getDb();
  const checkout = await db.first<{ business_id: string; plan_id: string; status: string }>(
    "SELECT business_id, plan_id, status FROM razorpay_checkouts WHERE id = ?",
    [razorpaySubscriptionId],
  );

  if (!checkout) {
    // Signed correctly but not a checkout this app started: acknowledge so
    // Razorpay stops retrying, and change nothing.
    return json({ ok: true, ignored: "unknown subscription", event, subscription: razorpaySubscriptionId });
  }

  const now = new Date().toISOString();
  const periodEnd = isoFromEpochSeconds(entity.current_end);

  if (LIVE_EVENTS.has(event) || status === "active" || status === "authenticated") {
    const existing = await db.first<{ id: string }>(
      "SELECT id FROM subscriptions WHERE business_id = ?",
      [checkout.business_id],
    );

    if (existing) {
      await db.run(
        "UPDATE subscriptions SET plan_id = ?, status = 'active', current_period_end = COALESCE(?, current_period_end) WHERE business_id = ?",
        [checkout.plan_id, periodEnd, checkout.business_id],
      );
    } else {
      await db.run(
        "INSERT INTO subscriptions (id, business_id, plan_id, status, current_period_end, created_at) VALUES (?, ?, ?, 'active', ?, ?)",
        [crypto.randomUUID(), checkout.business_id, checkout.plan_id, periodEnd, now],
      );
    }

    await db.run("UPDATE razorpay_checkouts SET status = 'active' WHERE id = ?", [
      razorpaySubscriptionId,
    ]);

    await logAudit({
      businessId: checkout.business_id,
      actorUserId: null,
      actorType: "system",
      action: "subscription.activated",
      entity: "subscription",
      entityId: checkout.plan_id,
      payload: { event, subscription: razorpaySubscriptionId, periodEnd },
    });

    return json({ ok: true, applied: "activated", plan: checkout.plan_id, event });
  }

  if (ENDED_EVENTS.has(event) || status === "cancelled" || status === "halted" || status === "expired" || status === "completed") {
    await db.run(
      "UPDATE subscriptions SET plan_id = 'free', status = ?, current_period_end = NULL WHERE business_id = ?",
      [status === "halted" ? "halted" : "cancelled", checkout.business_id],
    );

    await db.run("UPDATE razorpay_checkouts SET status = ? WHERE id = ?", [
      status || "ended",
      razorpaySubscriptionId,
    ]);

    await logAudit({
      businessId: checkout.business_id,
      actorUserId: null,
      actorType: "system",
      action: "subscription.ended",
      entity: "subscription",
      entityId: checkout.plan_id,
      payload: { event, subscription: razorpaySubscriptionId, status },
    });

    return json({ ok: true, applied: "downgraded", plan: "free", event });
  }

  // pending / paused and anything else: acknowledge, change nothing yet.
  return json({ ok: true, ignored: "no state change", event, status });
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}

export async function GET(): Promise<Response> {
  return json(
    {
      ok: false,
      error: "This endpoint only accepts Razorpay webhooks over POST.",
      configured: Boolean(razorpayConfig().webhookSecret),
    },
    405,
  );
}
