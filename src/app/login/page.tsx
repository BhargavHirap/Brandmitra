import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAction } from "@/app/actions/auth";
import { AuthFooterLink, AuthShell, FormError } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  credentials: "That email and password combination does not match an account.",
  missing: "Enter your email and password to continue.",
};

const NOTICES: Record<string, string> = {
  reset: "Password changed, and every other device is signed out. Sign in with the new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { error, reset } = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your business workspace."
      footer={
        <>
          New to Vantra? <AuthFooterLink href="/signup">Create an account</AuthFooterLink>
        </>
      }
    >
      <FormError message={error ? (ERRORS[error] ?? "Something went wrong. Please try again.") : null} />
      {reset && NOTICES.reset && (
        <div className="mb-4 rounded-[10px] border border-success/20 bg-success/5 px-3 py-2 text-[12.5px] text-success">
          {NOTICES.reset}
        </div>
      )}
      <form action={signInAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Work email</label>
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
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label className="label" htmlFor="password">Password</label>
            <Link href="/forgot" className="mb-1.5 text-[11.5px] text-muted hover:text-ink">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="field"
          />
        </div>
        <button type="submit" className="btn btn-primary w-full">
          Sign in
        </button>
      </form>
    </AuthShell>
  );
}
