import Link from "next/link";
import { BrandLink } from "@/components/brand";
import { getDb } from "@/lib/db";
import { INDUSTRY_GROUPS } from "@/lib/industries";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

type PlanCard = {
  id: string;
  name: string;
  price_inr: number;
  product_limit: number;
  ai_credits: number;
  features: string;
};

const PILLARS = [
  {
    number: "01",
    title: "A storefront, generated",
    body: "Answer five questions at signup and Vantra builds a responsive business website with your brand colours, catalogue and contact details.",
  },
  {
    number: "02",
    title: "One order desk",
    body: "Orders and bookings from your link land in one queue — accept, prepare, hand over. The fulfilment board updates as the status changes.",
  },
  {
    number: "03",
    title: "AI that uses your data",
    body: "The business agent answers from your real orders and products, never invented numbers, and asks before it changes anything.",
  },
  {
    number: "04",
    title: "Built for every local business",
    body: "Restaurants, sweet shops, salons, boutiques, repair services, coaching classes and wholesalers run on the same modules. Categories, customisation and workflows are data, not hardcoded screens.",
  },
  {
    number: "05",
    title: "Tenant isolation by default",
    body: "Every business record is keyed to one business id, and that id comes from the database — never from the URL a visitor can edit.",
  },
  {
    number: "06",
    title: "Costs that start at zero",
    body: "Free tiers end to end: serverless hosting, a SQLite-compatible database, and an AI provider you can swap at any time.",
  },
];

export default async function LandingPage() {
  const db = await getDb();
  const plans = await db.all<PlanCard>(
    "SELECT id, name, price_inr, product_limit, ai_credits, features FROM plans WHERE is_active = 1 ORDER BY sort_order ASC",
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <BrandLink />
          <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
            <a className="transition-colors hover:text-ink" href="#product">Product</a>
            <a className="transition-colors hover:text-ink" href="#industries">Who it&apos;s for</a>
            <a className="transition-colors hover:text-ink" href="#pricing">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-[10px] px-3 py-2 text-sm font-medium text-ink hover:bg-canvas sm:block">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary">
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,#eef3ff_0%,rgba(255,255,255,0)_70%)]" />
          <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-14 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                Phase 1 live · multi-tenant foundation
              </span>
              <h1 className="mt-6 text-[38px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[62px]">
                The AI operating system
                <br className="hidden sm:block" /> for modern businesses
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">
                Register your business and Vantra generates a branded storefront,
                an order desk, a customer book and an AI assistant that works from your
                real data. One platform, every channel.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/signup" className="btn btn-brand w-full sm:w-auto">
                  Create your business
                </Link>
                <a href="#industries" className="btn btn-ghost w-full sm:w-auto">
                  See who it&apos;s for
                </a>
              </div>
              <p className="mt-4 text-xs text-muted">
                No card required · Free plan forever · Setup takes about two minutes
              </p>
            </div>

            {/* Interface preview */}
            <div className="mx-auto mt-14 max-w-5xl">
              <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_60px_-24px_rgba(16,24,40,0.18)]">
                <div className="flex items-center gap-1.5 border-b border-line bg-canvas/70 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#e5e7eb]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#e5e7eb]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#e5e7eb]" />
                  <span className="ml-3 truncate rounded-md border border-line bg-white px-2 py-0.5 text-[11px] text-muted">
                    vantra.com/dashboard
                  </span>
                </div>
                <div className="grid gap-0 sm:grid-cols-[190px_1fr]">
                  <aside className="hidden flex-col gap-1 border-r border-line p-3 sm:flex">
                    {["Overview", "My website", "Catalogue", "Orders", "Board", "AI agent"].map((item, index) => (
                      <div
                        key={item}
                        className={`rounded-lg px-2.5 py-1.5 text-[12px] ${
                          index === 0 ? "bg-canvas font-semibold text-ink" : "text-muted"
                        }`}
                      >
                        {item}
                      </div>
                    ))}
                  </aside>
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted">Illustrative view</p>
                        <p className="mt-0.5 text-sm font-semibold">Today at a glance</p>
                      </div>
                      <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-muted">live</span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {["Revenue", "Orders", "Avg. basket", "Repeat rate"].map((label, index) => (
                        <div key={label} className="rounded-xl border border-line p-3">
                          <p className="text-[10px] text-muted">{label}</p>
                          <p className="mt-1 h-3 w-12 rounded bg-canvas" />
                          <div className="mt-3 flex h-8 items-end gap-1">
                            {[40, 62, 48, 78, 56, 90, 70].map((height, barIndex) => (
                              <span
                                key={barIndex}
                                className={index === 0 ? "w-full rounded-sm bg-brand/25" : "w-full rounded-sm bg-canvas"}
                                style={{ height: `${index === 0 ? height : 30}%` }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                      {["Order desk", "Fulfilment board", "AI agent"].map((label) => (
                        <div key={label} className="rounded-xl border border-line p-3">
                          <p className="text-[11px] font-medium">{label}</p>
                          <div className="mt-2 space-y-1.5">
                            <div className="h-2 w-3/4 rounded bg-canvas" />
                            <div className="h-2 w-1/2 rounded bg-canvas" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Who it is for */}
        <section id="industries" className="border-y border-line bg-canvas/60">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
                Who it&apos;s for
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
                Not just restaurants. Every kind of local business.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted">
                Pick your business type at signup and your catalogue starts with the categories you
                actually sell — services, packages, bulk cartons or sweets. Same dashboard, different
                vocabulary.
              </p>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {INDUSTRY_GROUPS.map((group) => (
                <div key={group.value} className="rounded-2xl border border-line bg-white p-5">
                  <p className="text-[14px] font-semibold leading-snug">{group.label}</p>
                  <p className="mt-1.5 text-[11.5px] text-muted">{group.examples.join(" · ")}</p>
                  <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{group.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {group.industries.slice(0, 4).map((industry) => (
                      <span
                        key={industry.value}
                        className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-muted"
                      >
                        {industry.label}
                      </span>
                    ))}
                    {group.industries.length > 4 && (
                      <span className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-muted">
                        +{group.industries.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-6 text-[12px] text-muted">
              There are {INDUSTRY_GROUPS.reduce((total, group) => total + group.industries.length, 0)}{" "}
              types to choose from at signup. Your type only sets the starting categories — every
              module works the same way, and you can change it later in Settings.
            </p>
          </div>
        </section>

        {/* Pillars */}
        <section id="product" className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Platform</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              Everything a small business runs on, in one place.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Each module ships as a real, database-backed feature — not a mockup. Phase 1
              delivers accounts, tenant isolation, onboarding and the dashboard shell that
              every later module plugs into.
            </p>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((pillar) => (
              <div key={pillar.number} className="bg-white p-6">
                <span className="text-[11px] font-semibold tracking-[0.1em] text-muted">{pillar.number}</span>
                <h3 className="mt-3 text-[15px] font-semibold">{pillar.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{pillar.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-line bg-canvas/50">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Pricing</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
                  Start free. Upgrade when you sell.
                </h2>
              </div>
              <p className="max-w-xs text-[13px] leading-relaxed text-muted">
                Prices live in the database and are editable from the admin dashboard — never
                hardcoded in the app.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {plans.map((plan) => {
                let features: string[] = [];
                try {
                  features = JSON.parse(plan.features) as string[];
                } catch {
                  features = [];
                }
                const highlight = plan.id === "growth";
                return (
                  <div
                    key={plan.id}
                    className={`flex flex-col rounded-2xl border p-5 ${
                      highlight ? "border-ink bg-ink text-white" : "border-line bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{plan.name}</p>
                      {highlight && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/80">
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-2xl font-semibold tracking-[-0.02em]">
                      {plan.price_inr === 0 ? "Free" : formatMoney(plan.price_inr)}
                      {plan.price_inr > 0 && (
                        <span className={`ml-1 text-xs font-normal ${highlight ? "text-white/60" : "text-muted"}`}>
                          /month
                        </span>
                      )}
                    </p>
                    <ul className={`mt-4 space-y-2 text-[12.5px] ${highlight ? "text-white/75" : "text-muted"}`}>
                      {features.map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <span className={highlight ? "text-brand" : "text-brand"}>·</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/signup"
                      className={`btn mt-5 w-full ${highlight ? "bg-white text-ink hover:bg-white/90" : "btn-ghost"}`}
                    >
                      {plan.price_inr === 0 ? "Start free" : `Choose ${plan.name}`}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="overflow-hidden rounded-2xl bg-ink px-6 py-14 text-center text-white sm:px-12">
            <h2 className="mx-auto max-w-xl text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              Your business deserves better than a spreadsheet and a chat group.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[14px] leading-relaxed text-white/60">
              Create an account, describe your business, and your storefront is ready in
              under two minutes.
            </p>
            <Link href="/signup" className="btn mt-8 bg-white text-ink hover:bg-white/90">
              Create your business
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-[12px] text-muted sm:flex-row">
          <div className="flex items-center gap-2">
            <BrandLink />
          </div>
          <p>© {new Date().getFullYear()} Vantra. Built for the world.</p>
        </div>
      </footer>
    </div>
  );
}
