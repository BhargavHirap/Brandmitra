import Link from "next/link";
import { BrandLink } from "@/components/brand";
import { DishOrbitCarousel } from "@/components/landing/dish-orbit-carousel";
import { Reveal } from "@/components/landing/reveal";
import { LegalLinks } from "@/components/landing/legal-links";
import { FooterLinks, SocialLinks } from "@/components/landing/social-links";
import { WarpCarousel } from "@/components/landing/warp-carousel";

export const metadata = {
  title: "Showcase",
  description: "The dashboard and the front desk, side by side.",
};

/**
 * SHOWCASE — the product's screens.
 *
 * It exists so a page can be sent to a shop owner on WhatsApp without the
 * landing page's signup ask in the way. Same light surface, same motion rules,
 * nothing extra: a line, two showcases, one way back.
 *
 * The best-seller rail is deliberately not here. It belongs to a business's own
 * shop page, where it is built from that business's photographed catalogue.
 */

const NEUTRAL = "#f6f7f9";
const GLOW = "#eaf0ff";

export default function ShowcasePage() {
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

      <main>
        <section className="mx-auto max-w-5xl px-5 pt-16 pb-10 sm:pt-24">
          <Reveal>
            <h1 className="mx-auto max-w-[16ch] text-center text-[32px] font-light leading-[1.08] tracking-[-0.035em] sm:text-[56px]">
              The whole shop, on one page.
            </h1>
            <p className="mx-auto mt-5 max-w-[44ch] text-center text-[13.5px] leading-relaxed text-muted">
              Built for clinics, salons, gyms and shops across India — free to start, no card.
            </p>
          </Reveal>
        </section>

        <section className="mx-auto max-w-5xl px-5 pb-20">
          <Reveal delay={120}>
            <WarpCarousel background={NEUTRAL} glow={GLOW} />
            <p className="mt-5 text-center text-[10.5px] text-muted">
              Example views of the dashboard and the front desk.
            </p>
          </Reveal>
        </section>

        <section className="border-y border-line/70 py-16 sm:py-20" style={{ overflowX: "clip" }}>
          <div className="mx-auto max-w-5xl px-5">
            <Reveal>
              <DishOrbitCarousel />
            </Reveal>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-24 text-center">
          <Reveal>
            <h2 className="text-[26px] font-light tracking-[-0.03em] sm:text-[40px]">
              Ready when you are.
            </h2>
            <Link href="/signup" className="btn btn-primary mt-7 h-11 px-6 text-[13.5px]">
              Start free
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line/70">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Vantra</p>
          <SocialLinks />
          <div className="flex flex-col gap-2 sm:items-end">
            <FooterLinks pageHref="/" pageLabel="Home" />
            <LegalLinks />
          </div>
        </div>
      </footer>
    </div>
  );
}
