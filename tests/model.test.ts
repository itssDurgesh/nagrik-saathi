import { APICallError, RetryError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MODELS, fallbackModel, isCapacityError, modelChain, thinkingOptions } from "@/lib/model";

const apiError = (statusCode: number) =>
  new APICallError({ message: `HTTP ${statusCode}`, url: "https://gemini.test", requestBodyValues: {}, statusCode });

const okStream = { stream: new ReadableStream() };
const params = { prompt: [{ role: "user" as const, content: [{ type: "text" as const, text: "hi" }] }] };

/** Mock models keyed by id; each either fails with the given status or streams. */
function models(spec: Record<string, number | "ok">) {
  const mocks = Object.fromEntries(
    Object.entries(spec).map(([id, s]) => [
      id,
      new MockLanguageModelV4({
        modelId: id,
        doStream: async () => {
          if (s === "ok") return okStream;
          throw apiError(s);
        },
      }),
    ]),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { mocks, resolve: (id: string) => mocks[id] as any };
}

describe("modelChain", () => {
  it("uses the defaults when nothing is configured", () => {
    expect(modelChain({})).toEqual(DEFAULT_MODELS);
  });

  it("puts GEMINI_MODEL first without repeating it", () => {
    expect(modelChain({ GEMINI_MODEL: "gemini-2.5-flash" })).toEqual(["gemini-2.5-flash", ...DEFAULT_MODELS.filter((m) => m !== "gemini-2.5-flash")]);
  });

  it("honours GEMINI_FALLBACK_MODELS", () => {
    expect(modelChain({ GEMINI_MODEL: "a", GEMINI_FALLBACK_MODELS: " b, c ,," })).toEqual(["a", "b", "c"]);
  });
});

describe("thinkingOptions", () => {
  it("turns thinking off on Gemini 2.5 and keeps it low on newer models", () => {
    expect(thinkingOptions("gemini-2.5-flash")).toEqual({ thinkingConfig: { thinkingBudget: 0 } });
    expect(thinkingOptions("gemini-3.5-flash")).toEqual({ thinkingConfig: { thinkingLevel: "low" } });
  });
});

describe("isCapacityError", () => {
  it("matches quota (429) and overload (503) errors, also inside a RetryError", () => {
    expect(isCapacityError(apiError(429))).toBe(true);
    expect(isCapacityError(apiError(503))).toBe(true);
    expect(isCapacityError(new RetryError({ message: "x", reason: "maxRetriesExceeded", errors: [apiError(429)] }))).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isCapacityError(apiError(400))).toBe(false);
    expect(isCapacityError(new Error("boom"))).toBe(false);
  });
});

describe("fallbackModel", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  it("moves to the next model when one is out of quota, with that model's thinking settings", async () => {
    const { mocks, resolve } = models({ "q-a": 429, "gemini-2.5-q-b": "ok" });
    const result = await fallbackModel(["q-a", "gemini-2.5-q-b"], resolve).doStream(params);
    expect(result.stream).toBe(okStream.stream);
    expect(mocks["gemini-2.5-q-b"].doStreamCalls[0].providerOptions?.google).toEqual({ thinkingConfig: { thinkingBudget: 0 } });
    expect(warn).toHaveBeenCalled();
  });

  it("skips a model that just ran out of quota on the next request", async () => {
    const { mocks, resolve } = models({ "c-a": 429, "c-b": "ok" });
    const model = fallbackModel(["c-a", "c-b"], resolve);
    await model.doStream(params);
    await model.doStream(params);
    expect(mocks["c-a"].doStreamCalls).toHaveLength(1);
    expect(mocks["c-b"].doStreamCalls).toHaveLength(2);
  });

  it("does not fall back on errors that another model would hit too", async () => {
    const { mocks, resolve } = models({ "e-a": 400, "e-b": "ok" });
    await expect(fallbackModel(["e-a", "e-b"], resolve).doStream(params)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks["e-b"].doStreamCalls).toHaveLength(0);
  });

  it("throws the last capacity error when every model is unavailable", async () => {
    const { resolve } = models({ "x-a": 429, "x-b": 503 });
    await expect(fallbackModel(["x-a", "x-b"], resolve).doStream(params)).rejects.toMatchObject({ statusCode: 503 });
  });
});
