import Link from "next/link";
import { createResetLinkAction, readHandover } from "@/app/actions/password-reset";
import { addStaffAction, changeStaffRoleAction, removeStaffAction } from "@/app/actions/staff";
import { CopyLink } from "@/components/copy-link";
import { PageHeader, Panel, Stat } from "@/components/ui";
import { requireBusiness, staffLimitLabel } from "@/lib/business";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff" };

/**
 * STAFF.
 *
 * Members are real accounts linked to this business. There is no email service,
 * so an "invite" would be a lie: the person signs up first, then the owner adds
 * their email. The owner row is protected on the server, and the plan's staff
 * limit is enforced there too.
 */

type MemberRow = {
  id: string;
  role: string;
  created_at: string;
  email: string;
  full_name: string;
  user_id: string;
};

const ERROR_TEXT: Record<string, string> = {
  forbidden: "Only the owner can manage staff.",
  email: "Enter the email address they signed up with.",
  self: "You are already the owner of this business.",
  unknown: "No Vantra account uses that email yet. Ask them to sign up first.",
  member: "That person is already on this team.",
  missing: "That team member no longer exists.",
  owner: "The owner cannot be changed or removed here.",
  limit: "Your plan's staff limit is reached. Remove someone or upgrade when billing arrives.",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
};

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; removed?: string; error?: string; link?: string }>;
}) {
  const { business, planId, role, user } = await requireBusiness();
  const params = await searchParams;
  const db = await getDb();

  const [members, plan, pendingResets] = await Promise.all([
    db.all<MemberRow>(
      `SELECT m.id, m.role, m.created_at, u.email, u.full_name, u.id AS user_id
         FROM business_members m
         JOIN users u ON u.id = m.user_id
        WHERE m.business_id = ?
        ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, m.created_at ASC`,
      [business.id],
    ),
    db.first<{ staff_limit: number; name: string }>(
      "SELECT staff_limit, name FROM plans WHERE id = ?",
      [planId],
    ),
    db.all<{ user_id: string; email: string; created_at: string }>(
      `SELECT u.id AS user_id, u.email, MAX(r.created_at) AS created_at
         FROM password_resets r
         JOIN users u ON u.id = r.user_id
         JOIN business_members m ON m.user_id = u.id
        WHERE m.business_id = ? AND r.used_at IS NULL AND r.expires_at > ?
        GROUP BY u.id, u.email
        ORDER BY created_at DESC LIMIT 10`,
      [business.id, new Date().toISOString()],
    ),
  ]);

  const handover = await readHandover();

  const limit = Number(plan?.staff_limit ?? 1);
  const used = members.length;
  const atLimit = used >= limit;
  const isOwner = role === "owner";

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Business"
        title="Staff"
        description="People who can open this dashboard. Everyone signs up first; the owner then adds the email they used."
        actions={
          <Link href="/dashboard/settings" className="btn btn-ghost text-[12.5px]">
            Settings
          </Link>
        }
      />

      {params.saved === "1" && (
        <div className="rounded-[10px] border border-success/20 bg-success/5 px-3.5 py-2.5 text-[12.5px] text-success">
          Team updated.
        </div>
      )}
      {params.removed === "1" && (
        <div className="rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[12.5px] text-muted">
          Team member removed. Their account still exists — they simply cannot open this business any
          more.
        </div>
      )}
      {params.error && ERROR_TEXT[params.error] && (
        <div className="rounded-[10px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-danger">
          {ERROR_TEXT[params.error]}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Team size"
          value={`${used} of ${staffLimitLabel(limit)}`}
          hint={`${plan?.name ?? "Free"} plan · no seat cap`}
          tone="brand"
        />
        <Stat
          label="Managers"
          value={String(members.filter((member) => member.role === "manager").length)}
          hint="Can run the day to day"
        />
        <Stat
          label="You"
          value={ROLE_LABELS[role] ?? role}
          hint={user.email}
        />
        <Stat label="Seats left" value={staffLimitLabel(limit) === "Unlimited" ? "Unlimited" : String(Math.max(0, limit - used))} hint="Every plan is uncapped" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Team" description="Owner, managers and staff" padded={false}>
            <ul className="divide-y divide-line">
              {members.map((member) => (
                <li key={member.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">
                        {member.full_name || member.email}
                        {member.user_id === user.id ? " (you)" : ""}
                      </p>
                      <p className="mt-0.5 truncate text-[11.5px] text-muted">{member.email}</p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        member.role === "owner"
                          ? "border-brand/25 bg-brand-soft text-brand"
                          : "border-line bg-white text-muted"
                      }`}
                    >
                      {ROLE_LABELS[member.role] ?? member.role}
                    </span>
                    <span className="text-[10.5px] text-muted">
                      joined {formatDateTime(member.created_at)}
                    </span>
                  </div>

                  {isOwner && member.role !== "owner" && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <form action={changeStaffRoleAction} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={member.id} />
                        <select
                          name="role"
                          defaultValue={member.role}
                          aria-label={`Role for ${member.email}`}
                          className="field w-auto py-1 text-[11.5px]"
                        >
                          <option value="staff">Staff</option>
                          <option value="manager">Manager</option>
                        </select>
                        <button type="submit" className="btn btn-ghost px-2.5 py-1 text-[11.5px]">
                          Save role
                        </button>
                      </form>
                      <form action={removeStaffAction}>
                        <input type="hidden" name="id" value={member.id} />
                        <button
                          type="submit"
                          className="text-[11.5px] text-muted underline-offset-2 hover:text-danger hover:underline"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-4">
          {isOwner ? (
            <Panel title="Add someone" description={atLimit ? "All seats are in use" : "They need an account first"}>
              <form action={addStaffAction} className="space-y-3">
                <div>
                  <label className="label" htmlFor="staffEmail">
                    Their email
                  </label>
                  <input
                    id="staffEmail"
                    name="email"
                    type="email"
                    required
                    maxLength={160}
                    placeholder="name@example.com"
                    className="field"
                    disabled={atLimit}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-brand w-full text-[12.5px]"
                  disabled={atLimit}
                >
                  {atLimit ? "No seats left" : "Add to this business"}
                </button>
              </form>
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                They sign up at the normal signup page, then you add the email here. No invitation
                email is sent, because this project has no email service connected.
              </p>
            </Panel>
          ) : (
            <Panel title="Add someone" description="Owner only">
              <p className="text-[11.5px] leading-relaxed text-muted">
                Only the owner can add or remove people. Ask them if a seat is needed.
              </p>
            </Panel>
          )}

          <Panel
            title="Password resets"
            description={pendingResets.length > 0 ? `${pendingResets.length} waiting` : "Nobody locked out"}
          >
            {handover && (
              <div className="mb-3 rounded-xl border border-brand/25 bg-brand-soft/60 p-2.5">
                <p className="text-[11px] font-semibold text-ink">
                  Link for {handover.email} — shown once, works for one hour
                </p>
                <p className="mt-1 break-all font-mono text-[10.5px] leading-relaxed text-muted">
                  {handover.link}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CopyLink value={handover.link} />
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Reset your Vantra password (works once, 1 hour): ${handover.link}`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-brand px-2.5 py-1 text-[11.5px]"
                  >
                    Send on WhatsApp
                  </a>
                </div>
              </div>
            )}

            {pendingResets.length === 0 ? (
              <p className="text-[11.5px] leading-relaxed text-muted">
                When someone uses <span className="font-medium text-ink">Forgot password</span> on the
                sign-in page, they appear here. No email is sent on this deployment, so you hand them
                the link yourself.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {pendingResets.map((row) => (
                  <li key={row.user_id} className="rounded-xl border border-line p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium">{row.email}</p>
                        <p className="text-[10.5px] text-muted">
                          asked {formatDateTime(row.created_at)}
                        </p>
                      </div>
                      {isOwner && (
                        <form action={createResetLinkAction}>
                          <input type="hidden" name="userId" value={row.user_id} />
                          <button type="submit" className="btn btn-ghost px-2.5 py-1 text-[11px]">
                            Create reset link
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
              A link works once, expires in an hour, and signs the account out everywhere. Only the
              owner can create one.
            </p>
          </Panel>

          <Panel title="What each role can do">
            <ul className="space-y-2 text-[11.5px] leading-relaxed text-muted">
              <li>
                <span className="font-semibold text-ink">Owner</span> — everything, including staff,
                settings and deletion.
              </li>
              <li>
                <span className="font-semibold text-ink">Manager</span> — products, orders, kitchen,
                inventory and marketing.
              </li>
              <li>
                <span className="font-semibold text-ink">Staff</span> — the same dashboard; use the
                kitchen display for day-to-day work.
              </li>
              <li>
                Removing someone unlinks them from this business only. Their account and any other
                business they belong to are untouched.
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
