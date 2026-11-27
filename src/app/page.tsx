import Link from "next/link";
import { BrandLink } from "@/components/brand";
import { PhoneStory } from "@/components/landing/phone-story";
import { Reveal } from "@/components/landing/reveal";
import { LegalLinks } from "@/components/landing/legal-links";
import { FooterLinks, SocialLinks } from "@/components/landing/social-links";

export const metadata = {
  title: "Vantra — your shop, online, and it never misses a call",
  description:
    "A storefront, an order desk and a front desk for clinics, salons, gyms and shops across India. Free to start, no card.",
};

/**
 * LANDING PAGE — "One number".
 *
 * The page is built around a single missed call instead of a feature grid: a
 * bar, one light-weight promise, the thread that follows that call, one line
 * about who it is for, one last ask, and a small footer. The phone sticks while
 * the conversation advances, so the page has one continuous idea rather than
 * two showcases competing.
 *
 * Surfaces are the neutral canvas the whole app uses; the brand blue appears
 * only as an accent (the send dot, the active marker). The carousels still live
 * at /showcase for anyone who wants the screens side by side.
 */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* With JavaScript off nothing can reveal itself on scroll, so the reveal
          styles stand down rather than leaving the page blank. */}
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

      <main>
        {/* 1 · The promise */}
        <section className="mx-auto max-w-5xl px-5 pt-16 pb-6 sm:pt-24">
          <Reveal>
            <h1 className="mx-auto max-w-[15ch] text-center text-[34px] font-light leading-[1.06] tracking-[-0.035em] sm:text-[64px]">
              The calls you miss are someone else&apos;s customer.
            </h1>
            <div className="mt-8 flex flex-col items-center gap-3">
              <Link href="/signup" className="btn btn-primary h-11 px-6 text-[13.5px]">
                Start free
              </Link>
              <p className="text-[11px] text-muted">Free plan · no card · two minutes</p>
            </div>
          </Reveal>
        </section>

        {/* 2 · One missed call, told as a thread */}
        <section className="mx-auto max-w-5xl px-5">
          <PhoneStory />
        </section>

        {/* 3 · One line about who it is for */}
        <section className="mx-auto max-w-5xl px-5 pt-14 pb-16 sm:pt-16 sm:pb-20">
          <Reveal>
            <p className="mx-auto max-w-[46ch] text-center text-[15px] leading-relaxed text-muted sm:text-[17px]">
              Built for clinics, salons, gyms and shops across India — free to start, no card.
            </p>
          </Reveal>
        </section>

        {/* 4 · The screens themselves, for anyone who wants the detail */}
        <section className="border-y border-line/70 py-10">
          <Reveal>
            <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-5 text-center sm:flex-row sm:justify-between sm:text-left">
              <p className="text-[12.5px] text-muted">
                Want the dashboard and the front desk side by side?
              </p>
              <Link href="/showcase" className="text-[12.5px] font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
                Open the showcase
              </Link>
            </div>
          </Reveal>
        </section>

        {/* 5 · The last ask */}
        <section className="mx-auto max-w-5xl px-5 py-24 text-center sm:py-32">
          <Reveal>
            <h2 className="mx-auto max-w-[14ch] text-[30px] font-light leading-[1.08] tracking-[-0.035em] sm:text-[52px]">
              Two minutes. No card.
            </h2>
            <Link href="/signup" className="btn btn-primary mt-8 h-11 px-6 text-[13.5px]">
              Get started
            </Link>
          </Reveal>
        </section>
      </main>

      {/* 6 · Footer */}
      <footer className="border-t border-line/70">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Vantra</p>
          <SocialLinks />
          <div className="flex flex-col gap-2 sm:items-end">
            <FooterLinks pageHref="/showcase" pageLabel="Showcase" />
            <LegalLinks />
          </div>
        </div>
      </footer>
    </div>
  );
}
