import { setStatus } from "@/lib/store";
import type { Status } from "@/lib/types";

// Officer console: move a ticket and optionally leave a note the agent will read back.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status, note }: { status: Status; note?: string } = await req.json();
  const complaint = await setStatus(id, status, note ?? "");
  if (!complaint) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ complaint });
}
