"use client";

import { useEffect, useState, type CSSProperties } from "react";

/**
 * DISH ORBIT CAROUSEL — the modules that orbit one business.
 *
 * A slow ring of the real parts of the product around the wordmark: orders,
 * front desk, WhatsApp, customers, catalogue, reports. It turns once every 72
 * seconds, which reads as drift rather than animation, and it stops for a
 * pointer or a keyboard.
 *
 * Layout notes that matter:
 *   - the section is `overflow-x: clip`, so the ring can never widen the page;
 *   - below `sm` the orbit becomes a quiet list, because a 175px radius on a
 *     375px screen would render six unreadable chips;
 *   - with reduced motion the ring is simply a static ring.
 */

const NODES = [
  { id: "orders", label: "Orders", note: "One queue" },
  { id: "desk", label: "Front desk", note: "Calls & slots" },
  { id: "whatsapp", label: "WhatsApp", note: "Ready to send" },
  { id: "customers", label: "Customers", note: "Your book" },
  { id: "catalogue", label: "Catalogue", note: "Products" },
  { id: "reports", label: "Reports", note: "The morning one" },
];

function Chip({ label, note }: { label: string; note: string }) {
  return (
    <div className="rounded-full border border-line bg-white px-3 py-1.5 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <p className="text-[11.5px] font-medium leading-none">{label}</p>
      <p className="mt-1 text-[9.5px] leading-none text-muted">{note}</p>
    </div>
  );
}

export function DishOrbitCarousel() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="w-full" style={{ overflowX: "clip" }}>
      {/* Desktop / tablet: the ring */}
      <div className="relative mx-auto hidden h-[440px] w-full max-w-3xl sm:block">
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`relative h-[380px] w-[380px] ${reduced ? "" : "orbit-ring"}`}
            aria-hidden="false"
          >
            {NODES.map((node, position) => {
              const angle = (360 / NODES.length) * position;
              return (
                /*
                 * One transform, one angle: push the chip out along its own
                 * direction, then rotate it back by the same amount so the words
                 * stay upright. `--orbit-spin` comes from the ring and is the
                 * only thing animating.
                 */
                <div
                  key={node.id}
                  className="orbit-chip absolute left-1/2 top-1/2"
                  style={
                    {
                      "--orbit-base": `${angle}deg`,
                      translate: "-50% -50%",
                      transform: reduced
                        ? `rotate(${angle}deg) translateY(-175px) rotate(${-angle}deg)`
                        : "rotate(calc(var(--orbit-spin) + var(--orbit-base))) translateY(-175px) rotate(calc(-1 * (var(--orbit-spin) + var(--orbit-base))))",
                    } as CSSProperties
                  }
                >
                  <Chip label={node.label} note={node.note} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">One business</p>
            <p className="mt-2 text-[34px] font-light leading-none tracking-[-0.04em]">Vantra</p>
            <p className="mt-3 text-[11.5px] text-muted">Six parts, one place.</p>
          </div>
        </div>
      </div>

      {/* Phone: the same six, as a quiet list */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between border-b border-line pb-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">One business</p>
          <p className="text-[13px] font-light tracking-[-0.02em]">Vantra</p>
        </div>
        <ul className="mt-1">
          {NODES.map((node) => (
            <li
              key={node.id}
              className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2.5"
            >
              <span className="text-[12px]">{node.label}</span>
              <span className="text-[10px] text-muted">{node.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
