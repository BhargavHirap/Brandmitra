import type { CSSProperties } from "react";

/**
 * Fades and lifts a section as it comes into view.
 *
 * This is a plain server component on purpose. The effect used to need an
 * IntersectionObserver, which meant the section started at `opacity: 0` and
 * stayed invisible until React had hydrated — on a cheap phone that is a blank
 * page for seconds. The animation now comes from CSS (`animation-timeline:
 * view()` in globals.css), so the content is painted with the HTML and the fade
 * runs off the compositor. Nothing here reaches the browser as JavaScript, and
 * `prefers-reduced-motion: reduce` still turns the animation off entirely.
 *
 * `delay` is kept for a staggered pair (the showcase uses it): it shifts where
 * the fade begins along the scroll, so the two blocks still arrive one after the
 * other.
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
  return (
    <div
      className={`reveal ${className}`}
      style={delay ? ({ "--reveal-start": `${Math.round(delay / 20)}%` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
