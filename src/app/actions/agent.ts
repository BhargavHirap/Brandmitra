"use server";

import { answerWithAgent, asksToChangeMoney, PRICE_REFUSAL, type AgentFact } from "@/lib/agent";
import {
  AI_ERROR_MESSAGES,
  aiModelName,
  getAiUsage,
  isAiConfigured,
  type AiError,
} from "@/lib/ai";
import { logAudit, requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";
import { AI_RATE_LIMITS, checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";

/**
 * AI BUSINESS AGENT ACTION — one question in, one answer out.
 *
 * Every question goes through the same order of checks:
 *   1. does it ask to change money?  -> refuse, before any model call.
 *   2. is AI configured and are credits left? -> say so, change nothing.
 *   3. the model picks ONE fixed report id (never SQL).
 *   4. the report's own SELECT runs, scoped to this business.
 *   5. the model rewords only those numbers; anything else is discarded.
 *
 * A refusal or an "I cannot match that" reply costs no credit, because no
 * answer was produced. A real answer writes one `ai.generated` row, which is
 * what `getAiUsage` counts against `plans.ai_credits`.
 */

type Credits = { used: number; limit: number; planName: string; monthLabel: string };

export type AgentState = {
  status: "idle" | "ok" | "error" | "refused" | "help";
  question: string;
  answer: string;
  report: string;
  facts: AgentFact[];
  usedFallback: boolean;
  message: string;
  credits: Credits;
};

const AGENT_ERROR_TEXT: Record<AiError, string> = {
  not_configured: AI_ERROR_MESSAGES.not_configured,
  timeout: "The AI service took too long to answer. Nothing changed — try again in a moment.",
  rate_limited: AI_ERROR_MESSAGES.rate_limited,
  provider: "The AI service refused that request. Nothing changed — try again later.",
  empty: "The AI service answered with nothing usable. Try asking again in your own words.",
  rejected: "The answer was discarded because it did not match your records. Nothing was changed.",
};

function text(formData: FormData, key: string, max = 300): string {
  return String(formData.get(key) ?? "")
    .trim()
    .slice(0, max);
}

function state(
  status: AgentState["status"],
  credits: Credits,
  message: string,
  question = "",
): AgentState {
  return {
    status,
    question,
    answer: "",
    report: "",
    facts: [],
    usedFallback: false,
    message,
    credits,
  };
}

export async function askAgentAction(
  previous: AgentState,
  formData: FormData,
): Promise<AgentState> {
  const { user, business, planId } = await requireBusiness();
  const db = await getDb();
  const credits = await getAiUsage(db, business.id, planId);

  // A suggestion chip submits its own value; the typed box submits `question`.
  const suggested = text(formData, "suggested");
  const question = (suggested || text(formData, "question")).slice(0, 300);

  if (question.length < 3) {
    return state("error", credits, "Type a question first — for example “How many orders today?”.");
  }

  // 1. Money changes are refused in plain code, before the model is reached.
  if (asksToChangeMoney(question)) {
    await logAudit({
      businessId: business.id,
      actorUserId: user.id,
      actorType: "ai",
      action: "ai.refused",
      entity: "business",
      entityId: business.id,
      payload: { reason: "read_only_money_change" },
    });
    return state("refused", credits, PRICE_REFUSAL, question);
  }

  // 2. Configuration and credits.
  if (!isAiConfigured()) {
    return state("error", credits, AGENT_ERROR_TEXT.not_configured, question);
  }
  if (credits.limit <= 0) {
    return state(
      "error",
      credits,
      `The AI agent is not included in the ${credits.planName} plan.`,
      question,
    );
  }
  if (credits.used >= credits.limit) {
    return state(
      "error",
      credits,
      `You have used all ${credits.limit} AI credits for ${credits.monthLabel} on the ${credits.planName} plan. They reset on the 1st.`,
      question,
    );
  }

  // 3–5. Pick a report, run its fixed SELECT, reword only those numbers.
  // Two model calls happen inside answerWithAgent, so a burst fence sits in
  // front of it: 20 questions in ten minutes is a script, not a person.
  const burst = await checkRateLimit(AI_RATE_LIMITS.agent, user.id, db);
  if (!burst.allowed) {
    return state("error", credits, rateLimitMessage(burst, AI_RATE_LIMITS.agent.label), question);
  }

  const result = await answerWithAgent(db, business.id, question);

  if (!result.ok) {
    if (result.error === "no_report") {
      return state(
        "help",
        credits,
        "I could not match that to a report I am allowed to run, so I will not guess. Try one of the questions listed on this page — everything I answer comes from a fixed query on your own data.",
        question,
      );
    }
    return state("error", credits, AGENT_ERROR_TEXT[result.error], question);
  }

  await logAudit({
    businessId: business.id,
    actorUserId: user.id,
    actorType: "ai",
    action: "ai.generated",
    entity: "business",
    entityId: business.id,
    // The report id, not the question text: an audit trail, not a transcript.
    payload: { kind: "agent", report: result.template, model: aiModelName() },
  });

  return {
    status: "ok",
    question,
    answer: result.answer,
    report: result.label,
    facts: result.facts,
    usedFallback: result.usedFallback,
    message: "",
    credits: { ...credits, used: credits.used + 1 },
  };
}
