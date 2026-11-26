/**
 * AI RETRY AND FALLBACK UNIT TEST.
 *
 * `src/lib/ai.ts` retries a swamped Gemini call once, on a second model when one
 * is configured, inside a single 20-second budget. Until now that was checked by
 * hand with a throwaway stub server; this file makes those checks part of
 * `npm test`.
 *
 * Nothing here touches the real provider: GEMINI_API_BASE points at the local
 * stub in ./support/ai-stub.mjs. The module is imported directly — Node 24
 * strips the TypeScript types itself, so the code under test is the same file the
 * app runs.
 *
 * Covered:
 *   - 503 on the first model is retried on the fallback model
 *   - 429 is this key's own quota, so the second model is not called
 *   - a hung first attempt still leaves time for the second
 *   - every model refusing ends as "provider", never as a fake result
 *   - with no separate fallback the same model is tried once more
 *   - a 400 is the request's fault and is not retried
 *   - no key, and empty text, are reported as themselves
 */
import test from "node:test";
import assert from "node:assert/strict";

import { aiFallbackModelName, aiModelName, callGeminiText } from "../src/lib/ai.ts";
import { answered, configured, refused, stubProvider, withEnv } from "./support/ai-stub.mjs";

const PRIMARY = "test-primary-model";
const FALLBACK = "test-fallback-model";

test("the model names come from the environment, with documented defaults", () => {
  return withEnv({ GEMINI_MODEL: undefined, GEMINI_MODEL_FALLBACK: undefined }, () => {
    assert.equal(aiModelName(), "gemini-3.8-flash");
    assert.equal(aiFallbackModelName(), "gemini-3.1-flash-lite");
  });
});

test("a 503 on the first model is retried on the fallback model", async () => {
  const stub = await stubProvider((call, response, index) =>
    index === 0 ? refused(503)(call, response) : answered("Second model answered.")(call, response),
  );

  try {
    const result = await withEnv(configured(stub.base), () =>
      callGeminiText("system", "write something"),
    );

    assert.deepEqual(result, { ok: true, text: "Second model answered." });
    assert.equal(stub.requests.length, 2, "a 503 should be tried exactly twice");
    assert.deepEqual(
      stub.requests.map((call) => call.model),
      [PRIMARY, FALLBACK],
      "the retry should run on the fallback model",
    );
    assert.equal(stub.requests[0].apiKey, "stub-key-not-a-secret", "the key is sent as a header");
    assert.ok(
      JSON.parse(stub.requests[0].body).systemInstruction.parts[0].text === "system",
      "the system prompt is sent in the request body",
    );
  } finally {
    await stub.close();
  }
});

test("a 429 is this key's quota, so the second model is not called", async () => {
  const stub = await stubProvider(refused(429));

  try {
    const result = await withEnv(configured(stub.base), () => callGeminiText("system", "user"));

    assert.deepEqual(result, { ok: false, error: "rate_limited" });
    assert.equal(stub.requests.length, 1, "another model cannot fix a key that is out of quota");
  } finally {
    await stub.close();
  }
});

test("a hung first attempt still leaves time for the second", { timeout: 25_000 }, async () => {
  // The stub never writes a reply, so the first attempt can only end by timeout.
  const stub = await stubProvider((call, response, index) => {
    if (index === 0) return;
    answered("Answered after the hang.")(call, response);
  });

  try {
    const startedAt = Date.now();
    const result = await withEnv(configured(stub.base), () => callGeminiText("system", "user"));
    const elapsed = Date.now() - startedAt;

    assert.deepEqual(result, { ok: true, text: "Answered after the hang." });
    assert.deepEqual(
      stub.requests.map((call) => call.model),
      [PRIMARY, FALLBACK],
      "a hung model is as unusable as a refusal, so the fallback runs",
    );
    assert.ok(
      elapsed >= 9_000,
      `the first attempt should use its half of the budget before being abandoned (waited ${elapsed}ms)`,
    );
    assert.ok(
      elapsed < 20_000,
      `the second attempt must still run inside the 20s budget (took ${elapsed}ms)`,
    );
  } finally {
    await stub.close();
  }
});

test("when every model refuses, the answer is an error, not a fake draft", async () => {
  const stub = await stubProvider(refused(500));

  try {
    const result = await withEnv(configured(stub.base), () => callGeminiText("system", "user"));

    assert.deepEqual(result, { ok: false, error: "provider" });
    assert.equal(stub.requests.length, 2, "the budget allows exactly two attempts");
  } finally {
    await stub.close();
  }
});

test("with no separate fallback the same model is tried once more", async () => {
  const stub = await stubProvider((call, response, index) =>
    index === 0 ? refused(503)(call, response) : answered("Retried on itself.")(call, response),
  );

  try {
    const result = await withEnv(configured(stub.base, { GEMINI_MODEL_FALLBACK: PRIMARY }), () =>
      callGeminiText("system", "user"),
    );

    assert.deepEqual(result, { ok: true, text: "Retried on itself." });
    assert.deepEqual(
      stub.requests.map((call) => call.model),
      [PRIMARY, PRIMARY],
      "a 503 spike is usually gone in a second, so the same model is retried",
    );
  } finally {
    await stub.close();
  }
});

test("a 400 is the request's fault, so it is not retried", async () => {
  const stub = await stubProvider(refused(400));

  try {
    const result = await withEnv(configured(stub.base), () => callGeminiText("system", "user"));

    assert.deepEqual(result, { ok: false, error: "provider" });
    assert.equal(stub.requests.length, 1, "a malformed request stays malformed on a second try");
  } finally {
    await stub.close();
  }
});

test("empty text is reported as empty, and is not retried", async () => {
  const stub = await stubProvider((call, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "  " }] } }] }));
  });

  try {
    const result = await withEnv(configured(stub.base), () => callGeminiText("system", "user"));

    assert.deepEqual(result, { ok: false, error: "empty" });
    assert.equal(stub.requests.length, 1);
  } finally {
    await stub.close();
  }
});

test("with no key nothing is sent to a provider", async () => {
  const stub = await stubProvider(answered("Should never be reached."));

  try {
    const result = await withEnv(configured(stub.base, { GEMINI_API_KEY: undefined }), () =>
      callGeminiText("system", "user"),
    );

    assert.deepEqual(result, { ok: false, error: "not_configured" });
    assert.equal(stub.requests.length, 0, "no key means no request at all");
  } finally {
    await stub.close();
  }
});
