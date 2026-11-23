import Link from "next/link";
import { BrandLink } from "@/components/brand";
import { DishOrbitCarousel } from "@/components/landing/dish-orbit-carousel";
import { Reveal } from "@/components/landing/reveal";
import { WarpCarousel } from "@/components/landing/warp-carousel";

export const metadata = {
  title: "Vantra — your shop, online, and it never misses a call",
  description:
    "A storefront, an order desk and a front desk for clinics, salons, gyms and shops across India. Free to start, no card.",
};

/**
 * LANDING PAGE.
 *
 * Six things and nothing else: a bar, a promise, one line about who it is for,
 * two showcases, one last ask, and a footer. The surfaces are the neutral canvas
 * the whole app uses; the brand blue appears only as a dot, an accent and the
 * active carousel marker. Copy is the owner's own wording, not invented claims.
 *
 * The carousel is given the same neutral background and a brand-soft glow, so it
 * cannot sit on the page as a white block with its own colour scheme.
 */

const NEUTRAL = "#f6f7f9";
const GLOW = "#eaf0ff";

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
        <section className="mx-auto max-w-5xl px-5 pt-16 pb-8 sm:pt-24">
          <Reveal>
            <h1 className="mx-auto max-w-[15ch] text-center text-[34px] font-light leading-[1.06] tracking-[-0.035em] sm:text-[64px]">
              Your shop, online — and it never misses a call.
            </h1>
            <div className="mt-8 flex flex-col items-center gap-3">
              <Link href="/signup" className="btn btn-primary h-11 px-6 text-[13.5px]">
                Start free
              </Link>
              <p className="text-[11px] text-muted">Free plan · no card · two minutes</p>
            </div>
          </Reveal>
        </section>

        {/* 2 · The two screens */}
        <section className="mx-auto max-w-5xl px-5 pb-16 sm:pb-20">
          <Reveal delay={120}>
            <WarpCarousel background={NEUTRAL} glow={GLOW} />
            <p className="mt-5 text-center text-[10.5px] text-muted">
              Example views of the dashboard and the front desk.
            </p>
          </Reveal>
        </section>

        {/* 3 · One line about who it is for */}
        <section className="mx-auto max-w-5xl px-5 pb-16 sm:pb-20">
          <Reveal>
            <p className="mx-auto max-w-[46ch] text-center text-[15px] leading-relaxed text-muted sm:text-[17px]">
              Built for clinics, salons, gyms and shops across India — free to start, no card.
            </p>
          </Reveal>
        </section>

        {/* 4 · What orbits one business */}
        <section className="border-y border-line/70 py-16 sm:py-20" style={{ overflowX: "clip" }}>
          <div className="mx-auto max-w-5xl px-5">
            <Reveal>
              <DishOrbitCarousel />
            </Reveal>
          </div>
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
          <nav className="flex items-center gap-5">
            <Link href="/showcase" className="hover:text-ink">
              Showcase
            </Link>
            <a
              href="https://github.com/BhargavHirap/Brandmitra"
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink"
            >
              GitHub
            </a>
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
