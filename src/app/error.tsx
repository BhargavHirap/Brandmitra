"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-level crash screen.
 *
 * Without this file a thrown server component or a failed data read shows the
 * framework's bare "Application error" page with no way back. This keeps the
 * person inside the app: one sentence, a retry that re-renders the segment, and
 * a link home. Nothing about the error is shown, because a stack trace can leak
 * table names and query text.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only part safe to keep: it matches the server log line
    // without carrying any of the message or the data that caused it.
    console.error("route error", error.digest ?? "no-digest");
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-5 py-16">
      <div className="w-full max-w-[360px] text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Something broke</p>
        <h1 className="mt-3 text-[26px] font-light leading-tight tracking-[-0.03em]">
          That screen did not load.
        </h1>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          Nothing you saved has been lost. Try it once more — if it keeps failing, the same
          information is on the page you came from.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" onClick={reset} className="btn btn-primary h-11 w-full text-[13px]">
            Try again
          </button>
          <Link href="/" className="btn btn-ghost h-11 w-full text-[13px]">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
