import Link from "next/link";
import { BrandLink } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account suspended" };

export default async function SuspendedPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-5">
          <BrandLink />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-5 py-20 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-danger">
          Account suspended
        </p>
        <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.02em]">
          This business is paused
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          Access to this dashboard has been suspended by the platform team. Your data is safe and
          nothing has been deleted. Contact support to restore access.
        </p>
        {user && (
          <p className="mt-4 text-[12px] text-muted">
            Signed in as <span className="font-medium text-ink">{user.email}</span>
          </p>
        )}
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <a href="mailto:support@brandmitra.com" className="btn btn-primary">
            Contact support
          </a>
          <Link href="/" className="btn btn-ghost">
            Back to homepage
          </Link>
        </div>
      </main>
    </div>
  );
}
