import Link from "next/link";
import { headers } from "next/headers";
import {
  bookSlotAction,
  clearFollowUpAction,
  logCallAction,
  saveDeskSettingsAction,
  saveMessagingSettingsAction,
  sendMessageNowAction,
  updateAppointmentAction,
} from "@/app/actions/reception";
import { DeskScript } from "@/components/desk-script";
import { EmptyState, PageHeader, Panel, Stat } from "@/components/ui";
import { aiUsageQuery, isAiConfigured } from "@/lib/ai";
import { requireBusiness } from "@/lib/business";
import { firstRow, getDb, rowsOf, type Statement } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import {
  addDaysKey,
  closedDayLabels,
  confirmationText,
  countReport,
  deskFor,
  followUpState,
  followUpText,
  formatClock,
  formatSlotRelative,
  istDateKey,
  istIso,
  languageLabel,
  MESSAGE_LANGUAGES,
  type MessageLanguage,
  recallText,
  reminderText,
  reportText,
  slotOptions,
  waLink,
} from "@/lib/reception";
import {
  flushMessages,
  MESSAGE_KIND_LABEL,
  MESSAGE_STATUS_LABEL,
  messagingSettingsFromRow,
  messagingSettingsStatement,
  recentMessagesStatement,
  whatsAppStatus,
  type DeskMessageRow,
  type MessagingSettings,
} from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Front desk" };

/**
 * FRONT DESK — every business type gets this screen.
 *
 * What is real here: the slot calendar, the call log, the follow-up queue, the
 * recall list, the morning report, and one-tap WhatsApp links with the message
 * already written. If the owner has connected Meta's WhatsApp Cloud API, the
 * confirmations and reminders also go out on their own from the outbox below.
 *
 * What is NOT real: nobody answers the phone for the owner yet. That needs a
 * telephone line and a speech service, so the page says so instead of
 * pretending a call was answered.
 */

type DeskCallRow = {
  id: string;
  customer_name: string;
  phone: string;
  outcome: string;
  language: string;
  notes: string;
  value_inr: number;
  follow_up_at: string | null;
  created_at: string;
  appointment_id: string | null;
};

type DeskAppointmentRow = {
  id: string;
  customer_name: string;
  phone: string;
  service: string;
  starts_at: string;
  status: string;
  source: string;
  notes: string;
  value_inr: number;
  created_at: string;
};

const ERROR_TEXT: Record<string, string> = {
  greeting: "The greeting needs at least a few words — it is the first thing a caller hears.",
  hours: "Opening and closing times must look like 10:00 and 20:00, and closing must be later than opening.",
  phone: "That phone number does not look right. Use digits with the country code, for example +91 98765 43210.",
  name: "Add the person's name, at least two letters.",
  slot: "That slot is not one of your open slots. Pick a time from the list.",
  slotTaken: "Someone is already booked at that time. Pick another slot.",
  appointment: "That booking could not be found.",
  waNotConnected:
    "Automatic sending is still off: this deployment has no Meta credentials yet. Add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID (docs/16-whatsapp-cloud-api.md), then turn it on.",
  waSend: "Meta did not accept the message. The reason is written next to it in the list below.",
  message: "That message could not be found.",
};

const OUTCOME_LABEL: Record<string, string> = {
  missed: "Missed",
  answered: "Answered",
  booked: "Booked",
  followup: "Call back",
};

export default async function FrontDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; lang?: string }>;
}) {
  const params = await searchParams;
  const { business, planId } = await requireBusiness();
  const db = await getDb();
  const desk = deskFor(business.industry);

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const bookingUrl = `${proto}://${host}/b/${business.slug}`;

  const language = (MESSAGE_LANGUAGES.find((item) => item.id === params.lang)?.id ??
    "hinglish") as MessageLanguage;

  // The desk's own hours and the owner's sending choice, in one round trip.
  // Both are read before anything else because auto-send (below) depends on them.
  const [settingsRows, messagingRows] = await db.batch([
    {
      sql: `SELECT greeting, languages, opens_at, closes_at, closed_days, slot_minutes,
                   escalation_phone, followup_hours
              FROM desk_settings WHERE business_id = ?`,
      params: [business.id],
    },
    messagingSettingsStatement(business.id),
  ]);

  const settingsRow = firstRow<{
    greeting: string;
    languages: string;
    opens_at: string;
    closes_at: string;
    closed_days: string;
    slot_minutes: number;
    escalation_phone: string;
    followup_hours: number;
  }>(settingsRows);

  const settings = {
    greeting: settingsRow?.greeting || desk.greeting.replaceAll("{business}", business.name),
    languages: settingsRow?.languages || "Hindi, Hinglish, English",
    opens_at: settingsRow?.opens_at || "10:00",
    closes_at: settingsRow?.closes_at || "20:00",
    closed_days: settingsRow?.closed_days ?? "0",
    slot_minutes: Number(settingsRow?.slot_minutes) || 30,
    escalation_phone: settingsRow?.escalation_phone || "",
    followup_hours: Number(settingsRow?.followup_hours) || 2,
  };

  // Automatic WhatsApp: the owner's choice, plus whether Meta can actually take
  // a message. `waStatus.ready` is the source of every "connected" badge below.
  const messaging = messagingSettingsFromRow(firstRow<MessagingSettings>(messagingRows));
  const waStatus = whatsAppStatus();
  const autoSend = messaging.auto_send === 1 && waStatus.ready;

  // Visiting the desk is also a send. Anything already due goes out now, so a
  // reminder never waits for the next cron tick when the owner is right here.
  if (autoSend) {
    try {
      await flushMessages({ businessId: business.id, limit: 5 });
    } catch {
      /* the outbox keeps the row and its error; the page still draws */
    }
  }

  const todayKey = istDateKey();
  const tomorrowKey = addDaysKey(todayKey, 1);
  const yesterdayKey = addDaysKey(todayKey, -1);
  const todayStart = istIso(todayKey, "00:00");
  const tomorrowStart = istIso(tomorrowKey, "00:00");
  const yesterdayStart = istIso(yesterdayKey, "00:00");

  // Everything the page draws, in one batch. These reads used to be separate
  // round trips to D1, and each one pays the same latency however small the
  // query is, so they now travel together and come back as one response.
  const aiQuery = aiUsageQuery(business.id, planId);
  const statements: Statement[] = [
    // 0 — the open slots in the next few days
    {
      sql: `SELECT id, customer_name, phone, service, starts_at, status, source, notes, value_inr, created_at
              FROM desk_appointments
             WHERE business_id = ? AND status = 'booked' AND starts_at >= ?
             ORDER BY starts_at ASC LIMIT 50`,
      params: [business.id, todayStart],
    },
    // 1 — today's calls, for the counters at the top
    {
      sql: `SELECT outcome, value_inr FROM desk_calls
             WHERE business_id = ? AND created_at >= ? AND created_at < ?`,
      params: [business.id, todayStart, tomorrowStart],
    },
    // 2 — yesterday's calls, for the morning report
    {
      sql: `SELECT outcome, value_inr FROM desk_calls
             WHERE business_id = ? AND created_at >= ? AND created_at < ?`,
      params: [business.id, yesterdayStart, todayStart],
    },
    // 3 — yesterday's bookings, for the value on the book
    {
      sql: `SELECT value_inr FROM desk_appointments
             WHERE business_id = ? AND created_at >= ? AND created_at < ?`,
      params: [business.id, yesterdayStart, todayStart],
    },
    // 4 — the call log
    {
      sql: `SELECT id, customer_name, phone, outcome, language, notes, value_inr, follow_up_at,
                   created_at, appointment_id
              FROM desk_calls
             WHERE business_id = ?
             ORDER BY created_at DESC LIMIT 12`,
      params: [business.id],
    },
    // 5 — call-backs that have come due
    {
      sql: `SELECT id, customer_name, phone, outcome, language, notes, value_inr, follow_up_at,
                   created_at, appointment_id
              FROM desk_calls
             WHERE business_id = ? AND outcome = 'followup' AND follow_up_at IS NOT NULL
             ORDER BY follow_up_at ASC LIMIT 8`,
      params: [business.id],
    },
    // 6 — the recall list: no visit in 45 days
    {
      sql: `SELECT phone, MAX(customer_name) AS customer_name, MAX(starts_at) AS last_visit
              FROM desk_appointments
             WHERE business_id = ? AND phone <> ''
             GROUP BY phone
            HAVING MAX(starts_at) < ?
             ORDER BY last_visit DESC LIMIT 8`,
      params: [business.id, istIso(addDaysKey(todayKey, -45), "00:00")],
    },
    // 7 — the address the confirmation quotes
    {
      sql: "SELECT phone, whatsapp, address FROM business_profiles WHERE business_id = ?",
      params: [business.id],
    },
    // 8, 9 — the AI credit meter: the plan row, then this month's count
    ...aiQuery.statements,
    // 10 — the outbox, read after any flush above so the statuses are the real ones
    recentMessagesStatement(business.id, 8),
  ];

  const rows = await db.batch(statements);

  const appointments = rowsOf<DeskAppointmentRow>(rows[0]);
  const todayCalls = rowsOf<{ outcome: string; value_inr: number }>(rows[1]);
  const yesterdayCalls = rowsOf<{ outcome: string; value_inr: number }>(rows[2]);
  const yesterdayBookings = rowsOf<{ value_inr: number }>(rows[3]);
  const recentCalls = rowsOf<DeskCallRow>(rows[4]);
  const followUps = rowsOf<DeskCallRow>(rows[5]);
  const recalls = rowsOf<{ phone: string; customer_name: string; last_visit: string }>(rows[6]);
  const profile = firstRow<{ phone: string; whatsapp: string; address: string }>(rows[7]);
  const aiUsage = aiQuery.fromRows(rows[8], rows[9]);
  const messages = rowsOf<DeskMessageRow>(rows[10]);

  const bookedSlots = new Set(appointments.map((row) => row.starts_at));
  const todayAppointments = appointments.filter((row) => istDateKey(new Date(row.starts_at)) === todayKey);
  const report = countReport(yesterdayCalls, yesterdayBookings);
  const todayReport = countReport(todayCalls, []);
  const money = (amount: number) => formatMoney(amount, "INR");
  const ownerNumber = (settings.escalation_phone || profile?.whatsapp || profile?.phone || "").trim();
  const reportBody = reportText({
    language,
    businessName: business.name,
    counts: report,
    dayLabel: yesterdayKey === addDaysKey(todayKey, -1) ? "Yesterday" : yesterdayKey,
    money,
  });
  const reportLink = waLink(ownerNumber, reportBody);

  const freeToday = Math.max(
    0,
    slotOptions(settings, todayKey, 1)[0]?.slots.filter(
      (slot) => !bookedSlots.has(istIso(todayKey, slot)),
    ).length ?? 0,
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Operate"
        title={desk.title}
        description={
          autoSend
            ? `Every call, slot and callback for ${business.name} in one place, with WhatsApp confirmations and reminders going out on their own. The phone line itself is still not connected.`
            : `Every call, slot and callback for ${business.name} in one place. The phone line is not connected yet — the desk records what happens and writes the WhatsApp message for you.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium text-muted">
              {MESSAGE_LANGUAGES.map((item, index) => (
                <span key={item.id}>
                  {index > 0 && <span className="px-1 text-muted/50">·</span>}
                  <Link
                    href={`/dashboard/receptionist?lang=${item.id}`}
                    className={item.id === language ? "font-semibold text-ink" : "hover:text-ink"}
                  >
                    {item.label}
                  </Link>
                </span>
              ))}
            </span>
            <Link href="/dashboard/whatsapp" className="btn btn-ghost text-[12.5px]">
              WhatsApp setup
            </Link>
          </div>
        }
      />

      {params.saved && (
        <div className="rounded-[10px] border border-success/20 bg-success/5 px-3.5 py-2.5 text-[12.5px] text-success">
          {params.saved === "booked"
            ? `Booked. Send the confirmation below so the ${desk.person} has it in writing.`
            : params.saved === "sent"
              ? `Booked, and the WhatsApp confirmation went out through Meta. The reminder is queued for its own time.`
              : params.saved === "messaging"
                ? "WhatsApp sending saved."
                : params.saved === "call"
                  ? "Call logged."
                  : params.saved === "settings"
                    ? "Front desk settings saved."
                    : params.saved === "followup"
                      ? "Marked as called back."
                      : "Saved."}
        </div>
      )}
      {params.error && ERROR_TEXT[params.error] && (
        <div className="rounded-[10px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-danger">
          {ERROR_TEXT[params.error]}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Calls today" value={String(todayReport.calls)} hint={`${todayReport.missed} missed`} />
        <Stat label={`${desk.appointments} today`} value={String(todayAppointments.length)} hint={`${freeToday} slots still free`} />
        <Stat
          label="Booked today"
          value={String(todayReport.booked)}
          hint={todayReport.value > 0 ? `${money(todayReport.value)} on the book` : "Add a value when you book"}
        />
        <Stat
          label="To call back"
          value={String(followUps.length)}
          hint={followUps.length > 0 ? "Due now or soon" : "Nothing pending"}
          tone={followUps.length > 0 ? "brand" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel
            title="Book a slot"
            description={`The slot grid follows your hours (${formatClock(settings.opens_at)}–${formatClock(
              settings.closes_at,
            )}, ${settings.slot_minutes} min). ${closedDayLabels(settings.closed_days)}.`}
          >
            <form action={bookSlotAction} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="language" value={language} />
              <div className="sm:col-span-2">
                <label className="label" htmlFor="startsAt">
                  Slot
                </label>
                <select id="startsAt" name="startsAt" className="field" defaultValue="">
                  <option value="" disabled>
                    Pick an open slot
                  </option>
                  {slotOptions(settings, todayKey, 7).map((day) => (
                    <optgroup key={day.dateKey} label={day.label}>
                      {day.slots.map((slot) => {
                        const value = istIso(day.dateKey, slot);
                        const taken = bookedSlots.has(value);
                        return (
                          <option key={value} value={value} disabled={taken}>
                            {formatClock(slot)}
                            {taken ? " · booked" : ""}
                          </option>
                        );
                      })}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="customerName">
                  {desk.person === "customer" ? "Name" : `${desk.person[0]!.toUpperCase()}${desk.person.slice(1)} name`}
                </label>
                <input id="customerName" name="customerName" maxLength={80} className="field" placeholder="Sunita Rao" />
              </div>
              <div>
                <label className="label" htmlFor="phone">
                  Phone (for the WhatsApp confirmation)
                </label>
                <input id="phone" name="phone" maxLength={30} className="field" placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="label" htmlFor="service">
                  {desk.service[0]!.toUpperCase()}
                  {desk.service.slice(1)}
                </label>
                <input id="service" name="service" maxLength={80} className="field" placeholder="Consultation" />
              </div>
              <div>
                <label className="label" htmlFor="value">
                  Value (₹, optional)
                </label>
                <input id="value" name="value" inputMode="numeric" maxLength={7} className="field" placeholder="1500" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="booking-notes">
                  Note (optional)
                </label>
                <input id="booking-notes" name="notes" maxLength={240} className="field" placeholder="Wants the evening slot" />
              </div>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                <button type="submit" className="btn btn-brand text-[12.5px]">
                  Book it
                </button>
                <label className="flex items-center gap-1.5 text-[11.5px] text-muted">
                  <input type="checkbox" name="source" value="walkin" className="h-3.5 w-3.5" />
                  Walk-in, not a phone call
                </label>
              </div>
            </form>
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
              The value is what you type, never an estimate — the morning report only adds up numbers
              you entered.
            </p>
          </Panel>

          <Panel
            title="Next up"
            description={`${appointments.length} open ${desk.appointments.toLowerCase()} in the next few days`}
            padded={false}
          >
            {appointments.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title={`No ${desk.appointments.toLowerCase()} booked yet`}
                  description="Book the first one above. Every booking keeps the caller's number, so the confirmation and the reminder are one tap away."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {appointments.slice(0, 12).map((appointment) => {
                  const when = formatSlotRelative(appointment.starts_at, todayKey);
                  const confirm = confirmationText({
                    language,
                    businessName: business.name,
                    customerName: appointment.customer_name,
                    service: appointment.service,
                    when,
                    address: profile?.address ?? "",
                    person: desk.person,
                  });
                  const remind = reminderText({
                    language,
                    businessName: business.name,
                    customerName: appointment.customer_name,
                    when,
                    service: appointment.service,
                  });
                  const confirmLink = waLink(appointment.phone, confirm);
                  const remindLink = waLink(appointment.phone, remind);
                  return (
                    <li key={appointment.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="text-[12.5px] font-semibold">{appointment.customer_name}</p>
                        <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-[10px] text-muted">
                          {when}
                        </span>
                        {appointment.service && (
                          <span className="text-[11px] text-muted">{appointment.service}</span>
                        )}
                        {appointment.value_inr > 0 && (
                          <span className="text-[11.5px] font-medium">{money(appointment.value_inr)}</span>
                        )}
                        <span className="ml-auto text-[10px] uppercase tracking-[0.08em] text-muted/80">
                          {appointment.source}
                        </span>
                      </div>
                      {appointment.notes && (
                        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{appointment.notes}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {confirmLink ? (
                          <>
                            <Link
                              href={confirmLink}
                              target="_blank"
                              className="text-[11.5px] font-medium text-brand hover:underline"
                            >
                              WhatsApp confirmation
                            </Link>
                            <Link
                              href={remindLink ?? confirmLink}
                              target="_blank"
                              className="text-[11.5px] text-muted hover:text-ink hover:underline"
                            >
                              Reminder
                            </Link>
                          </>
                        ) : (
                          <span className="text-[11px] text-muted">No number saved — add it to send</span>
                        )}
                        <form action={updateAppointmentAction} className="ml-auto flex items-center gap-2">
                          <input type="hidden" name="id" value={appointment.id} />
                          <button
                            type="submit"
                            name="status"
                            value="completed"
                            className="text-[11px] text-success hover:underline"
                          >
                            Done
                          </button>
                          <button
                            type="submit"
                            name="status"
                            value="cancelled"
                            className="text-[11px] text-muted hover:text-danger hover:underline"
                          >
                            Cancel
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            title="Call log"
            description="Log every call you take or miss. This is what the morning report is built from."
            padded={false}
          >
            <form action={logCallAction} className="grid gap-3 border-b border-line p-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="callName">
                  Name (optional)
                </label>
                <input id="callName" name="customerName" maxLength={80} className="field" placeholder="Unknown" />
              </div>
              <div>
                <label className="label" htmlFor="callPhone">
                  Phone
                </label>
                <input id="callPhone" name="phone" maxLength={30} className="field" placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="label" htmlFor="callOutcome">
                  What happened
                </label>
                <select id="callOutcome" name="outcome" className="field" defaultValue="missed">
                  <option value="missed">Missed — I could not pick up</option>
                  <option value="answered">Answered — no booking</option>
                  <option value="followup">They said they will call later</option>
                  <option value="booked">Already booked (log only)</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="callLanguage">
                  Language
                </label>
                <select id="callLanguage" name="language" className="field" defaultValue="">
                  <option value="">Not noted</option>
                  <option value="hindi">Hindi</option>
                  <option value="hinglish">Hinglish</option>
                  <option value="english">English</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="callNotes">
                  What they wanted
                </label>
                <input
                  id="callNotes"
                  name="notes"
                  maxLength={240}
                  className="field"
                  placeholder="Asked about evening slots this week"
                />
              </div>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                <button type="submit" className="btn btn-primary text-[12.5px]">
                  Log the call
                </button>
                <span className="text-[10.5px] text-muted">
                  “They will call later” starts a {settings.followup_hours}-hour callback reminder.
                </span>
              </div>
            </form>

            {recentCalls.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No calls logged yet"
                  description="Start with today's missed calls. After a week the morning report becomes the clearest number in the business."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {recentCalls.map((call) => (
                  <li key={call.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        call.outcome === "missed"
                          ? "bg-danger/10 text-danger"
                          : call.outcome === "booked"
                            ? "bg-success/10 text-success"
                            : "bg-canvas text-muted"
                      }`}
                    >
                      {OUTCOME_LABEL[call.outcome] ?? call.outcome}
                    </span>
                    <span className="text-[12px] font-medium">{call.customer_name || "Unknown caller"}</span>
                    {call.notes && <span className="truncate text-[11.5px] text-muted">{call.notes}</span>}
                    {call.value_inr > 0 && <span className="text-[11px]">{money(call.value_inr)}</span>}
                    <span className="ml-auto text-[10.5px] text-muted">
                      {formatSlotRelative(call.created_at, todayKey)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Morning report" description={`What ${desk.appointments.toLowerCase()} looked like yesterday`}>
            <dl className="space-y-1.5 text-[12px]">
              <div className="flex justify-between">
                <dt className="text-muted">Calls logged</dt>
                <dd className="font-semibold">{report.calls}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Answered</dt>
                <dd className="font-semibold">{report.answered}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Missed</dt>
                <dd className="font-semibold text-danger">{report.missed}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{desk.appointments} booked</dt>
                <dd className="font-semibold">{report.booked}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5">
                <dt className="text-muted">Value on the book</dt>
                <dd className="font-semibold">{money(report.value)}</dd>
              </div>
            </dl>
            {reportLink ? (
              <Link
                href={reportLink}
                target="_blank"
                className="mt-3 block rounded-xl border border-line bg-canvas/60 px-3 py-2.5 text-[11.5px] font-medium text-brand hover:border-brand/40"
              >
                Send this report to my WhatsApp →
              </Link>
            ) : (
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                Add your own number under settings below and this becomes a one-tap morning message.
              </p>
            )}
            <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[10.5px] leading-relaxed text-muted">
              {reportBody}
            </pre>
          </Panel>

          <Panel title="Call-backs due" description={`Started by “call later”, ${settings.followup_hours}h later`}>
            {followUps.length === 0 ? (
              <p className="text-[11.5px] leading-relaxed text-muted">
                Nothing pending. When someone says they will call later, their name lands here with a
                booking link ready to send.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {followUps.map((call) => {
                  const state = followUpState(call.follow_up_at ?? "");
                  const body = followUpText({
                    language,
                    businessName: business.name,
                    customerName: call.customer_name,
                    person: desk.person,
                    bookingUrl,
                  });
                  const link = waLink(call.phone, body);
                  return (
                    <li key={call.id} className="rounded-xl border border-line p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-medium">{call.customer_name || call.phone || "Unknown"}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            state.due ? "bg-brand/10 text-brand" : "bg-canvas text-muted"
                          }`}
                        >
                          {state.label}
                        </span>
                      </div>
                      {link ? (
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <Link href={link} target="_blank" className="text-[11.5px] text-brand hover:underline">
                            Send booking link
                          </Link>
                          <form action={clearFollowUpAction}>
                            <input type="hidden" name="id" value={call.id} />
                            <button type="submit" className="text-[11px] text-muted hover:text-ink hover:underline">
                              Done
                            </button>
                          </form>
                        </div>
                      ) : (
                        <p className="mt-1 text-[11px] text-muted">No number saved.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Recall list" description={`No visit in 45 days, from your own bookings`}>
            {recalls.length === 0 ? (
              <p className="text-[11.5px] leading-relaxed text-muted">
                Appears once you have bookings older than 45 days. This is the list that fills quiet
                weeks without paying for ads.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {recalls.map((row) => {
                  const body = recallText({
                    language,
                    businessName: business.name,
                    customerName: row.customer_name,
                    person: desk.person,
                    bookingUrl,
                  });
                  const link = waLink(row.phone, body);
                  return (
                    <li key={row.phone} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium">{row.customer_name || row.phone}</p>
                        <p className="text-[10.5px] text-muted">Last visit {formatSlotRelative(row.last_visit, todayKey)}</p>
                      </div>
                      {link && (
                        <Link href={link} target="_blank" className="shrink-0 text-[11.5px] text-brand hover:underline">
                          Recall
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            title="WhatsApp sending"
            description={
              autoSend
                ? "On — confirmations and reminders leave on their own"
                : waStatus.ready
                  ? "Connected, but switched off"
                  : "Not connected — tap-to-send links still work"
            }
          >
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                autoSend
                  ? "bg-success/10 text-success"
                  : waStatus.ready
                    ? "bg-brand/10 text-brand"
                    : "border border-line bg-canvas text-muted"
              }`}
            >
              {autoSend ? "Sending" : waStatus.ready ? "Connected" : "Not connected"}
            </span>

            {waStatus.ready ? (
              <>
                <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
                  Meta accepts messages from this deployment
                  {messaging.display_number ? ` as ${messaging.display_number}` : ""}. A confirmation goes out
                  the moment you book; the reminder leaves {messaging.reminder_hours_before} hours before the
                  slot.
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  {waStatus.templateNames.confirmation && waStatus.templateNames.reminder
                    ? `Templates: ${waStatus.templateNames.confirmation} and ${waStatus.templateNames.reminder} (${waStatus.templateNames.lang}).`
                    : "No approved template named, so plain text is attempted. Meta usually allows that only inside a 24-hour window — set WHATSAPP_TEMPLATE_CONFIRMATION and WHATSAPP_TEMPLATE_REMINDER once your templates are approved."}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
                  Two server values are still missing. Nothing is queued or sent until they exist:
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-muted">
                  {waStatus.missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  The Meta step-by-step is in <code>docs/16-whatsapp-cloud-api.md</code>, and the exact
                  place to paste the values is in <code>docs/14-secrets-and-env.md</code>. Meanwhile every
                  booking keeps its one-tap link — that part needs no account.
                </p>
              </>
            )}

            <form action={saveMessagingSettingsAction} className="mt-3 space-y-2.5 border-t border-line pt-3">
              <label className="flex items-center gap-2 text-[12px] font-medium">
                <input
                  type="checkbox"
                  name="autoSend"
                  defaultChecked={messaging.auto_send === 1}
                  className="h-3.5 w-3.5"
                />
                Send confirmations and reminders automatically
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="reminderHoursBefore">
                    Reminder before (hours)
                  </label>
                  <input
                    id="reminderHoursBefore"
                    name="reminderHoursBefore"
                    type="number"
                    min={1}
                    max={72}
                    defaultValue={messaging.reminder_hours_before}
                    className="field"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="displayNumber">
                    WhatsApp number
                  </label>
                  <input
                    id="displayNumber"
                    name="displayNumber"
                    maxLength={30}
                    defaultValue={messaging.display_number}
                    placeholder="+91 98765 43210"
                    className="field"
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="phoneNumberId">
                  Meta phone-number ID (only if this business has its own)
                </label>
                <input
                  id="phoneNumberId"
                  name="phoneNumberId"
                  maxLength={40}
                  defaultValue={messaging.phone_number_id}
                  placeholder="Leave blank to use the deployment's number"
                  className="field"
                />
              </div>
              <button type="submit" className="btn btn-ghost text-[12px]">
                Save sending
              </button>
            </form>

            {messages.length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-line pt-3">
                {messages.map((message) => (
                  <li key={message.id} className="rounded-xl border border-line p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11.5px] font-medium">
                        {MESSAGE_KIND_LABEL[message.kind] ?? message.kind} · +{message.to_phone}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          message.status === "sent"
                            ? "bg-success/10 text-success"
                            : message.status === "failed"
                              ? "bg-danger/10 text-danger"
                              : "bg-canvas text-muted"
                        }`}
                      >
                        {MESSAGE_STATUS_LABEL[message.status] ?? message.status}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-muted">{message.body}</p>
                    {message.error && message.status !== "sent" && (
                      <p className="mt-1 text-[10px] leading-relaxed text-danger">{message.error}</p>
                    )}
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted">
                        {message.status === "sent" && message.sent_at
                          ? `Sent ${formatSlotRelative(message.sent_at, todayKey)}`
                          : `Due ${formatSlotRelative(message.send_at, todayKey)}`}
                      </span>
                      {waStatus.ready && message.status !== "sent" && (
                        <form action={sendMessageNowAction}>
                          <input type="hidden" name="messageId" value={message.id} />
                          <button type="submit" className="text-[10.5px] text-brand hover:underline">
                            {message.status === "failed" ? "Retry" : "Send now"}
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
              A message shows "Sent" only after Meta returns a message id. Scheduled ones leave when the
              desk is opened, or on the hour if you point a free scheduler at the dispatch URL in the docs.
            </p>
          </Panel>

          <Panel title="The phone line" description="Not connected">
            <span className="inline-flex rounded-full border border-line bg-canvas px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Not connected
            </span>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
              Nothing answers your calls for you yet, and this page will not pretend it does. A real
              receptionist needs four paid pieces: a phone number from a telecom provider, a speech
              service that listens, a voice that speaks, and a model that decides.
            </p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
              What works today is everything around the call: the greeting script, the slot calendar,
              the callback queue and the WhatsApp messages — all of it free.
            </p>
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Front desk settings" description="Hours, slots and the greeting">
          <form action={saveDeskSettingsAction} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="greeting">
                Greeting (first thing a caller hears)
              </label>
              <input id="greeting" name="greeting" defaultValue={settings.greeting} maxLength={200} className="field" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="languages">
                Languages you answer in
              </label>
              <input id="languages" name="languages" defaultValue={settings.languages} maxLength={80} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="opensAt">
                Opens
              </label>
              <input id="opensAt" name="opensAt" type="time" defaultValue={settings.opens_at} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="closesAt">
                Closes
              </label>
              <input id="closesAt" name="closesAt" type="time" defaultValue={settings.closes_at} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="slotMinutes">
                Slot length (minutes)
              </label>
              <input
                id="slotMinutes"
                name="slotMinutes"
                type="number"
                min={5}
                max={180}
                step={5}
                defaultValue={settings.slot_minutes}
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="followupHours">
                Call-back reminder after (hours)
              </label>
              <input
                id="followupHours"
                name="followupHours"
                type="number"
                min={1}
                max={48}
                defaultValue={settings.followup_hours}
                className="field"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="escalationPhone">
                Your own number (for the morning report)
              </label>
              <input
                id="escalationPhone"
                name="escalationPhone"
                defaultValue={settings.escalation_phone}
                maxLength={30}
                className="field"
                placeholder="+91 98765 43210"
              />
            </div>
            <fieldset className="sm:col-span-2">
              <legend className="label">Closed on</legend>
              <div className="flex flex-wrap gap-3">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                  <label key={day} className="flex items-center gap-1.5 text-[11.5px] text-muted">
                    <input
                      type="checkbox"
                      name="closedDays"
                      value={index}
                      defaultChecked={settings.closed_days.split(",").includes(String(index))}
                      className="h-3.5 w-3.5"
                    />
                    {day}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-brand text-[12.5px]">
                Save front desk
              </button>
            </div>
          </form>
        </Panel>

        <div className="space-y-4">
          <DeskScript
            configured={isAiConfigured()}
            defaultLanguage={language}
            credits={{
              used: aiUsage.used,
              limit: aiLimitFor(aiUsage.limit),
              planName: aiUsage.planName,
              monthLabel: aiUsage.monthLabel,
            }}
          />
          <Panel title="Built-in messages" description={`Templates in ${languageLabel(language)} — no credit, no API`}>
            <ul className="space-y-2.5">
              <li className="rounded-xl border border-line p-2.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">Confirmation</p>
                <p className="mt-1 whitespace-pre-wrap text-[11.5px] leading-relaxed">
                  {confirmationText({
                    language,
                    businessName: business.name,
                    customerName: "Sunita",
                    service: desk.service,
                    when: "tomorrow 5:00 pm",
                    address: profile?.address ?? "",
                    person: desk.person,
                  })}
                </p>
              </li>
              <li className="rounded-xl border border-line p-2.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">Call-back</p>
                <p className="mt-1 whitespace-pre-wrap text-[11.5px] leading-relaxed">
                  {followUpText({
                    language,
                    businessName: business.name,
                    customerName: "Sunita",
                    person: desk.person,
                    bookingUrl,
                  })}
                </p>
              </li>
            </ul>
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
              {autoSend
                ? "These are the same words the automatic messages use, so you can read them before they leave. Every button still opens WhatsApp with the text typed in, if you would rather send it by hand."
                : "Every WhatsApp button opens WhatsApp with this text typed in. You still tap send — there is no WhatsApp API connected, and no message is sent for you."}
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** The plan's AI ceiling; kept here so the panel never prints NaN. */
function aiLimitFor(limit: number): number {
  return Number.isFinite(limit) ? limit : 0;
}
