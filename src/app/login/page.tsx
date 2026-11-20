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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your business workspace."
      footer={
        <>
          New to Brandmitra? <AuthFooterLink href="/signup">Create an account</AuthFooterLink>
        </>
      }
    >
      <FormError message={error ? (ERRORS[error] ?? "Something went wrong. Please try again.") : null} />
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
          <label className="label" htmlFor="password">Password</label>
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
