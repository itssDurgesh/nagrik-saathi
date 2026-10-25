import { convertToModelMessages, isStepCount, streamText, type UIMessage } from "ai";
import { fallbackModel, isCapacityError, modelChain } from "@/lib/model";
import { buildInstructions } from "@/lib/prompts";
import { readDb } from "@/lib/store";
import { buildTools, type AgentContext } from "@/lib/tools";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json(
      { error: "GOOGLE_GENERATIVE_AI_API_KEY is missing. Add it to .env.local (or your host's environment variables) and restart the server." },
      { status: 500 },
    );
  }

  const { messages, location, thumb }: { messages: UIMessage[] } & AgentContext = await req.json();
  const { settings } = await readDb();
  const ctx: AgentContext = { location: location ?? null, thumb };

  const result = streamText({
    model: fallbackModel(modelChain()),
    // The fallback chain already handles quota and overload errors, so one retry is enough for blips.
    maxRetries: 1,
    instructions: buildInstructions(settings, ctx),
    messages: await convertToModelMessages(messages),
    tools: buildTools(ctx, settings),
    stopWhen: isStepCount(8),
  });

  return result.toUIMessageStreamResponse({
    onError: (err) => {
      console.error(err);
      // A malformed tool call goes back to the model, which fixes it on the next step; label the card honestly.
      const name = err instanceof Error ? err.name : "";
      if (name === "AI_InvalidToolInputError" || name === "AI_NoSuchToolError") return "Incomplete tool call from the model. It retried.";
      return isCapacityError(err)
        ? "Gemini is out of free quota or busy on every model we can use. Please try again in a few minutes."
        : "The agent hit a problem talking to Gemini. Please try again.";
    },
  });
}
