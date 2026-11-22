/**
 * FRONT DESK — the receptionist layer every business type gets.
 *
 * A clinic, a salon, a gym, a kirana shop and a fabric wholesaler all lose calls
 * for the same reason: nobody can pick up at 1 pm. What changes between them is
 * only the words — a clinic books an appointment for a patient, a salon a slot
 * for a client, a wholesaler a call-back for a buyer.
 *
 * This file holds the parts that must be identical on every screen:
 *   - the wording for each business type (built on workspace.ts, so the 50 types
 *     keep their own nouns),
 *   - slot maths in India Standard Time,
 *   - the WhatsApp message bodies,
 *   - the morning report numbers.
 *
 * It writes nothing. The actions in src/app/actions/reception.ts do that.
 */

import { workspaceFor } from "@/lib/workspace";
import { industryGroupOf } from "@/lib/industries";

export type Desk = {
  /** Screen title, e.g. "Front desk". */
  title: string;
  /** One person: patient, client, member, customer, student, buyer. */
  person: string;
  /** Many: Patients, Clients, Members… */
  people: string;
  /** What a booking is called here: appointment, booking, order. */
  appointment: string;
  /** Plural. */
  appointments: string;
  /** What they come in for: treatment, service, dish, SKU. */
  service: string;
  /** Default greeting, still holding the {business} placeholder. */
  greeting: string;
};

const GREETING_BY_GROUP: Record<string, string> = {
  food: "Namaste, {business}! Kya order karna chahenge?",
  wellness: "Namaste, {business}! Kaise madad kar sakte hain? Appointment book karni hai?",
  retail: "Namaste, {business}! Kaise madad kar sakte hain?",
  services: "Namaste, {business}! Kaise madad kar sakte hain?",
  learning: "Namaste, {business}! Admission ya batch ke baare mein poochna hai?",
  wholesale: "Namaste, {business}! Order ya rate ke baare mein baat karni hai?",
};

/** The vocabulary this business type sees on the front desk. */
export function deskFor(industry: string): Desk {
  const w = workspaceFor(industry);
  const group = industryGroupOf(industry)?.value ?? "";
  return {
    title: "Front desk",
    person: w.customer,
    people: w.customers,
    appointment: w.order,
    appointments: w.orders,
    service: w.item,
    greeting: GREETING_BY_GROUP[group] ?? "Namaste, {business}! Kaise madad kar sakte hain?",
  };
}

/* ── Settings ─────────────────────────────────────────────────────────────── */

export type DeskSettings = {
  greeting: string;
  languages: string;
  opens_at: string;
  closes_at: string;
  closed_days: string;
  slot_minutes: number;
  escalation_phone: string;
  followup_hours: number;
};

export function defaultSettings(desk: Desk, businessName: string): DeskSettings {
  return {
    greeting: desk.greeting.replaceAll("{business}", businessName),
    languages: "Hindi, Hinglish, English",
    opens_at: "10:00",
    closes_at: "20:00",
    closed_days: "0",
    slot_minutes: 30,
    escalation_phone: "",
    followup_hours: 2,
  };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parseClosedDays(value: string): number[] {
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

export function closedDayLabels(value: string): string {
  const days = parseClosedDays(value);
  if (days.length === 0) return "Open every day";
  return `Closed on ${days.map((day) => DAY_NAMES[day]).join(", ")}`;
}

/* ── Time, always in India Standard Time ──────────────────────────────────── */

const IST_OFFSET_MINUTES = 330;

export function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.min(23, hours)) * 60 + Math.max(0, Math.min(59, minutes));
}

export function fromMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function istShifted(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
}

/** "2026-11-22" for the given instant, in IST. */
export function istDateKey(date: Date = new Date()): string {
  return istShifted(date).toISOString().slice(0, 10);
}

/** "2026-11-22" -> "2026-11-24". */
export function addDaysKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** An appointment start, stored with its offset so string order is time order. */
export function istIso(dateKey: string, hhmm: string): string {
  return `${dateKey}T${hhmm}:00+05:30`;
}

/** Weekday of a date key, 0 = Sunday (IST). */
export function istWeekday(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00+05:30`).getUTCDay();
}

export function weekdayName(dateKey: string): string {
  return DAY_NAMES[istWeekday(dateKey)];
}

/** "10:00", "10:30", … up to the last slot that fits before closing. */
export function timeSlots(opens: string, closes: string, slotMinutes: number): string[] {
  const step = Math.max(5, Math.min(180, Math.round(slotMinutes) || 30));
  const start = toMinutes(opens);
  const end = toMinutes(closes);
  const slots: string[] = [];
  for (let minute = start; minute + step <= end; minute += step) slots.push(fromMinutes(minute));
  return slots;
}

/** "5:00 pm" for a HH:MM string. */
export function formatClock(hhmm: string): string {
  const minutes = toMinutes(hhmm);
  const hours24 = Math.floor(minutes / 60);
  const suffix = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes % 60).padStart(2, "0")} ${suffix}`;
}

/** "Mon, 24 Nov, 5:00 pm" for a stored appointment start. */
export function formatSlot(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** "Today, 5:00 pm" / "Tomorrow, 5:00 pm" / "Mon, 24 Nov, 5:00 pm". */
export function formatSlotRelative(iso: string, todayKey: string): string {
  const key = istDateKey(new Date(iso));
  const time = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
  if (key === todayKey) return `Today, ${time}`;
  if (key === addDaysKey(todayKey, 1)) return `Tomorrow, ${time}`;
  return formatSlot(iso);
}

/** Every slot for the next `days` days, with the days this business is closed removed. */
export function slotOptions(
  settings: DeskSettings,
  todayKey: string,
  days = 7,
): { dateKey: string; label: string; slots: string[] }[] {
  const closed = new Set(parseClosedDays(settings.closed_days));
  const perDay = timeSlots(settings.opens_at, settings.closes_at, settings.slot_minutes);
  const out: { dateKey: string; label: string; slots: string[] }[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const dateKey = addDaysKey(todayKey, offset);
    if (closed.has(istWeekday(dateKey))) continue;
    out.push({
      dateKey,
      label:
        offset === 0
          ? `Today · ${formatClock(settings.opens_at)}–${formatClock(settings.closes_at)}`
          : offset === 1
            ? `Tomorrow · ${formatClock(settings.opens_at)}–${formatClock(settings.closes_at)}`
            : `${weekdayName(dateKey)} ${dateKey.slice(8)} ${dateKey.slice(5, 7)} · ${formatClock(
                settings.opens_at,
              )}–${formatClock(settings.closes_at)}`,
      slots: perDay,
    });
  }
  return out;
}

/* ── WhatsApp, the free route ─────────────────────────────────────────────── */

/**
 * A wa.me link opens WhatsApp with this text already typed. The owner — or the
 * customer, for the confirmation — still taps send. Nothing is sent for them,
 * because no WhatsApp API is connected on a free deployment.
 */
export function waNumber(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function waLink(phone: string, text: string): string | null {
  const number = waNumber(phone);
  if (number.length < 10) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export const MESSAGE_LANGUAGES = [
  { id: "hinglish", label: "Hinglish" },
  { id: "english", label: "English" },
  { id: "hindi", label: "Hindi" },
] as const;

export type MessageLanguage = (typeof MESSAGE_LANGUAGES)[number]["id"];

export function languageLabel(id: string): string {
  return MESSAGE_LANGUAGES.find((item) => item.id === id)?.label ?? "Hinglish";
}

export function confirmationText(input: {
  language: MessageLanguage;
  businessName: string;
  customerName: string;
  service: string;
  when: string;
  address: string;
  person: string;
}): string {
  const name = input.customerName.split(" ")[0] || input.customerName;
  const service = input.service ? ` for ${input.service}` : "";
  const place = input.address ? `\n${input.address}` : "";
  if (input.language === "english") {
    return `Hi ${name}, your ${input.person === "customer" ? "booking" : input.person + " visit"}${service} at ${input.businessName} is confirmed for ${input.when}.${place}\n\nReply here if you need to change it.`;
  }
  if (input.language === "hindi") {
    return `नमस्ते ${name}, ${input.businessName} में आपका ${input.when} का समय${service} कन्फर्म हो गया है।${place}\n\nबदलना हो तो यहीं जवाब दें।`;
  }
  return `Namaste ${name}, ${input.businessName} mein aapka ${input.when} ka slot${service} confirm ho gaya hai.${place}\n\nChange karna ho to yahin reply kar dein.`;
}

export function reminderText(input: {
  language: MessageLanguage;
  businessName: string;
  customerName: string;
  when: string;
  service: string;
}): string {
  const name = input.customerName.split(" ")[0] || input.customerName;
  const service = input.service ? ` (${input.service})` : "";
  if (input.language === "english") {
    return `Reminder: ${name}, your visit at ${input.businessName} is ${input.when}${service}. See you then.`;
  }
  if (input.language === "hindi") {
    return `याद दिलाने के लिए: ${name}, ${input.businessName} में आपका समय ${input.when}${service} है। मिलते हैं।`;
  }
  return `Reminder: ${name}, ${input.businessName} mein aapka slot ${input.when}${service} hai. Milte hain.`;
}

export function followUpText(input: {
  language: MessageLanguage;
  businessName: string;
  customerName: string;
  person: string;
  bookingUrl: string;
}): string {
  const name = input.customerName.split(" ")[0] || input.customerName || "";
  const who = name ? `${name}, ` : "";
  if (input.language === "english") {
    return `Hi ${who}thanks for calling ${input.businessName}. You can pick a time that suits you here: ${input.bookingUrl}\n\nIf you would rather talk, just reply to this message.`;
  }
  if (input.language === "hindi") {
    return `नमस्ते ${who}${input.businessName} पर कॉल करने के लिए धन्यवाद। अपना समय यहाँ चुन लें: ${input.bookingUrl}\n\nबात करनी हो तो इसी मैसेज का जवाब दें।`;
  }
  return `Namaste ${who}${input.businessName} par call karne ke liye dhanyavaad. Apna time yahan choose kar lein: ${input.bookingUrl}\n\nBaar baat karni ho to isi message ka reply kar dein.`;
}

export function recallText(input: {
  language: MessageLanguage;
  businessName: string;
  customerName: string;
  person: string;
  bookingUrl: string;
}): string {
  const name = input.customerName.split(" ")[0] || input.customerName || "";
  const who = name ? `${name}, ` : "";
  if (input.language === "english") {
    return `Hi ${who}it has been a while since your last visit to ${input.businessName}. Shall we keep a slot for you this week? Pick one here: ${input.bookingUrl}`;
  }
  if (input.language === "hindi") {
    return `नमस्ते ${who}${input.businessName} पर आपकी पिछली विज़िट काफ़ी समय पहले हुई थी। इस हफ़्ते आपके लिए समय रख दें? यहाँ चुन लें: ${input.bookingUrl}`;
  }
  return `Namaste ${who}${input.businessName} par aapki pichhli visit kaafi samay pehle hui thi. Is hafte aapke liye slot rakh dein? Yahan choose kar lein: ${input.bookingUrl}`;
}

/* ── The morning report ───────────────────────────────────────────────────── */

export type ReportCounts = {
  calls: number;
  answered: number;
  missed: number;
  followups: number;
  booked: number;
  value: number;
};

type ReportCall = { outcome: string; value_inr: number };
type ReportAppointment = { value_inr: number };

/**
 * Yesterday's numbers, from the rows the owner actually has. `value` is the sum
 * of the amounts the owner typed in — Vantra never estimates what a visit is
 * worth, because a wrong "₹38,000 recovered" is worse than a blank.
 */
export function countReport(calls: ReportCall[], appointments: ReportAppointment[]): ReportCounts {
  const answered = calls.filter((call) => call.outcome === "answered" || call.outcome === "booked").length;
  const missed = calls.filter((call) => call.outcome === "missed").length;
  const followups = calls.filter((call) => call.outcome === "followup").length;
  const callValue = calls.reduce((total, call) => total + (Number(call.value_inr) || 0), 0);
  const bookedValue = appointments.reduce((total, row) => total + (Number(row.value_inr) || 0), 0);
  return {
    calls: calls.length,
    answered,
    missed,
    followups,
    booked: appointments.length,
    value: callValue + bookedValue,
  };
}

export function reportText(input: {
  language: MessageLanguage;
  businessName: string;
  counts: ReportCounts;
  dayLabel: string;
  money: (amount: number) => string;
}): string {
  const { counts } = input;
  if (input.language === "english") {
    return `${input.businessName} · ${input.dayLabel}\nCalls: ${counts.calls}\nAnswered: ${counts.answered}\nMissed: ${counts.missed}\n${counts.booked} booked · ${input.money(counts.value)} of work on the book\nStill to call back: ${counts.followups}`;
  }
  if (input.language === "hindi") {
    return `${input.businessName} · ${input.dayLabel}\nकॉल: ${counts.calls}\nउत्तर दिए: ${counts.answered}\nछूटे: ${counts.missed}\n${counts.booked} बुकिंग · ${input.money(counts.value)} का काम\nकॉल बैक बाकी: ${counts.followups}`;
  }
  return `${input.businessName} · ${input.dayLabel}\nCalls: ${counts.calls}\nAnswered: ${counts.answered}\nMissed: ${counts.missed}\n${counts.booked} bookings · ${input.money(counts.value)} ka kaam\nCall back baaki: ${counts.followups}`;
}

/** How late a follow-up is, in words. */
export function followUpState(dueIso: string, now: Date = new Date()): { due: boolean; label: string } {
  const due = new Date(dueIso);
  if (Number.isNaN(due.getTime())) return { due: false, label: "—" };
  const minutes = Math.round((due.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return { due: true, label: `Due ${Math.abs(minutes)} min ago` };
  if (minutes < 60) return { due: false, label: `In ${minutes} min` };
  const hours = Math.round(minutes / 60);
  return { due: false, label: `In ${hours} h` };
}
