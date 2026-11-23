"use client";

import { useState } from "react";

/** Copies a one-time reset link. The link is not stored anywhere in the browser. */
export function CopyLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className="btn btn-ghost px-2.5 py-1 text-[11.5px]"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
