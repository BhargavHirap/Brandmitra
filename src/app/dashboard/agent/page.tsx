import { AgentChat } from "@/components/agent-chat";
import { PageHeader, Panel } from "@/components/ui";
import { agentReportList } from "@/lib/agent";
import { getAiUsage, isAiConfigured } from "@/lib/ai";
import { requireBusiness } from "@/lib/business";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI business agent" };

/**
 * Phase 5, part 2 — the read-only agent.
 *
 * This page is a thin shell: the fixed report list is rendered on the server so
 * the SQL never reaches the browser, and the chat panel posts a server action.
 */

export default async function BusinessAgentPage() {
  const { business, planId } = await requireBusiness();
  const db = await getDb();
  const [aiUsage, reports] = await Promise.all([
    getAiUsage(db, business.id, planId),
    Promise.resolve(agentReportList()),
  ]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        eyebrow="Grow with AI"
        title="AI business agent"
        description="Ask about today's orders, this week's sales, your best seller or your catalogue. Answers are read from your own rows through fixed queries — the agent cannot change anything."
      />

      <AgentChat
        configured={isAiConfigured()}
        credits={{
          used: aiUsage.used,
          limit: aiUsage.limit,
          planName: aiUsage.planName,
          monthLabel: aiUsage.monthLabel,
        }}
        suggestions={reports.map(({ label, examples }) => ({ label, examples }))}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="What it can answer"
          description="Eight reports, written by hand in src/lib/agent.ts"
          className="lg:col-span-2"
          padded={false}
        >
          <ul className="divide-y divide-line">
            {reports.map((report) => (
              <li key={report.id} className="px-4 py-3">
                <p className="text-[12.5px] font-semibold">{report.label}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                  {report.description}
                </p>
                <p className="mt-1 text-[11px] italic text-muted/80">
                  “{report.examples[0]}”
                </p>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-4">
          <Panel title="Why it cannot touch your prices">
            <ul className="space-y-2.5 text-[11.5px] leading-relaxed text-muted">
              <li>
                <span className="font-semibold text-ink">No generated SQL.</span> The AI only
                returns the name of one report. The SQL is written by hand in this project, and all
                of it is <code className="rounded bg-canvas px-1 py-px text-[10.5px]">SELECT</code>.
              </li>
              <li>
                <span className="font-semibold text-ink">No write path.</span> The agent module
                never calls the database to write — there is no code for it to reach.
              </li>
              <li>
                <span className="font-semibold text-ink">Refusals are code, not AI.</span> A request
                like “apply a 90% discount” is refused before the model is even called, and logged
                as <code className="rounded bg-canvas px-1 py-px text-[10.5px]">ai.refused</code>.
              </li>
              <li>
                <span className="font-semibold text-ink">Numbers are checked.</span> If the AI
                reworded an answer with a number that is not in the report, its sentence is thrown
                away and the report&apos;s own wording is shown instead.
              </li>
              <li>
                <span className="font-semibold text-ink">Your data only.</span> Every query takes
                the business id from your login, never from the question.
              </li>
            </ul>
          </Panel>

          <Panel title="To change a price">
            <p className="text-[11.5px] leading-relaxed text-muted">
              Open <span className="font-medium text-ink">Products</span>, pick the item and edit
              its price field. You see the number before you save, and the change is written to the
              audit trail under your name.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
