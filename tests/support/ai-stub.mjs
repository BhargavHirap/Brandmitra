/**
 * A fake AI provider for the AI unit tests.
 *
 * `src/lib/ai.ts` reads GEMINI_API_BASE, so pointing that at a local HTTP server
 * makes the module talk to this instead of Google. Each test decides what the
 * stub replies with; every request is recorded so a test can assert which model
 * was called, with which key, and with what body.
 *
 * Nothing here is a secret: the key is a literal stub string.
 */
import http from "node:http";

const ENV_KEYS = ["GEMINI_API_KEY", "GEMINI_API_BASE", "GEMINI_MODEL", "GEMINI_MODEL_FALLBACK"];

/** A stub provider that records every request and replies with `reply`. */
export async function stubProvider(reply) {
  const requests = [];
  const sockets = new Set();

  const server = http.createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;

    const model = decodeURIComponent(
      (request.url ?? "").match(/\/models\/([^:]+):generateContent/)?.[1] ?? "",
    );
    const call = { model, apiKey: request.headers["x-goog-api-key"], body };
    requests.push(call);

    reply(call, response, requests.length - 1);
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  return {
    base: `http://127.0.0.1:${port}/v1beta`,
    requests,
    async close() {
      // A hung reply leaves its socket open, which would keep close() waiting.
      server.closeAllConnections?.();
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

/** A 200 whose candidate carries `text` — what Gemini returns for plain text. */
export function answered(text) {
  return (call, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }));
  };
}

/** A provider error response, e.g. 429 or 503. */
export function refused(status) {
  return (call, response) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: status, message: "stub" } }));
  };
}

/** Applies env for one test and restores the previous values afterwards. */
export async function withEnv(values, run) {
  const previous = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** The env a normal, configured deployment has, aimed at `base`. */
export function configured(base, extra = {}) {
  return {
    GEMINI_API_KEY: "stub-key-not-a-secret",
    GEMINI_API_BASE: base,
    GEMINI_MODEL: "test-primary-model",
    GEMINI_MODEL_FALLBACK: "test-fallback-model",
    ...extra,
  };
}
