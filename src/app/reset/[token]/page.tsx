import { resetPasswordAction } from "@/app/actions/password-reset";
import { AuthFooterLink, AuthShell, FormError } from "@/components/auth-shell";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a new password" };

/**
 * THE RESET ITSELF.
 *
 * The token is checked here so a dead link says so before anyone types a
 * password, and checked again inside the action — the page is a convenience, the
 * action is the rule.
 */

const ERRORS: Record<string, string> = {
  short: "Use at least 8 characters.",
  mismatch: "The two passwords do not match.",
};

async function tokenState(token: string): Promise<"ok" | "dead"> {
  if (!token) return "dead";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const db = await getDb();
  const row = await db.first<{ expires_at: string; used_at: string | null }>(
    "SELECT expires_at, used_at FROM password_resets WHERE token_hash = ?",
    [hash],
  );
  if (!row || row.used_at) return "dead";
  if (new Date(row.expires_at).getTime() < Date.now()) return "dead";
  return "ok";
}

export default async function ResetPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const state = await tokenState(token);

  if (state === "dead") {
    return (
      <AuthShell
        title="This link has expired"
        subtitle="Reset links work once and last one hour."
        footer={
          <>
            Need a new one? <AuthFooterLink href="/forgot">Ask again</AuthFooterLink>
          </>
        }
      >
        <p className="text-[12.5px] leading-relaxed text-muted">
          Ask the owner of your business to create a fresh link from Dashboard → Staff. Nothing has
          been changed on your account.
        </p>
        <a href="/forgot" className="btn btn-primary mt-4 w-full">
          Request a new link
        </a>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Once you save it, every other device is signed out."
      footer={
        <>
          Changed your mind? <AuthFooterLink href="/login">Back to sign in</AuthFooterLink>
        </>
      }
    >
      <FormError message={error ? (ERRORS[error] ?? "Something went wrong. Please try again.") : null} />
      <form action={resetPasswordAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="label" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="confirmPassword">
            Same password again
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="••••••••"
            className="field"
          />
        </div>
        <button type="submit" className="btn btn-primary w-full">
          Save new password
        </button>
      </form>
    </AuthShell>
  );
}
