"use client";

import { useActionState, useEffect, useState } from "react";
import {
  generateProductCopyAction,
  saveProductDescriptionAction,
  type AiCopyState,
} from "@/app/actions/ai";

/**
 * "Write with AI" panel on the product page.
 *
 * The AI call is a server action; the draft comes back as text, lands in an
 * editable box, and nothing touches the database until the owner presses
 * "Use as description". A caption is copy-only — there is nowhere to pretend it
 * was published.
 */

export function AiCopyPanel({
  productId,
  configured,
  credits,
}: {
  productId: string;
  configured: boolean;
  credits: { used: number; limit: number; planName: string; monthLabel: string };
}) {
  const [state, formAction, pending] = useActionState<AiCopyState, FormData>(
    generateProductCopyAction,
    {
      status: "idle",
      kind: "description",
      text: "",
      message: "",
      removedPriceClaims: false,
      credits,
    },
  );

  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state.status === "ok") {
      setDraft(state.text);
      setCopied(false);
    }
  }, [state]);

  const remaining = Math.max(0, state.credits.limit - state.credits.used);
  const exhausted = state.credits.limit <= 0 || remaining === 0;
  const disabled = pending || !configured || exhausted;

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card border-brand/20 bg-gradient-to-b from-brand-soft/40 to-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
            Write with AI
          </p>
          <h2 className="mt-1 text-[14px] font-semibold tracking-[-0.01em]">
            A description or an Instagram caption in one tap
          </h2>
          <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-muted">
            Built from this product&apos;s name, category and options. It never sees your prices and
            never writes to the catalogue — you edit the draft and choose to save it.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium text-muted">
          {remaining} of {state.credits.limit} credits left
        </span>
      </div>

      {!configured && (
        <div className="mt-3 rounded-xl border border-warning/25 bg-warning/5 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink">
          <p className="font-semibold">AI is not connected on this deployment.</p>
          <p className="mt-1 text-muted">
            Create a free key at <span className="text-ink">aistudio.google.com/apikey</span>, then
            add <code className="rounded bg-white px-1 py-px text-[10.5px]">GEMINI_API_KEY</code> to{" "}
            <code className="rounded bg-white px-1 py-px text-[10.5px]">.env.local</code> and
            restart. The key stays on the server; the browser never receives it.
          </p>
        </div>
      )}

      {configured && exhausted && (
        <p className="mt-3 rounded-xl border border-line bg-white px-3 py-2 text-[11.5px] text-muted">
          {state.credits.limit <= 0
            ? `AI copy is not part of the ${state.credits.planName} plan.`
            : `All ${state.credits.limit} credits for ${state.credits.monthLabel} are used. They reset on the 1st of next month.`}
        </p>
      )}

      <form action={formAction} className="mt-3 flex flex-wrap gap-2">
        <input type="hidden" name="productId" value={productId} />
        <button
          type="submit"
          name="kind"
          value="description"
          disabled={disabled}
          className="btn btn-brand min-h-[40px] text-[12.5px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending && state.kind === "description" ? "Writing…" : "Draft a description"}
        </button>
        <button
          type="submit"
          name="kind"
          value="caption"
          disabled={disabled}
          className="btn btn-ghost min-h-[40px] text-[12.5px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending && state.kind === "caption" ? "Writing…" : "Draft an Instagram caption"}
        </button>
      </form>

      {state.status === "error" && state.message && (
        <p className="mt-3 rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-[11.5px] leading-relaxed text-danger">
          {state.message}
        </p>
      )}

      {state.status === "ok" && (
        <div className="mt-3 space-y-2">
          <label className="label" htmlFor="aiDraft">
            {state.kind === "description" ? "Description draft" : "Instagram caption draft"}
          </label>
          <textarea
            id="aiDraft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={state.kind === "caption" ? 4 : 3}
            maxLength={600}
            className="field resize-y bg-white"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyDraft}
              className="btn btn-ghost min-h-[36px] text-[12px]"
            >
              {copied ? "Copied" : "Copy text"}
            </button>
            {state.kind === "description" && (
              <form action={saveProductDescriptionAction}>
                <input type="hidden" name="id" value={productId} />
                <input type="hidden" name="description" value={draft} />
                <button
                  type="submit"
                  disabled={draft.trim().length < 10}
                  className="btn btn-primary min-h-[36px] text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use as description
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => setDraft("")}
              className="text-[11.5px] text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Discard draft
            </button>
          </div>
          {state.removedPriceClaims && (
            <p className="text-[11px] leading-relaxed text-warning">
              A sentence that mentioned pricing was removed. Copy can describe the product, but the
              price on your storefront always comes from your own price field.
            </p>
          )}
          <p className="text-[10.5px] leading-relaxed text-muted">
            {state.credits.used} of {state.credits.limit} credits used in {state.credits.monthLabel}{" "}
            on the {state.credits.planName} plan. Each draft is one credit.
          </p>
        </div>
      )}
    </section>
  );
}
