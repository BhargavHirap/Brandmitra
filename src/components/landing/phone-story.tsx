"use client";

import { useEffect, useRef, useState } from "react";

/**
 * PHONE STORY — one missed call, told as a thread.
 *
 * The section is tall on purpose: the phone sticks to the middle of the screen
 * while you scroll, and the conversation advances one message at a time —
 * missed call, call-back, a slot, the confirmation, the morning report. Nothing
 * bounces; each bubble fades in as you reach it.
 *
 * With `prefers-reduced-motion: reduce` there is no tall scroll at all: the
 * section collapses to its own height and the whole thread is simply there. A
 * story you have to scroll to finish is not a story for everyone.
 */

type Bubble = {
  from: "system" | "desk" | "customer";
  text: string;
  meta?: string;
};

const THREAD: Bubble[] = [
  {
    from: "system",
    text: "Missed call · +91 98765 43210",
    meta: "1:12 pm · nobody at the counter",
  },
  {
    from: "desk",
    text: "Namaste! Sorry we missed your call. Appointment book karna hai?",
    meta: "1:14 pm · call-back",
  },
  { from: "customer", text: "Kal shaam ko slot milega?", meta: "1:15 pm" },
  {
    from: "desk",
    text: "Kal 5:00 pm free hai. Confirm kar dein?",
    meta: "1:15 pm · Dr. Sharma's clinic",
  },
  {
    from: "system",
    text: "Confirmed · Tomorrow, 5:00 pm",
    meta: "WhatsApp confirmation sent · reminder queued for 4:00 pm",
  },
  {
    from: "system",
    text: "Morning report: 3 calls, 1 missed, 2 booked",
    meta: "Sent to the owner at 9:00 am",
  },
];

function BubbleRow({ bubble, shown }: { bubble: Bubble; shown: boolean }) {
  const isDesk = bubble.from === "desk";
  const isSystem = bubble.from === "system";

  return (
    <li
      className={`flex ${isDesk ? "justify-end" : "justify-start"} transition-[opacity,transform] duration-700 ease-out ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      style={{ transform: shown ? "none" : "translateY(8px)" }}
    >
      <div
        className={`max-w-[86%] rounded-2xl px-3 py-2 ${
          isSystem
            ? "border border-line bg-canvas/80"
            : isDesk
              ? "bg-ink text-white"
              : "border border-line bg-white"
        }`}
      >
        <p className={`text-[11.5px] leading-snug ${isSystem ? "text-ink" : ""}`}>{bubble.text}</p>
        {bubble.meta && (
          <p
            className={`mt-1 text-[9px] leading-snug ${
              isDesk ? "text-white/55" : "text-muted"
            }`}
          >
            {bubble.meta}
          </p>
        )}
      </div>
    </li>
  );
}

export function PhoneStory() {
  const section = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState(1);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const node = section.current;
    if (!node) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) {
        setStep(THREAD.length);
        return;
      }
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      const next = 1 + Math.round(progress * (THREAD.length - 1));
      setStep((current) => (current === next ? current : next));
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reduced]);

  const visible = reduced ? THREAD.length : step;

  return (
    <div
      ref={section}
      className={reduced ? "relative" : "relative h-[230vh] sm:h-[260vh]"}
      aria-label="What happens after a missed call"
    >
      <div
        className={
          reduced
            ? "flex justify-center py-6"
            : "sticky top-0 flex h-[100svh] items-center justify-center pb-6 pt-16"
        }
      >
        {/* On a short phone the whole block shrinks rather than sliding under
            the sticky bar or losing its last line. */}
        <div className="phone-scaled w-full max-w-[320px]">
          <div className="rounded-[38px] border border-line bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_36px_80px_-40px_rgba(16,24,40,0.28)]">
            <div className="rounded-[30px] border border-line/70 bg-canvas/40 p-3">
              {/* Phone header */}
              <div className="flex items-center gap-2 border-b border-line/70 pb-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[9px] font-semibold text-white">
                  DS
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[10.5px] font-medium leading-none">Dr. Sharma&apos;s clinic</p>
                  <p className="mt-0.5 text-[9px] leading-none text-muted">Front desk · Hinglish</p>
                </div>
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              </div>

              <ul className="mt-2.5 flex min-h-[300px] flex-col justify-end gap-2 sm:min-h-[330px]">
                {THREAD.map((bubble, index) => (
                  <BubbleRow key={bubble.text} bubble={bubble} shown={index < visible} />
                ))}
              </ul>

              <div className="mt-2 flex items-center gap-2 border-t border-line/70 pt-2">
                <span className="h-6 flex-1 rounded-full border border-line bg-white px-2 text-[9.5px] leading-6 text-muted">
                  Message
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[9px] text-white">
                  ↑
                </span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-[10.5px] leading-relaxed text-muted">
            {visible >= THREAD.length
              ? "Every booking, call-back and report — from one number."
              : "Keep scrolling — this is what one missed call looks like."}
          </p>
        </div>
      </div>
    </div>
  );
}
