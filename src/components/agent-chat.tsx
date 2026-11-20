"use client";

import { useActionState, useState } from "react";
import { askAgentAction, type AgentState } from "@/app/actions/agent";
import type { AgentFact } from "@/lib/agent";

/**
 * The read-only agent panel.
 *
 * The question is answered by a server action. The response includes the report
 * that was used and the facts that were read, so the owner can see exactly where
 * every number came from — nothing is invented in the browser.
 */

type Credits = { used: number; limit: number; planName: string; monthLabel: string };

export function AgentChat({
  configured,
  credits,
  suggestions,
}: {
  configured: boolean;
  credits: Credits;
  suggestions: { label: string; examples: string[] }[];
}) {
  const [state, formAction, pending] = useActionState<AgentState, FormData>(askAgentAction, {
    status: "idle",
    question: "",
    answer: "",
    report: "",
    facts: [],
    usedFallback: false,
    message: "",
    credits,
  });

  const [question, setQuestion] = useState("");
  const remaining = Math.max(0, state.credits.limit - state.credits.used);
  const exhausted = state.credits.limit <= 0 || remaining === 0;
  const disabled = pending || !configured || exhausted;

  const chips = suggestions.flatMap((report) =>
    report.examples.slice(0, 1).map((example) => ({ label: report.label, example })),
  );

  return (
    <section className="card border-brand/20 bg-gradient-to-b from-brand-soft/40 to-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
              Business agent
            </p>
            <span className="rounded border border-line bg-white px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wide text-muted">
              Read-only
            </span>
          </div>
          <h2 className="mt-1 text-[14px] font-semibold tracking-[-0.01em]">
            Ask a question about your shop
          </h2>
          <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-muted">
            Answers come from eight fixed queries on your own data. The AI chooses which query to
            run and how to word the answer — it never writes SQL and never changes a record.
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
            restart. The key stays on the server.
          </p>
        </div>
      )}

      {configured && exhausted && (
        <p className="mt-3 rounded-xl border border-line bg-white px-3 py-2 text-[11.5px] text-muted">
          {state.credits.limit <= 0
            ? `The AI agent is not part of the ${state.credits.planName} plan.`
            : `All ${state.credits.limit} credits for ${state.credits.monthLabel} are used. They reset on the 1st of next month.`}
        </p>
      )}

      <form action={formAction} className="mt-3 space-y-2">
        <label className="label" htmlFor="agentQuestion">
          Your question
        </label>
        <textarea
          id="agentQuestion"
          name="question"
          rows={2}
          maxLength={300}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="How many orders did I get today?"
          className="field resize-y bg-white"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={disabled}
            className="btn btn-brand min-h-[42px] text-[12.5px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Reading your data…" : "Ask"}
          </button>
          <span className="text-[10.5px] text-muted">
            One credit per answered question. Refusals are free.
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {chips.map((chip) => (
            <button
              key={chip.example}
              type="submit"
              name="suggested"
              value={chip.example}
              disabled={disabled}
              className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-brand/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {chip.example}
            </button>
          ))}
        </div>
      </form>

      {state.status === "refused" && (
        <div className="mt-3 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink">
          <p className="font-semibold text-warning">That is not something I can do.</p>
          <p className="mt-1 text-muted">{state.message}</p>
        </div>
      )}

      {state.status === "help" && (
        <div className="mt-3 rounded-xl border border-line bg-white px-3 py-2.5 text-[11.5px] leading-relaxed text-muted">
          {state.message}
        </div>
      )}

      {state.status === "error" && state.message && (
        <p className="mt-3 rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-[11.5px] leading-relaxed text-danger">
          {state.message}
        </p>
      )}

      {state.status === "ok" && (
        <div className="mt-3 rounded-xl border border-line bg-white p-3">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted">
            {state.report}
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink">{state.answer}</p>

          {state.facts.length > 0 && (
            <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-line pt-2.5 sm:grid-cols-3">
              {state.facts.map((fact: AgentFact, index) => (
                <div key={`${fact.label}-${index}`} className="min-w-0">
                  <dt className="truncate text-[10px] uppercase tracking-[0.08em] text-muted">
                    {fact.label}
                  </dt>
                  <dd className="text-[12px] font-medium tabular-nums">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {state.usedFallback && (
            <p className="mt-2 text-[10.5px] leading-relaxed text-warning">
              The AI&apos;s wording was replaced with the report&apos;s own sentence because it
              contained a number that is not in your records.
            </p>
          )}

          <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
            Read from your database just now. {state.credits.used} of {state.credits.limit} credits
            used in {state.credits.monthLabel} on the {state.credits.planName} plan.
          </p>
        </div>
      )}
    </section>
  );
}
