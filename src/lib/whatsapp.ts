import { logAudit } from "@/lib/business";
import { getDb, type Db } from "@/lib/db";
import {
  confirmationText,
  formatSlotRelative,
  istDateKey,
  reminderText,
  waNumber,
  type MessageLanguage,
} from "@/lib/reception";

/**
 * WHATSAPP CLOUD API — the automatic half of the front desk.
 *
 * Until the owner has a Meta account this file sends nothing and says so. Once
 * it does have one, three things happen that did not before:
 *
 *   1. Booking a slot writes a confirmation and a reminder into `desk_messages`.
 *   2. `flushMessages()` sends whatever is due through Meta's Graph API.
 *   3. A reminder that was scheduled for tomorrow morning really does leave
 *      tomorrow morning, without anyone tapping a link.
 *
 * Three rules this file obeys:
 *
 *   - The access token is read from the environment only (`WHATSAPP_TOKEN`).
 *     It is never written to the database, the page, an audit row or a log.
 *   - Nothing claims a message was sent until Meta returns a message id.
 *   - Meta charges for business-initiated messages and only allows free-form
 *     text inside a 24-hour customer-service window. Confirmations and
 *     reminders are business-initiated, so they normally need an approved
 *     template. If a template is configured it is used; if not, the text is
 *     still attempted and Meta's refusal is recorded word for word.
 */

/* ── Configuration ────────────────────────────────────────────────────────── */

export type WhatsAppConfig = {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
  /** Graph host. Only a proxy or a local stub in a test changes this. */
  apiBase: string;
  /** Approved template names. Empty means "send plain text". */
  templates: { confirmation: string; reminder: string; lang: string };
  dispatchSecret: string;
};

function env(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function whatsAppConfig(): WhatsAppConfig {
  return {
    token: env("WHATSAPP_TOKEN"),
    phoneNumberId: env("WHATSAPP_PHONE_NUMBER_ID"),
    // Pinned on purpose. v25.0 is the newest version Meta's WhatsApp message
    // reference documents and is served until 29 July 2028; move it up in the
    // environment (WHATSAPP_API_VERSION) rather than editing code.
    apiVersion: env("WHATSAPP_API_VERSION") || "v25.0",
    apiBase: (env("WHATSAPP_API_BASE") || "https://graph.facebook.com").replace(/\/$/, ""),
    templates: {
      confirmation: env("WHATSAPP_TEMPLATE_CONFIRMATION"),
      reminder: env("WHATSAPP_TEMPLATE_REMINDER"),
      lang: env("WHATSAPP_TEMPLATE_LANG") || "en",
    },
    dispatchSecret: env("WHATSAPP_DISPATCH_SECRET"),
  };
}

/** True only when Meta can actually accept a message. */
export function isWhatsAppConfigured(): boolean {
  const config = whatsAppConfig();
  return Boolean(config.token && config.phoneNumberId);
}

/**
 * What is still missing, in the owner's words. The screen prints this list
 * instead of a generic "not configured", so the next step is always obvious.
 */
export function whatsAppStatus(): {
  ready: boolean;
  missing: string[];
  templateNames: { confirmation: string; reminder: string; lang: string };
} {
  const config = whatsAppConfig();
  const missing: string[] = [];
  if (!config.token) missing.push("WHATSAPP_TOKEN (the permanent Meta access token)");
  if (!config.phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID (from the Meta app's WhatsApp page)");
  return {
    ready: missing.length === 0,
    missing,
    templateNames: config.templates,
  };
}

/* ── One HTTP call to Meta ────────────────────────────────────────────────── */

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string; status: number; retryable: boolean };

type Template = { name: string; lang: string; params: string[] };

/**
 * Sends one message. `to` must already be E.164 digits with no `+`.
 *
 * Retryable means "the same message may work later": a timeout, a 429 or a 5xx.
 * A 401, a 403 or a 400 will fail identically forever, so retrying would only
 * annoy Meta — those are marked failed immediately with Meta's own reason.
 */
export async function sendWhatsAppMessage(input: {
  to: string;
  body: string;
  template?: Template | null;
  phoneNumberId?: string;
}): Promise<SendResult> {
  const config = whatsAppConfig();
  if (!config.token || !config.phoneNumberId) {
    return { ok: false, error: "WhatsApp is not configured on this deployment.", status: 0, retryable: false };
  }

  const phoneNumberId = input.phoneNumberId || config.phoneNumberId;
  const payload = input.template
    ? {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "template",
        template: {
          name: input.template.name,
          language: { code: input.template.lang },
          components: [
            {
              type: "body",
              parameters: input.template.params.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }
    : {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "text",
        text: { preview_url: false, body: input.body },
      };

  let response: Response;
  try {
    response = await fetch(
      `${config.apiBase}/${config.apiVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch (error) {
    const name = (error as { name?: string })?.name;
    return {
      ok: false,
      error: name === "TimeoutError" || name === "AbortError" ? "Meta took too long to answer." : "Could not reach Meta.",
      status: 0,
      retryable: true,
    };
  }

  let data: { messages?: { id?: string }[]; error?: { message?: string; code?: number } } = {};
  try {
    data = (await response.json()) as typeof data;
  } catch {
    /* non-JSON body: the status code below is the whole story */
  }

  if (!response.ok) {
    const reason = (data.error?.message ?? `Meta returned HTTP ${response.status}`).slice(0, 300);
    return {
      ok: false,
      error: reason,
      status: response.status,
      retryable: response.status === 429 || response.status >= 500,
    };
  }

  const id = data.messages?.[0]?.id;
  if (!id) {
    return { ok: false, error: "Meta accepted the call but returned no message id.", status: response.status, retryable: true };
  }
  return { ok: true, id };
}

/* ── The outbox ───────────────────────────────────────────────────────────── */

export type MessagingSettings = {
  auto_send: number;
  reminder_hours_before: number;
  phone_number_id: string;
  display_number: string;
};

export async function readMessagingSettings(db: Db, businessId: string): Promise<MessagingSettings> {
  const row = await db.first<MessagingSettings>(
    `SELECT auto_send, reminder_hours_before, phone_number_id, display_number
       FROM desk_messaging WHERE business_id = ?`,
    [businessId],
  );
  return {
    auto_send: Number(row?.auto_send) || 0,
    reminder_hours_before: Math.max(1, Math.min(72, Number(row?.reminder_hours_before) || 24)),
    phone_number_id: row?.phone_number_id ?? "",
    display_number: row?.display_number ?? "",
  };
}

/** E.164 digits, or "" when the number cannot be messaged. */
export function recipientOf(phone: string): string {
  const digits = waNumber(phone);
  return digits.length >= 10 && digits.length <= 15 ? digits : "";
}

/** First name only — WhatsApp templates read better with one word. */
function firstName(name: string): string {
  return (name.trim().split(/\s+/)[0] ?? "").slice(0, 40);
}

export type QueueAppointmentInput = {
  businessId: string;
  appointmentId: string;
  customerName: string;
  phone: string;
  service: string;
  startsAt: string;
  businessName: string;
  address: string;
  person: string;
  language: MessageLanguage;
  reminderHoursBefore: number;
};

/**
 * Writes the confirmation (due now) and the reminder (due before the slot) into
 * the outbox. The message bodies are written here, once, so the queue row holds
 * exactly the words the customer will read — the screen can show them before
 * they go out.
 *
 * Returns the ids that were added; an empty array means "no usable number" or
 * "already queued", never a silent failure.
 */
export async function queueAppointmentMessages(input: QueueAppointmentInput): Promise<string[]> {
  const to = recipientOf(input.phone);
  if (!to) return [];

  const db = await getDb();
  const now = new Date();
  const when = formatSlotRelative(input.startsAt, istDateKey(now));
  const params = [firstName(input.customerName), when, input.businessName];

  const confirmation = confirmationText({
    language: input.language,
    businessName: input.businessName,
    customerName: input.customerName,
    service: input.service,
    when,
    address: input.address,
    person: input.person,
  });
  const reminder = reminderText({
    language: input.language,
    businessName: input.businessName,
    customerName: input.customerName,
    when,
    service: input.service,
  });

  const start = new Date(input.startsAt).getTime();
  const reminderAt =
    Number.isFinite(start) && start - input.reminderHoursBefore * 3_600_000 > now.getTime()
      ? new Date(start - input.reminderHoursBefore * 3_600_000)
      : now;

  const rows = [
    { kind: "confirmation", body: confirmation, send_at: now },
    { kind: "reminder", body: reminder, send_at: reminderAt },
  ];

  const added: string[] = [];
  for (const row of rows) {
    const id = crypto.randomUUID();
    const before = await db.first<{ id: string }>(
      `SELECT id FROM desk_messages WHERE business_id = ? AND appointment_id = ? AND kind = ?`,
      [input.businessId, input.appointmentId, row.kind],
    );
    if (before) continue;

    await db.run(
      `INSERT INTO desk_messages
         (id, business_id, appointment_id, kind, to_phone, body, language, params,
          send_at, status, attempts, provider_id, error, created_at, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, '', '', ?, NULL)`,
      [
        id,
        input.businessId,
        input.appointmentId,
        row.kind,
        to,
        row.body,
        input.language,
        JSON.stringify(params),
        row.send_at.toISOString(),
        now.toISOString(),
      ],
    );
    added.push(id);
  }

  return added;
}

export type DeskMessageRow = {
  id: string;
  business_id: string;
  appointment_id: string | null;
  kind: string;
  to_phone: string;
  body: string;
  language: string;
  params: string;
  send_at: string;
  status: string;
  attempts: number;
  provider_id: string;
  error: string;
  created_at: string;
  sent_at: string | null;
};

export type FlushResult = {
  sent: number;
  failed: number;
  skipped: number;
  remaining: number;
};

/**
 * Sends everything that is due.
 *
 * `businessId` narrows it to one owner (called when they open the desk, so their
 * own reminders go out the moment they log in). Omitting it drains every
 * business, which is what the guarded /api/whatsapp/dispatch route does from a
 * free external cron once an hour.
 *
 * A message whose appointment was cancelled is skipped rather than sent, because
 * a reminder for a cancelled visit is worse than no reminder.
 */
export async function flushMessages(options: {
  businessId?: string;
  limit?: number;
  now?: Date;
} = {}): Promise<FlushResult> {
  const config = whatsAppConfig();
  const result: FlushResult = { sent: 0, failed: 0, skipped: 0, remaining: 0 };
  if (!config.token || !config.phoneNumberId) return result;

  const db = await getDb();
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(50, options.limit ?? 20));
  const scope = options.businessId ? "AND m.business_id = ?" : "";
  const params: (string | number)[] = [now.toISOString()];
  if (options.businessId) params.push(options.businessId);

  const due = await db.all<DeskMessageRow & { appointment_status: string | null; phone_number_id: string | null }>(
    `SELECT m.id, m.business_id, m.appointment_id, m.kind, m.to_phone, m.body, m.language, m.params,
            m.send_at, m.status, m.attempts, m.provider_id, m.error, m.created_at, m.sent_at,
            a.status AS appointment_status, d.phone_number_id
       FROM desk_messages m
       LEFT JOIN desk_appointments a ON a.id = m.appointment_id
       LEFT JOIN desk_messaging d ON d.business_id = m.business_id
      WHERE m.status = 'queued' AND m.send_at <= ? ${scope}
      ORDER BY m.send_at ASC
      LIMIT ${limit}`,
    params,
  );

  for (const message of due) {
    if (message.appointment_status === "cancelled") {
      await db.run(
        `UPDATE desk_messages SET status = 'skipped', error = 'The booking was cancelled.' WHERE id = ?`,
        [message.id],
      );
      result.skipped += 1;
      continue;
    }

    const templateName =
      message.kind === "confirmation"
        ? config.templates.confirmation
        : message.kind === "reminder"
          ? config.templates.reminder
          : "";
    let template: Template | null = null;
    if (templateName) {
      let values: string[] = [];
      try {
        const parsed: unknown = JSON.parse(message.params || "[]");
        if (Array.isArray(parsed)) values = parsed.map((value) => String(value).slice(0, 200));
      } catch {
        values = [];
      }
      template = { name: templateName, lang: config.templates.lang, params: values };
    }

    const answer = await sendWhatsAppMessage({
      to: message.to_phone,
      body: message.body,
      template,
      phoneNumberId: message.phone_number_id ?? "",
    });

    if (answer.ok) {
      await db.run(
        `UPDATE desk_messages
            SET status = 'sent', provider_id = ?, sent_at = ?, attempts = attempts + 1, error = ''
          WHERE id = ?`,
        [answer.id, new Date().toISOString(), message.id],
      );
      await logAudit({
        businessId: message.business_id,
        actorUserId: null,
        actorType: "system",
        action: "desk.message_sent",
        entity: "desk_message",
        entityId: message.id,
        payload: { kind: message.kind, template: template?.name ?? "text" },
      });
      result.sent += 1;
      continue;
    }

    const attempts = Number(message.attempts) + 1;
    const giveUp = !answer.retryable || attempts >= 3;
    const retryAt = new Date(Date.now() + attempts * 10 * 60_000).toISOString();
    await db.run(
      `UPDATE desk_messages SET status = ?, attempts = ?, error = ?, send_at = ? WHERE id = ?`,
      [giveUp ? "failed" : "queued", attempts, answer.error.slice(0, 300), retryAt, message.id],
    );
    if (giveUp) {
      await logAudit({
        businessId: message.business_id,
        actorUserId: null,
        actorType: "system",
        action: "desk.message_failed",
        entity: "desk_message",
        entityId: message.id,
        payload: { kind: message.kind, status: answer.status, error: answer.error.slice(0, 200) },
      });
      result.failed += 1;
    }
  }

  const left = await db.first<{ n: number }>(
    `SELECT COUNT(*) AS n FROM desk_messages WHERE status = 'queued' ${options.businessId ? "AND business_id = ?" : ""}`,
    options.businessId ? [options.businessId] : [],
  );
  result.remaining = Number(left?.n ?? 0);
  return result;
}

/** The last few messages with their real status, for the desk screen. */
export async function recentMessages(db: Db, businessId: string, limit = 8): Promise<DeskMessageRow[]> {
  return db.all<DeskMessageRow>(
    `SELECT id, business_id, appointment_id, kind, to_phone, body, language, params, send_at,
            status, attempts, provider_id, error, created_at, sent_at
       FROM desk_messages
      WHERE business_id = ?
      ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(30, limit))}`,
    [businessId],
  );
}

export const MESSAGE_STATUS_LABEL: Record<string, string> = {
  queued: "Waiting",
  sent: "Sent",
  failed: "Failed",
  skipped: "Skipped",
};

export const MESSAGE_KIND_LABEL: Record<string, string> = {
  confirmation: "Confirmation",
  reminder: "Reminder",
  followup: "Call-back",
  recall: "Recall",
};
