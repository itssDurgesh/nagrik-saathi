import { addLog, createComplaint, readDb, type NewComplaint } from "@/lib/store";

export async function GET() {
  const db = await readDb();
  return Response.json({ complaints: db.complaints, wards: db.wards, departments: db.departments });
}

// Called by the approval card when the user approves a draft (ask mode).
export async function POST(req: Request) {
  const input: NewComplaint = await req.json();
  const start = Date.now();
  const complaint = await createComplaint(input);
  await addLog({ tool: "confirm_and_file", input: { ...input, thumb: undefined }, output: { filed: true, id: complaint.id }, ms: Date.now() - start, ok: true });
  return Response.json({ complaint });
}
