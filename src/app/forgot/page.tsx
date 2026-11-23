import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/password-reset";
import { AuthFooterLink, AuthShell, FormError } from "@/components/auth-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Forgot password" };

/**
 * FORGOT PASSWORD.
 *
 * No email service is connected, so this page never promises a link "in your
 * inbox". It asks for the address, and explains who will send the link — the
 * business owner, by WhatsApp — which is the truth on this deployment.
 */

const ERRORS: Record<string, string> = {
  email: "Enter the email address you signed up with.",
  expired: "That reset link has expired and a link works only once. Ask for a new one.",
};

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <AuthShell
      title={sent ? "Request sent" : "Forgot password"}
      subtitle={
        sent
          ? "Nothing is emailed yet on this deployment — here is what happens next."
          : "Tell us the email on the account and your business owner will send you a reset link."
      }
      footer={
        <>
          Remembered it? <AuthFooterLink href="/login">Back to sign in</AuthFooterLink>
        </>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <div className="rounded-[10px] border border-success/20 bg-success/5 px-3.5 py-3 text-[12.5px] leading-relaxed text-success">
            If an account uses that address, a single-use reset link has been created. It works for
            one hour.
          </div>
          <ol className="space-y-2 text-[12.5px] leading-relaxed text-muted">
            <li>
              <span className="font-semibold text-ink">1.</span> Ask the owner of your business to
              open <span className="font-medium text-ink">Dashboard → Staff</span> and press{" "}
              <span className="font-medium text-ink">Create reset link</span>.
            </li>
            <li>
              <span className="font-semibold text-ink">2.</span> They send it to you on WhatsApp —
              the button opens WhatsApp with the link already written.
            </li>
            <li>
              <span className="font-semibold text-ink">3.</span> Open the link, choose a new
              password, and every old session is signed out.
            </li>
          </ol>
          <p className="text-[11.5px] leading-relaxed text-muted">
            Email delivery is not connected on this deployment, which is why a person sends the link
            instead of an inbox doing it. When an email service is added, this step disappears.
          </p>
          <Link href="/login" className="btn btn-primary w-full">
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <FormError message={error ? (ERRORS[error] ?? "Something went wrong. Please try again.") : null} />
          <form action={requestPasswordResetAction} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email on the account
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@business.com"
                className="field"
              />
            </div>
            <button type="submit" className="btn btn-primary w-full">
              Ask for a reset link
            </button>
          </form>
          <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
            Nothing is emailed yet. The owner of your business sees the request and sends you the
            link on WhatsApp.
          </p>
        </>
      )}
    </AuthShell>
  );
}
