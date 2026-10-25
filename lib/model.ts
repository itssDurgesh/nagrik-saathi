import { google } from "@ai-sdk/google";
import { APICallError, RetryError, wrapLanguageModel } from "ai";

type GeminiModel = ReturnType<typeof google>;
type CallOptions = Parameters<GeminiModel["doStream"]>[0];

// Free-tier Gemini quotas are per model and can be as low as 20 requests a day, while one photo report
// takes 5-6 agent steps. So when a model is out of quota or overloaded, the agent moves to the next one.
export const DEFAULT_MODELS = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash", "gemini-3.1-flash-lite"];

/** GEMINI_MODEL goes first, then GEMINI_FALLBACK_MODELS (comma-separated) or the defaults. */
export function modelChain(env: Record<string, string | undefined> = process.env) {
  const fallbacks = env.GEMINI_FALLBACK_MODELS ? env.GEMINI_FALLBACK_MODELS.split(",") : DEFAULT_MODELS;
  return [...new Set([env.GEMINI_MODEL ?? "", ...fallbacks].map((m) => m.trim()).filter(Boolean))];
}

/** Minimal thinking keeps each agent step around a second or two, which matters in a live demo. */
export function thinkingOptions(modelId: string) {
  return { thinkingConfig: modelId.startsWith("gemini-2.5") ? { thinkingBudget: 0 } : { thinkingLevel: "low" } };
}

/** Out of quota (429) or overloaded (503): worth trying another model. */
export function isCapacityError(err: unknown): boolean {
  if (RetryError.isInstance(err)) return isCapacityError(err.lastError);
  return APICallError.isInstance(err) && (err.statusCode === 429 || err.statusCode === 503);
}

// A model that just failed is skipped for a while, so later requests don't spend a round trip on it.
const coolingUntil = new Map<string, number>();
const cooldownMs = (status?: number) => (status === 429 ? 10 * 60_000 : 30_000);

export function fallbackModel(ids: string[], resolve: (id: string) => GeminiModel = google) {
  async function attempt<T>(params: CallOptions, call: (model: GeminiModel, params: CallOptions) => PromiseLike<T>): Promise<T> {
    const ready = ids.filter((id) => (coolingUntil.get(id) ?? 0) <= Date.now());
    let lastError: unknown;
    // If every model is cooling down, try them all anyway rather than fail without asking.
    for (const id of ready.length ? ready : ids) {
      try {
        const options = { ...params.providerOptions?.google, ...thinkingOptions(id) };
        return await call(resolve(id), { ...params, providerOptions: { ...params.providerOptions, google: options } });
      } catch (err) {
        if (!isCapacityError(err)) throw err;
        const status = (err as APICallError).statusCode;
        coolingUntil.set(id, Date.now() + cooldownMs(status));
        console.warn(`Gemini ${id} unavailable (${status}), trying the next model`);
        lastError = err;
      }
    }
    throw lastError;
  }

  return wrapLanguageModel({
    model: resolve(ids[0]),
    middleware: {
      wrapGenerate: ({ params }) => attempt(params, (m, p) => m.doGenerate(p)),
      wrapStream: ({ params }) => attempt(params, (m, p) => m.doStream(p)),
    },
  });
}
