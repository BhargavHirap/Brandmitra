"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * The kitchen board refreshes itself.
 *
 * `router.refresh()` asks Next.js to re-render the server page and re-fetch its
 * data without a full browser reload, so scroll position and the "paused" state
 * survive. Polling is the boring, free option: no websocket server to run, no
 * extra service to pay for. Ten seconds is far below how long a ticket takes to
 * cook, and the staff can hit "Refresh now" any time.
 */
export function KitchenAutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState("just now");

  const refresh = useCallback(() => {
    router.refresh();
    setUpdatedAt(
      new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    );
  }, [router]);

  useEffect(() => {
    if (!live) return;

    const timer = setInterval(refresh, seconds * 1000);

    // A phone that was locked in a pocket should show today's board the moment
    // it wakes up, not the state from ten minutes ago.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live, refresh, seconds]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
          live
            ? "border-success/25 bg-success/5 text-success"
            : "border-line bg-canvas text-muted"
        }`}
        aria-live="polite"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${live ? "bg-success" : "bg-muted/60"}`}
          aria-hidden
        />
        {live ? `Live · every ${seconds}s` : "Paused"}
      </span>
      <span className="text-[11px] text-muted">Updated {updatedAt}</span>
      <button
        type="button"
        onClick={refresh}
        className="btn btn-ghost min-h-[36px] px-2.5 py-1 text-[11.5px]"
      >
        Refresh now
      </button>
      <button
        type="button"
        onClick={() => setLive((value) => !value)}
        className="btn btn-ghost min-h-[36px] px-2.5 py-1 text-[11.5px]"
      >
        {live ? "Pause" : "Resume"}
      </button>
    </div>
  );
}
