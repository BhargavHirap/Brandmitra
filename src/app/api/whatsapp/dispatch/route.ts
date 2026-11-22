import { flushMessages, isWhatsAppConfigured, whatsAppConfig } from "@/lib/whatsapp";

/**
 * THE SENDER'S ALARM CLOCK.
 *
 * Reminders sit in `desk_messages` with a due time. Something has to wake up and
 * post them to Meta. This route is that something:
 *
 *   GET /api/whatsapp/dispatch?key=<WHATSAPP_DISPATCH_SECRET>
 *
 * Point any free scheduler at it — cron-job.org runs every minute for free — and
 * reminders leave even on days the owner never opens the dashboard. The desk
 * also flushes its own queue whenever the owner visits it, so this route is the
 * belt to that braces, not a dependency.
 *
 * It is deliberately not a logged-in page: a scheduler has no session. The
 * secret in the environment is what protects it, and without that secret the
 * route refuses to run at all rather than sitting open on the internet.
 */

export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const provided = (
    url.searchParams.get("key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  ).trim();

  const secret = whatsAppConfig().dispatchSecret;

  if (!secret) {
    return json(
      {
        ok: false,
        error: "WHATSAPP_DISPATCH_SECRET is not set, so this route stays closed.",
        how: "Add it as a Worker secret, then call this URL with ?key=<that value>.",
      },
      503,
    );
  }

  if (provided !== secret) {
    return json({ ok: false, error: "Wrong or missing key." }, 401);
  }

  if (!isWhatsAppConfigured()) {
    return json(
      {
        ok: false,
        error: "WhatsApp is not connected on this deployment.",
        how: "Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID. See docs/16-whatsapp-cloud-api.md.",
      },
      503,
    );
  }

  const result = await flushMessages({ limit: 40 });
  return json({ ok: true, ...result, at: new Date().toISOString() });
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
