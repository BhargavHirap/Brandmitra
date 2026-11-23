"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fades and lifts a section once, the first time it comes into view.
 *
 * Two rules it never breaks: nothing re-animates on scroll back up, and with
 * `prefers-reduced-motion: reduce` the content is simply there — the CSS in
 * globals.css does that part, so a broken observer can never hide a section.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${shown ? "is-in" : ""} ${className}`}
      style={delay && shown ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
