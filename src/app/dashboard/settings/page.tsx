import Link from "next/link";
import {
  changePasswordAction,
  updateAccountAction,
  updateBusinessDetailsAction,
} from "@/app/actions/settings";
import { PageHeader, Panel } from "@/components/ui";
import { INDUSTRIES, requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

/**
 * SETTINGS.
 *
 * Business details are owner-only and re-validated on the server. Account and
 * password belong to the signed-in person. Nothing here can delete data.
 */

const ERROR_TEXT: Record<string, string> = {
  forbidden: "Only the owner can change the business details.",
  name: "The business name needs at least 2 characters.",
  email: "Enter a valid email address.",
  emailTaken: "Another account already uses that email.",
  personName: "Your name needs at least 2 characters.",
  password: "That is not your current password.",
  short: "Use at least 8 characters for the new password.",
  mismatch: "The two new passwords do not match.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { user, business, planId, role } = await requireBusiness();
  const params = await searchParams;
  const db = await getDb();

  const [plan, profile] = await Promise.all([
    db.first<{ name: string }>("SELECT name FROM plans WHERE id = ?", [planId]),
    db.first<{ city: string; phone: string }>(
      "SELECT city, phone FROM business_profiles WHERE business_id = ?",
      [business.id],
    ),
  ]);

  const isOwner = role === "owner";

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Business"
        title="Settings"
        description="The business itself, your own account, and your password. Storefront text and colours live under My website."
        actions={
          <Link href="/dashboard/website" className="btn btn-ghost text-[12.5px]">
            My website
          </Link>
        }
      />

      {params.saved && (
        <div className="rounded-[10px] border border-success/20 bg-success/5 px-3.5 py-2.5 text-[12.5px] text-success">
          {params.saved === "password"
            ? "Password changed. Other devices stay signed in until their session expires."
            : params.saved === "account"
              ? "Your account details were saved."
              : "Business details saved. Your storefront shows the new name immediately."}
        </div>
      )}
      {params.error && ERROR_TEXT[params.error] && (
        <div className="rounded-[10px] border border-danger/20 bg-danger/5 px-3.5 py-2.5 text-[12.5px] text-danger">
          {ERROR_TEXT[params.error]}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Business" description={isOwner ? "Visible on your storefront" : "Owner only"}>
            <form action={updateBusinessDetailsAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="businessName">
                    Business name
                  </label>
                  <input
                    id="businessName"
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    defaultValue={business.name}
                    className="field"
                    disabled={!isOwner}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="businessIndustry">
                    Industry
                  </label>
                  <select
                    id="businessIndustry"
                    name="industry"
                    defaultValue={business.industry}
                    className="field"
                    disabled={!isOwner}
                  >
                    {INDUSTRIES.map((industry) => (
                      <option key={industry.value} value={industry.value}>
                        {industry.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <p className="text-[11px] text-muted">
                  Changing the name keeps your address /b/{business.slug} working.
                </p>
                <button
                  type="submit"
                  className="btn btn-brand text-[12.5px]"
                  disabled={!isOwner}
                >
                  Save business
                </button>
              </div>
            </form>
          </Panel>

          <Panel title="Your account" description="Only you can change these">
            <form action={updateAccountAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="accountName">
                    Your name
                  </label>
                  <input
                    id="accountName"
                    name="fullName"
                    required
                    minLength={2}
                    maxLength={80}
                    defaultValue={user.fullName}
                    className="field"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="accountEmail">
                    Email
                  </label>
                  <input
                    id="accountEmail"
                    name="email"
                    type="email"
                    required
                    maxLength={160}
                    defaultValue={user.email}
                    className="field"
                  />
                </div>
              </div>
              <div className="flex justify-end border-t border-line pt-3">
                <button type="submit" className="btn btn-brand text-[12.5px]">
                  Save account
                </button>
              </div>
            </form>
          </Panel>

          <Panel title="Password" description="At least 8 characters">
            <form action={changePasswordAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="currentPassword">
                    Current password
                  </label>
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="field"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="newPassword">
                    New password
                  </label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="field"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="confirmPassword">
                    Repeat new password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="field"
                  />
                </div>
              </div>
              <div className="flex justify-end border-t border-line pt-3">
                <button type="submit" className="btn btn-primary text-[12.5px]">
                  Change password
                </button>
              </div>
            </form>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="This business">
            <dl className="space-y-2.5 text-[12px]">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted">Storefront</dt>
                <dd className="min-w-0 truncate font-medium">/b/{business.slug}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted">Plan</dt>
                <dd className="font-medium">{plan?.name ?? planId}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted">Your role</dt>
                <dd className="font-medium capitalize">{role}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted">City</dt>
                <dd className="min-w-0 truncate font-medium">{profile?.city || "Not set"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted">Phone</dt>
                <dd className="min-w-0 truncate font-medium">{profile?.phone || "Not set"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted">Created</dt>
                <dd className="font-medium">{formatDateTime(business.created_at)}</dd>
              </div>
            </dl>
            <Link
              href={`/b/${business.slug}`}
              target="_blank"
              className="mt-3 inline-block text-[12px] font-semibold text-brand hover:underline"
            >
              Open storefront →
            </Link>
          </Panel>

          <Panel title="Where things live">
            <ul className="space-y-2 text-[11.5px] leading-relaxed text-muted">
              <li>
                Tagline, description, colours, contact details and social links:{" "}
                <Link href="/dashboard/website" className="font-medium text-brand hover:underline">
                  My website
                </Link>
                .
              </li>
              <li>
                Who can open this dashboard:{" "}
                <Link href="/dashboard/staff" className="font-medium text-brand hover:underline">
                  Staff
                </Link>
                .
              </li>
              <li>
                Plan, limits and usage:{" "}
                <Link href="/dashboard/subscription" className="font-medium text-brand hover:underline">
                  Subscription
                </Link>
                .
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
