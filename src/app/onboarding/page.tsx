import Link from "next/link";
import { redirect } from "next/navigation";
import { createBusinessAction } from "@/app/actions/business";
import { BrandLink } from "@/components/brand";
import { requireUser } from "@/lib/auth";
import { INDUSTRIES, getMembership } from "@/lib/business";

export const dynamic = "force-dynamic";

export const metadata = { title: "Create your business" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const existing = await getMembership(user.id);
  if (existing) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <BrandLink />
          <div className="flex items-center gap-3 text-[12px] text-muted">
            <span className="hidden sm:block">{user.email}</span>
            <Link href="/" className="hover:text-ink">Exit</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] text-white">1</span>
          Step 1 of 2 · Business details
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.02em]">Tell us about your business</h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted">
          These details generate your storefront address and seed your dashboard. You can edit
          every field later — nothing here is permanent.
        </p>

        {error === "name" && (
          <div className="mt-6 rounded-[10px] border border-danger/20 bg-danger/5 px-3 py-2 text-[12.5px] text-danger">
            Please enter your business name (at least 2 characters).
          </div>
        )}

        <form action={createBusinessAction} className="mt-8 space-y-5">
          <div className="card p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="name">Business name</label>
                <input
                  id="name"
                  name="name"
                  required
                  placeholder="Cafe Alpha"
                  className="field"
                  autoFocus
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label" htmlFor="slug">Storefront address</label>
                <div className="flex items-center rounded-[10px] border border-line bg-white px-3 focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/10">
                  <span className="shrink-0 text-[13px] text-muted">brandmitra.com/b/</span>
                  <input
                    id="slug"
                    name="slug"
                    placeholder="cafe-alpha"
                    className="w-full border-0 bg-transparent py-2.5 text-[13.5px] outline-none"
                    pattern="[a-zA-Z0-9-]+"
                    title="Letters, numbers and dashes only"
                  />
                </div>
                <p className="mt-1.5 text-[11.5px] text-muted">
                  Leave blank to generate one from your business name.
                </p>
              </div>

              <div>
                <label className="label" htmlFor="industry">Industry</label>
                <select id="industry" name="industry" className="field" defaultValue="restaurant">
                  {INDUSTRIES.map((industry) => (
                    <option key={industry.value} value={industry.value}>
                      {industry.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="city">City</label>
                <input id="city" name="city" placeholder="Pune" className="field" />
              </div>

              <div className="sm:col-span-2">
                <label className="label" htmlFor="tagline">One-line description</label>
                <input
                  id="tagline"
                  name="tagline"
                  placeholder="Slow-roasted coffee and fresh bakes, every morning."
                  className="field"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11.5px] text-muted">
              Your business data is stored separately from every other account.
            </p>
            <button type="submit" className="btn btn-primary">
              Create business &amp; open dashboard
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
