"use client";

import { useActionState, useEffect, useState } from "react";
import {
  generateCampaignAction,
  saveCampaignAction,
  type CampaignState,
} from "@/app/actions/marketing";
import type { CampaignChannel } from "@/lib/marketing";
import { initials } from "@/lib/format";

/**
 * The marketing studio panel.
 *
 * Generating is a server action that returns a DRAFT to the browser. The draft
 * lives only in this component until the owner presses "Approve & save", which
 * posts the (possibly edited) text to `saveCampaignAction`. Nothing is written
 * to the database, and nothing is published anywhere, before that click.
 */

type Credits = { used: number; limit: number; planName: string; monthLabel: string };

export function MarketingStudio({
  businessName,
  configured,
  credits,
  products,
  channels,
}: {
  businessName: string;
  configured: boolean;
  credits: Credits;
  products: { id: string; name: string }[];
  channels: { id: CampaignChannel; label: string; note: string }[];
}) {
  const [state, formAction, pending] = useActionState<CampaignState, FormData>(
    generateCampaignAction,
    {
      status: "idle",
      channel: channels[0]?.id ?? "instagram",
      brief: "",
      title: "",
      body: "",
      featured: [],
      removedPriceClaims: false,
      message: "",
      credits,
    },
  );

  const [brief, setBrief] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>(channels[0]?.id ?? "instagram");
  const [selected, setSelected] = useState<string[]>([]);
  // Seeded from the action state so the approval form is rendered server-side with
  // the draft already in place (which also means it works without JavaScript).
  const [title, setTitle] = useState(state.status === "ok" ? state.title : "");
  const [body, setBody] = useState(state.status === "ok" ? state.body : "");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (state.status === "ok") {
      setTitle(state.title);
      setBody(state.body);
      setDismissed(false);
    }
  }, [state]);

  const remaining = Math.max(0, state.credits.limit - state.credits.used);
  const exhausted = state.credits.limit <= 0 || remaining === 0;
  const disabled = pending || !configured || exhausted;
  const channelNote = channels.find((item) => item.id === channel)?.note ?? "";
  const showDraft = state.status === "ok" && !dismissed;

  function toggleProduct(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <section className="card border-brand/20 bg-gradient-to-b from-brand-soft/40 to-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
              Marketing studio
            </p>
            <span className="rounded border border-line bg-white px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wide text-muted">
              Draft → approve
            </span>
          </div>
          <h2 className="mt-1 text-[14px] font-semibold tracking-[-0.01em]">
            A campaign from your catalogue, in one tap
          </h2>
          <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-muted">
            Give a one-line brief and pick up to three products. The AI never sees your prices and
            never saves anything — you read the draft, edit it, and approve it yourself.
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
            restart.
          </p>
        </div>
      )}

      {configured && exhausted && (
        <p className="mt-3 rounded-xl border border-line bg-white px-3 py-2 text-[11.5px] text-muted">
          {state.credits.limit <= 0
            ? `AI campaigns are not part of the ${state.credits.planName} plan.`
            : `All ${state.credits.limit} credits for ${state.credits.monthLabel} are used. They reset on the 1st of next month.`}
        </p>
      )}

      <form action={formAction} className="mt-3 space-y-3">
        <div>
          <label className="label" htmlFor="campaignBrief">
            What is this campaign for?
          </label>
          <input
            id="campaignBrief"
            name="brief"
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            maxLength={240}
            placeholder="Weekend special on our dosa and filter coffee"
            className="field bg-white"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="campaignChannel">
              Channel
            </label>
            <select
              id="campaignChannel"
              name="channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value as CampaignChannel)}
              className="field bg-white"
            >
              {channels.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10.5px] text-muted">{channelNote}</p>
          </div>

          <div>
            <p className="label">Feature products</p>
            {products.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-muted">
                No live products yet — you can still draft a business-level message.
              </p>
            ) : (
              <div className="max-h-[132px] space-y-1 overflow-y-auto rounded-lg border border-line bg-white p-2">
                {products.map((product) => (
                  <label key={product.id} className="flex items-center gap-2 text-[11.5px]">
                    <input
                      type="checkbox"
                      name="productIds"
                      value={product.id}
                      checked={selected.includes(product.id)}
                      onChange={() => toggleProduct(product.id)}
                      className="h-3.5 w-3.5 accent-[#2f6bff]"
                    />
                    <span className="truncate">{product.name}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="mt-1 text-[10.5px] text-muted">
              {selected.length > 3
                ? "Only the first three selected products are used."
                : "Up to three. Leave empty for a general message."}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={disabled}
          className="btn btn-brand min-h-[42px] text-[12.5px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Writing a draft…" : "Draft a campaign"}
        </button>

        <p className="text-[10.5px] text-muted">
          One credit per draft. Approving a draft is free.
        </p>
      </form>

      {state.status === "error" && state.message && (
        <p className="mt-3 rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-[11.5px] leading-relaxed text-danger">
          {state.message}
        </p>
      )}

      {showDraft && (
        <div className="mt-4 space-y-3 rounded-xl border border-line bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted">
              {channel === "instagram" ? "Instagram feed preview" : "WhatsApp broadcast preview"}
            </p>
            <span className="rounded-full border border-line px-2 py-0.5 text-[9.5px] uppercase tracking-wide text-muted">
              Not saved
            </span>
          </div>

          <div className="rounded-xl border border-line bg-canvas/40 p-3">
            <div className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{ backgroundColor: "#0b0b0f" }}
              >
                {initials(businessName)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold">{businessName}</p>
                <p className="text-[10px] text-muted">
                  {channel === "instagram" ? "Preview of your post" : "Preview of your message"}
                </p>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">{body}</p>
          </div>

          {state.featured.length > 0 && (
            <p className="text-[10.5px] text-muted">
              Built from: {state.featured.join(", ")} — names, categories and choices only, never a
              price.
            </p>
          )}

          {state.removedPriceClaims && (
            <p className="text-[11px] leading-relaxed text-warning">
              A sentence that mentioned pricing was removed. Campaigns describe the business; the
              price on your storefront always comes from your own price field.
            </p>
          )}

          <form action={saveCampaignAction} className="space-y-2 border-t border-line pt-3">
            <input type="hidden" name="channel" value={channel} />
            <div>
              <label className="label" htmlFor="campaignTitle">
                Campaign title
              </label>
              <input
                id="campaignTitle"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="campaignBody">
                Message
              </label>
              <textarea
                id="campaignBody"
                name="content"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={channel === "instagram" ? 5 : 4}
                maxLength={800}
                className="field resize-y"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={title.trim().length < 3 || body.trim().length < 30}
                className="btn btn-primary min-h-[40px] text-[12.5px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Approve &amp; save campaign
              </button>
              <button
                type="button"
                onClick={() => {
                  setDismissed(true);
                  setTitle("");
                  setBody("");
                }}
                className="text-[11.5px] text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                Discard draft
              </button>
            </div>
            <p className="text-[10.5px] leading-relaxed text-muted">
              Approving saves this campaign to your workspace. It does not post to Instagram or
              WhatsApp — copy it into the app yourself. Saved campaigns keep their text as written;
              nothing is sent from here.
            </p>
          </form>
        </div>
      )}

      {state.status === "ok" && (
        <p className="mt-2 text-[10.5px] text-muted">
          {state.credits.used} of {state.credits.limit} credits used in {state.credits.monthLabel} on
          the {state.credits.planName} plan.
        </p>
      )}
    </section>
  );
}
