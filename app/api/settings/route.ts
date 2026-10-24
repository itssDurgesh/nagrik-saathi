import { readDb, resetDb, updateDb } from "@/lib/store";
import type { Settings } from "@/lib/types";

export async function GET() {
  const db = await readDb();
  return Response.json({
    settings: db.settings,
    logs: db.logs,
    model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
    hasKey: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
  });
}

export async function PATCH(req: Request) {
  const patch: Partial<Settings> = await req.json();
  const settings = await updateDb((db) => {
    db.settings = { ...db.settings, ...patch };
    return db.settings;
  });
  return Response.json({ settings });
}

// Reset demo data back to the seed.
export async function DELETE() {
  await resetDb();
  return Response.json({ ok: true });
}
