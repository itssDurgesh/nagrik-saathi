import { google } from "@ai-sdk/google";
import { convertToModelMessages, isStepCount, streamText, type UIMessage } from "ai";
import { buildInstructions } from "@/lib/prompts";
import { readDb } from "@/lib/store";
import { buildTools, type AgentContext } from "@/lib/tools";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json(
      { error: "GOOGLE_GENERATIVE_AI_API_KEY is missing. Add it to .env.local and restart the dev server." },
      { status: 500 },
    );
  }

  const { messages, location, thumb }: { messages: UIMessage[] } & AgentContext = await req.json();
  const { settings } = await readDb();
  const ctx: AgentContext = { location: location ?? null, thumb };

  const modelId = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
  const result = streamText({
    model: google(modelId),
    // Minimal thinking keeps each agent step around a second or two, which matters in a live demo.
    providerOptions: {
      google: { thinkingConfig: modelId.startsWith("gemini-2.5") ? { thinkingBudget: 0 } : { thinkingLevel: "low" } },
    },
    instructions: buildInstructions(settings, ctx),
    messages: await convertToModelMessages(messages),
    tools: buildTools(ctx, settings),
    stopWhen: isStepCount(8),
  });

  return result.toUIMessageStreamResponse({
    onError: (err) => {
      console.error(err);
      return "The agent hit a problem talking to Gemini. Please try again.";
    },
  });
}
