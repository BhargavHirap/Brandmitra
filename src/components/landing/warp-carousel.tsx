"use client";

import { useEffect, useRef, useState } from "react";
import { DashboardScreen, DeskScreen } from "@/components/landing/product-screens";

/**
 * WARP CAROUSEL — the two product screens, one at a time.
 *
 * The outgoing screen shrinks and fades while the incoming one settles, so the
 * change feels like one thing replacing another rather than a slide snapping
 * past. Slow on purpose: seven seconds per screen, and it stops the moment a
 * pointer or a keyboard lands on it.
 *
 * `background` and `glow` exist so the page can guarantee the carousel sits on
 * the same neutral surface as everything else instead of dragging its own
 * colour in — a white card on a warped grey page is the usual way these blocks
 * give themselves away.
 *
 * With `prefers-reduced-motion: reduce` nothing moves by itself: the screens
 * cross-fade only when the visitor asks for the next one.
 */

const SLIDES = [
  {
    id: "dashboard",
    label: "The dashboard",
    line: "Orders, stock and money on one screen.",
    node: <DashboardScreen />,
  },
  {
    id: "front-desk",
    label: "The front desk",
    line: "Every call, slot and call-back, never in your head.",
    node: <DeskScreen />,
  },
];

export function WarpCarousel({
  background = "#f6f7f9",
  glow = "#eaf0ff",
}: {
  background?: string;
  glow?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const region = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [paused, reduced]);

  return (
    <div
      ref={region}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      style={{ background }}
      aria-roledescription="carousel"
      aria-label="Product screens"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-6 mx-auto h-[220px] max-w-2xl rounded-full blur-3xl"
        style={{ background: glow, opacity: 0.75 }}
      />

      {/* Tall enough for the taller of the two screens on a 375px phone — a
          fixed height shorter than the card is what makes captions collide. */}
      <div className="relative mx-auto h-[415px] max-w-4xl px-1 sm:h-[445px]">
        {SLIDES.map((slide, position) => {
          const active = position === index;
          return (
            <div
              key={slide.id}
              aria-hidden={!active}
              className={`absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-[1100ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] ${
                active
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none opacity-0"
              }`}
              style={{
                transform: active ? "scale(1) translateY(0)" : "scale(0.965) translateY(10px)",
              }}
            >
              <div className="w-full max-w-[640px]">{slide.node}</div>
            </div>
          );
        })}
      </div>

      <div className="relative mx-auto mt-1 flex max-w-[640px] items-center justify-between gap-4 px-1">
        <div className="min-w-0">
          <p className="text-[13px] font-medium">{SLIDES[index].label}</p>
          <p className="text-[11.5px] text-muted">{SLIDES[index].line}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {SLIDES.map((slide, position) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setIndex(position)}
              aria-label={`Show ${slide.label}`}
              aria-current={position === index}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                position === index ? "w-6 bg-brand" : "w-1.5 bg-line hover:bg-muted/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
