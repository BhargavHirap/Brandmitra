import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, PageHeader, Panel, Stat } from "@/components/ui";
import { requireBusiness } from "@/lib/business";
import { firstRow, getDb, rowsOf } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Security log" };

/**
 * SECURITY LOG — owners only.
 *
 * Two things get written to `security_logs`: a sign-in that was refused and a
 * webhook that failed its signature check. Both are events about the platform,
 * not about one shop, and a refused sign-in has no business attached at all, so
 * this screen is gated on `users.is_platform_admin` — the same server-side flag
 * that unlocks founder access. A normal owner is redirected away instead of
 * being shown other people's addresses.
 *
 * What is on the page is exactly what was stored: an address, an IP that the
 * edge reported, the path, and a small reason. Never a password, token, or
 * request body — those were never written in the first place.
 */

type EventRow = {
  id: string;
  kind: string;
  email: string;
  ip: string;
  path: string;
  detail: string;
  created_at: string;
};

const KIND_LABELS: Record<string, { label: string; tone: string }> = {
  signin_failed: {
    label: "Refused sign-in",
    tone: "border-danger/20 bg-danger/5 text-danger",
  },
  webhook_rejected: {
    label: "Rejected webhook",
    tone: "border-warning/25 bg-warning/5 text-warning",
  },
};

/** The stored detail is a small JSON object; show it as one quiet line. */
function detailPairs(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.entries(parsed as Record<string, unknown>)
      .slice(0, 4)
      .map(([key, value]) =>
        `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`.slice(0, 120),
      );
  } catch {
    return [];
  }
}

export default async function SecurityLogPage() {
  const { user } = await requireBusiness();
  if (!user.isPlatformAdmin) redirect("/dashboard");

  const db = await getDb();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const report = await db.batch([
    {
      sql: `SELECT id, kind, email, ip, path, detail, created_at
              FROM security_logs
             ORDER BY created_at DESC
             LIMIT 50`,
      params: [],
    },
    {
      sql: `SELECT kind, COUNT(*) AS n FROM security_logs
             WHERE created_at >= ? GROUP BY kind`,
      params: [since],
    },
    { sql: "SELECT COUNT(*) AS n FROM security_logs", params: [] },
  ]);

  const events = rowsOf<EventRow>(report[0]);
  const weekRows = rowsOf<{ kind: string; n: number }>(report[1]);
  const allTime = firstRow<{ n: number }>(report[2]);

  const week = (kind: string) => Number(weekRows.find((row) => row.kind === kind)?.n ?? 0);
  const signIns = week("signin_failed");
  const webhooks = week("webhook_rejected");

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Owners only"
        title="Security log"
        description="Sign-ins that were refused and payment webhooks that failed their signature check, newest first. Only a founder account can open this screen."
        actions={
          <Link href="/dashboard" className="btn btn-ghost text-[12.5px]">
            Back to overview
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          label="Refused sign-ins"
          value={String(signIns)}
          hint="Last 7 days"
          tone={signIns > 0 ? "brand" : "default"}
        />
        <Stat
          label="Rejected webhooks"
          value={String(webhooks)}
          hint="Last 7 days"
          tone={webhooks > 0 ? "brand" : "default"}
        />
        <Stat
          label="Everything recorded"
          value={String(Number(allTime?.n ?? 0))}
          hint="All time"
        />
      </div>

      <Panel
        title="Recent events"
        description={
          events.length === 0
            ? "Nothing has been refused yet."
            : `Newest ${events.length === 1 ? "event" : `${events.length} events`}, newest first`
        }
        padded={false}
      >
        {events.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No refused events"
              description="A wrong password or a forged payment webhook will show up here. An empty log means neither has happened, not that logging is off."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {events.map((event) => {
              const meta = KIND_LABELS[event.kind] ?? {
                label: event.kind,
                tone: "border-line bg-canvas text-muted",
              };
              const pairs = detailPairs(event.detail);
              const where = [event.ip, event.path].filter(Boolean).join(" · ");

              return (
                <li key={event.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.tone}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted">
                      {formatDateTime(event.created_at)}
                    </span>
                  </div>
                  <p className="mt-1.5 break-all text-[12.5px] font-medium">
                    {event.email || "No address given"}
                  </p>
                  {where && (
                    <p className="mt-0.5 break-all text-[11px] text-muted">{where}</p>
                  )}
                  {pairs.length > 0 && (
                    <p className="mt-1 break-all text-[11px] leading-relaxed text-muted">
                      {pairs.join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <p className="px-1 text-[11.5px] leading-relaxed text-muted">
        The same reason is written for &ldquo;no such account&rdquo; and &ldquo;wrong password&rdquo;,
        so this log cannot be used to discover which addresses exist. No password, session token,
        webhook signature or request body is stored, and the log never blocks the refusal it
        records. It keeps the last 50 events here; older rows stay in the database.
      </p>
    </div>
  );
}
