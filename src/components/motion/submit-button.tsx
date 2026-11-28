"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that reads as a physical object.
 *
 * Pressing it squashes it (principle 1), and while the server action is in
 * flight it holds a small pull-back instead of sitting still (principle 2).
 * The pull-back also tells a customer the tap landed, and the disabled state
 * stops a slow connection from posting the same item twice.
 *
 * With JavaScript off it is an ordinary submit button; the spring-back simply
 * happens on the next page.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className = "",
  style,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      data-pending={pending ? "true" : "false"}
      className={`motion-press motion-windup ${className}`}
      style={style}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
