"use client";

import { useActionState, useEffect, useState } from "react";
import { draftDeskScriptAction, type DeskScriptState } from "@/app/actions/reception";
import { MESSAGE_LANGUAGES } from "@/lib/reception";

/**
 * "Write the phone script" — optional.
 *
 * The front desk works without this: every message has a built-in template. This
 * panel spends one AI credit to rewrite the greeting and the two customer
 * messages in the owner's own words. It returns text and saves nothing.
 */
export function DeskScript({
  configured,
  credits,
  defaultLanguage,
}: {
  configured: boolean;
  credits: { used: number; limit: number; planName: string; monthLabel: string };
  defaultLanguage: string;
}) {
  const [state, formAction, pending] = useActionState<DeskScriptState, FormData>(
    draftDeskScriptAction,
    {
      status: "idle",
      language: "hinglish",
      text: "",
      message: "",
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

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-semibold tracking-[-0.01em]">Phone script, in your words</h2>
          <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-muted">
            One credit rewrites the greeting, the confirmation and the call-back for your business.
            Nothing is saved or sent — you copy what you like.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-medium text-muted">
          {remaining} of {state.credits.limit} credits left
        </span>
      </div>

      {!configured && (
        <p className="mt-3 rounded-xl border border-warning/25 bg-warning/5 px-3 py-2 text-[11.5px] leading-relaxed text-muted">
          AI is not connected on this deployment. The built-in templates below still work, and they
          never use a credit.
        </p>
      )}
      {configured && exhausted && (
        <p className="mt-3 rounded-xl border border-line bg-canvas px-3 py-2 text-[11.5px] text-muted">
          {state.credits.limit <= 0
            ? `AI drafts are not part of the ${state.credits.planName} plan.`
            : `All ${state.credits.limit} credits for ${state.credits.monthLabel} are used. They reset on the 1st.`}
        </p>
      )}

      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[150px]">
          <label className="label" htmlFor="scriptLanguage">
            Language
          </label>
          <select id="scriptLanguage" name="language" defaultValue={defaultLanguage} className="field">
            {MESSAGE_LANGUAGES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending || !configured || exhausted}
          className="btn btn-brand min-h-[38px] text-[12.5px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Writing…" : "Write the script"}
        </button>
      </form>

      {state.status === "error" && state.message && (
        <p className="mt-3 rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-[11.5px] leading-relaxed text-danger">
          {state.message}
        </p>
      )}

      {state.status === "ok" && (
        <div className="mt-3 space-y-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={8}
            maxLength={900}
            className="field resize-y whitespace-pre-wrap"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={copyDraft} className="btn btn-ghost min-h-[34px] text-[12px]">
              {copied ? "Copied" : "Copy text"}
            </button>
            <button
              type="button"
              onClick={() => setDraft("")}
              className="text-[11.5px] text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Discard
            </button>
            <span className="text-[10.5px] text-muted">
              {state.credits.used} of {state.credits.limit} credits used in {state.credits.monthLabel}
            </span>
          </div>
          <p className="text-[10.5px] leading-relaxed text-muted">{state.message}</p>
        </div>
      )}
    </section>
  );
}
