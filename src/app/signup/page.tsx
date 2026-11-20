import { redirect } from "next/navigation";
import { signUpAction } from "@/app/actions/auth";
import { AuthFooterLink, AuthShell, FormError } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Create your account" };

const ERRORS: Record<string, string> = {
  name: "Please enter your full name.",
  email: "That email address does not look valid.",
  password: "Use at least 8 characters for your password.",
  exists: "An account with this email already exists. Try signing in instead.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free forever on the Free plan. No card required."
      footer={
        <>
          Already have an account? <AuthFooterLink href="/login">Sign in</AuthFooterLink>
        </>
      }
    >
      <FormError message={error ? (ERRORS[error] ?? "Something went wrong. Please try again.") : null} />
      <form action={signUpAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            name="fullName"
            required
            autoComplete="name"
            placeholder="Aarav Sharma"
            className="field"
          />
        </div>
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
          <label className="label" htmlFor="password">Password</label>
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
        <button type="submit" className="btn btn-primary w-full">
          Continue
        </button>
      </form>
    </AuthShell>
  );
}
