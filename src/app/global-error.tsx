"use client";

/**
 * Last line of defence: a crash in the root layout itself.
 *
 * This one has to render its own <html> and <body> because the layout that
 * failed is the thing that normally provides them. It is deliberately plain
 * HTML with an inline style — it must not depend on the stylesheet or any
 * component that could be the thing that broke.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          color: "#101828",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "360px", textAlign: "center" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 300, letterSpacing: "-0.03em", margin: 0 }}>
            Vantra could not start.
          </h1>
          <p style={{ fontSize: "13px", lineHeight: 1.6, color: "#667085", marginTop: "12px" }}>
            This is on us, not on you. Reload the page — anything already saved is safe.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "20px",
              width: "100%",
              height: "44px",
              borderRadius: "10px",
              border: "none",
              background: "#101828",
              color: "#ffffff",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          <p style={{ fontSize: "11px", color: "#98a2b3", marginTop: "16px" }}>
            Reference: {error.digest ?? "unknown"}
          </p>
        </div>
      </body>
    </html>
  );
}
