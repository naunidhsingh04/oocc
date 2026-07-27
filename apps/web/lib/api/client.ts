import type { Trace } from "@oocc/contracts";
import type {
  AlgorithmResult,
  Capabilities,
  RunNarration,
  TutorEvent,
  TutorTurn,
  ValidateKeyResult,
} from "./types";

/**
 * The real FastAPI backend (apps/api) — every AI surface talks to this
 * directly from the browser, never proxied through a Next.js route, so the
 * `X-Provider-Key` header goes straight from the user's own localStorage to
 * the server that's the only one ever allowed to see it (docs/PRD.md §4.5).
 * Defaults to the docker-compose service address; override with
 * `NEXT_PUBLIC_API_URL` for any other setup.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function authHeaders(providerKey: string | null): HeadersInit {
  return providerKey ? { "X-Provider-Key": providerKey } : {};
}

/**
 * The LLM-only half of `POST /api/runs` (algorithm classification,
 * narration, capabilities) — the trace/analysis/plan themselves keep
 * coming from the committed fixture (see lib/fixtures.ts), since those are
 * deterministic and byte-stable; only this part needs a live backend, and
 * degrades to `null` (never throws) if one isn't reachable, exactly like
 * having no provider key at all.
 */
export async function fetchRunExtras(params: {
  source: string;
  stdin?: string;
  providerKey: string | null;
}): Promise<{ algorithm: AlgorithmResult | null; narration: RunNarration; capabilities: Capabilities } | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(params.providerKey) },
      body: JSON.stringify({ source: params.source, stdin: params.stdin ?? "" }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      algorithm: AlgorithmResult | null;
      narration: RunNarration;
      capabilities: Capabilities;
    };
    return { algorithm: data.algorithm, narration: data.narration, capabilities: data.capabilities };
  } catch {
    return null;
  }
}

export async function validateProviderKey(key: string): Promise<ValidateKeyResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/settings/validate-key`, {
      method: "POST",
      headers: authHeaders(key),
    });
    return (await response.json()) as ValidateKeyResult;
  } catch {
    return { valid: false, tokens_used: null, error: "network_error" };
  }
}

/**
 * Parses the SSE wire format by hand (`fetch` + a readable-stream reader,
 * not `EventSource`) because `EventSource` can't send a POST body or a
 * custom `X-Provider-Key` header — see apps/api/app/routers/tutor.py's own
 * docstring for why the stream is still genuinely SSE even though the
 * model call underneath it isn't token-streamed.
 */
export async function* streamTutorAnswer(params: {
  trace: Trace;
  source: string;
  currentStep: number;
  question: string;
  history: TutorTurn[];
  providerKey: string | null;
}): AsyncGenerator<TutorEvent> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/tutor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(params.providerKey) },
      body: JSON.stringify({
        trace: params.trace,
        source: params.source,
        current_step: params.currentStep,
        question: params.question,
        history: params.history,
      }),
    });
  } catch {
    yield { type: "unavailable", reason: "no_provider_key" };
    return;
  }

  if (!response.body) {
    yield { type: "unavailable", reason: "no_provider_key" };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const raw of events) {
      const dataLine = raw.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      yield JSON.parse(dataLine.slice("data: ".length)) as TutorEvent;
    }
  }
}
