import Link from "next/link";
import { BrandLink } from "@/components/brand";
import { LegalLinks } from "@/components/landing/legal-links";
import { Reveal } from "@/components/landing/reveal";
import { SocialLinks } from "@/components/landing/social-links";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pricing",
  description:
    "Vantra is free to start. A storefront, an order desk and a front desk at no cost, with paid plans for more AI credits.",
};

type PlanRow = {
  id: string;
  name: string;
  price_inr: number;
  currency: string;
  interval: string;
  ai_credits: number;
  features: string;
  sort_order: number;
};

function parseFeatures(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

/**
 * PRICING — what the product costs, in public.
 *
 * The numbers come from the same `plans` table the app bills against, so the
 * page cannot advertise a price the product does not charge. There is no
 * checkout here: every card starts the free account, and an upgrade happens
 * inside the dashboard once payments are switched on.
 */
export default async function PricingPage() {
  const db = await getDb();
  const plans = await db.all<PlanRow>(
    `SELECT id, name, price_inr, currency, interval, ai_credits, features, sort_order
       FROM plans WHERE is_active = 1 ORDER BY sort_order ASC`,
  );

  return (
    <div className="min-h-screen bg-canvas">
      <noscript>
        <style>{`.reveal{opacity:1 !important;transform:none !important}`}</style>
      </noscript>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <BrandLink />
          <Link href="/signup" className="btn btn-primary h-9 px-4 text-[12.5px]">
            Start free
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pt-16 pb-24 sm:pt-24">
        <Reveal>
          <h1 className="mx-auto max-w-[18ch] text-center text-[32px] font-light leading-[1.08] tracking-[-0.035em] sm:text-[56px]">
            Simple pricing.
          </h1>
          <p className="mx-auto mt-5 max-w-[46ch] text-center text-[13.5px] leading-relaxed text-muted">
            Start on Free and stay there as long as you like. Every plan includes the
            storefront, the order desk and unlimited products and team seats.
          </p>
        </Reveal>

        {plans.length === 0 ? (
          <p className="mt-16 text-center text-[13px] text-muted">
            Plans are being updated. <Link href="/signup" className="underline">Start free</Link>{" "}
            in the meantime.
          </p>
        ) : (
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan, index) => {
              const free = Number(plan.price_inr) === 0;
              return (
                <Reveal key={plan.id} delay={index * 60}>
                  <div
                    className={`flex h-full flex-col rounded-2xl border p-5 ${
                      free ? "border-brand/40 bg-brand-soft/30" : "border-line bg-canvas"
                    }`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                      {plan.name}
                    </p>
                    <p className="mt-3 text-[30px] font-semibold leading-none tracking-[-0.03em]">
                      {free ? "Free" : formatMoney(Number(plan.price_inr), plan.currency)}
                      {!free && (
                        <span className="ml-1 text-[11.5px] font-normal text-muted">
                          / {plan.interval}
                        </span>
                      )}
                    </p>
                    <p className="mt-2 text-[11.5px] text-muted">
                      {Number(plan.ai_credits).toLocaleString("en-IN")} AI credits a month
                    </p>
                    <ul className="mt-5 flex-1 space-y-2">
                      {parseFeatures(plan.features).map((feature) => (
                        <li key={feature} className="flex gap-2 text-[12.5px] leading-relaxed">
                          <span aria-hidden="true" className="text-brand">
                            ✓
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/signup"
                      className={`mt-6 inline-flex h-10 items-center justify-center rounded-full text-[12.5px] font-medium ${
                        free
                          ? "bg-brand text-white hover:bg-brand-600"
                          : "border border-line hover:border-ink"
                      }`}
                    >
                      {free ? "Start free" : "Start on Free"}
                    </Link>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}

        <Reveal>
          <p className="mx-auto mt-10 max-w-[52ch] text-center text-[11.5px] leading-relaxed text-muted">
            Paid plans can be selected inside the dashboard once online payments are
            switched on. Nothing is charged without a payment you have approved, and
            there is no card kept on file.
          </p>
        </Reveal>
      </main>

      <footer className="border-t border-line/70">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Vantra</p>
          <SocialLinks />
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}
