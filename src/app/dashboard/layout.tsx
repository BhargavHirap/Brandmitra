import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { BrandLink, LogoMark } from "@/components/brand";
import { DashboardNav } from "@/components/dashboard-nav";
import { requireBusiness } from "@/lib/business";
import { initials } from "@/lib/format";
import { industryLabel } from "@/lib/industries";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, business, planId } = await requireBusiness();

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex max-w-[1440px]">
        <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-line bg-white px-3 py-5 lg:flex">
          <div className="px-1.5">
            <BrandLink href="/dashboard" />
          </div>
          <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-line bg-canvas/60 px-2.5 py-2">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold text-white"
              style={{ backgroundColor: "#0b0b0f" }}
            >
              {initials(business.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-semibold leading-tight">{business.name}</p>
              <p className="truncate text-[10.5px] text-muted">
                {industryLabel(business.industry)}
              </p>
            </div>
          </div>
          <div className="mt-5 flex-1 overflow-y-auto">
            <DashboardNav planId={planId} industry={business.industry} variant="desktop" />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
            <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex items-center gap-3 lg:hidden">
                <Link href="/dashboard" aria-label="Dashboard home">
                  <LogoMark />
                </Link>
                <span className="truncate text-[13px] font-semibold">{business.name}</span>
              </div>

              <div className="hidden items-center gap-2 lg:flex">
                <Link
                  href={`/b/${business.slug}`}
                  target="_blank"
                  className="btn btn-ghost px-3 py-1.5 text-[12px]"
                >
                  View storefront
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                    <path d="M3.5 8.5 8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </Link>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="hidden rounded-full border border-line px-2.5 py-1 text-[10.5px] font-medium capitalize text-muted sm:block">
                  {planId} plan
                </span>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-[11px] font-semibold">
                    {initials(user.fullName || user.email)}
                  </span>
                  <div className="hidden leading-tight sm:block">
                    <p className="text-[12px] font-medium">{user.fullName || "Owner"}</p>
                    <p className="text-[10.5px] text-muted">Owner</p>
                  </div>
                </div>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="rounded-lg px-2 py-1.5 text-[12px] text-muted transition-colors hover:bg-canvas hover:text-ink"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </header>

          <div className="px-4 pb-20 pt-4 sm:px-6 sm:pt-5">
            <DashboardNav planId={planId} industry={business.industry} variant="mobile" />
            <div className="mt-4 sm:mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
