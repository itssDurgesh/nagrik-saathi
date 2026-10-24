import { describe, expect, it } from "vitest";
import { readDb } from "@/lib/store";
import { buildTools, type AgentContext } from "@/lib/tools";
import type { Settings } from "@/lib/types";

const askMode: Settings = { autonomy: "ask", language: "en", tone: "simple", disabledTools: [] };
const ctx: AgentContext = { location: { lat: 23.0124, lng: 72.5626, source: "map" } };

type Result = Record<string, unknown>;

/** Runs a tool's execute the way the AI SDK would. */
function call(settings: Settings, name: string, input: object): Promise<Result> {
  const tools = buildTools(ctx, settings) as Record<string, { execute?: (i: object, o: object) => Promise<Result> }>;
  const t = tools[name];
  if (!t?.execute) throw new Error(`${name} is not executable in this mode`);
  return t.execute(input, { toolCallId: "test", messages: [] });
}

describe("tool availability", () => {
  it("offers the approval card, not direct filing, in ask mode", () => {
    const names = Object.keys(buildTools(ctx, askMode));
    expect(names).toContain("confirm_and_file");
    expect(names).not.toContain("file_complaint");
  });

  it("files directly in auto mode", () => {
    const names = Object.keys(buildTools(ctx, { ...askMode, autonomy: "auto" }));
    expect(names).toContain("file_complaint");
    expect(names).not.toContain("confirm_and_file");
  });

  it("hides tools switched off in the control panel", () => {
    const names = Object.keys(buildTools(ctx, { ...askMode, disabledTools: ["escalate_complaint"] }));
    expect(names).not.toContain("escalate_complaint");
  });
});

describe("analyze_photo", () => {
  const photo = { issue_type: "pothole", severity: "high", title: "Pothole", description: "Big pothole", confidence: 0.9 };

  it("rejects photos that are not civic issues", async () => {
    expect(await call(askMode, "analyze_photo", { ...photo, is_civic_issue: false })).toEqual({ rejected: true, reason: "Not a civic issue" });
  });

  it("names the likely department for a civic issue", async () => {
    const out = await call(askMode, "analyze_photo", { ...photo, is_civic_issue: true });
    expect(out).toMatchObject({ rejected: false, likely_department: expect.any(String), needs_clarification: false });
  });

  it("asks for clarification when confidence is low", async () => {
    const out = await call(askMode, "analyze_photo", { ...photo, is_civic_issue: true, confidence: 0.3 });
    expect(out.needs_clarification).toBe(true);
  });

  it("writes every call to the agent action log", async () => {
    await call(askMode, "analyze_photo", { ...photo, is_civic_issue: true });
    expect((await readDb()).logs[0]).toMatchObject({ tool: "analyze_photo", ok: true });
  });
});

describe("locate_ward", () => {
  it("finds the ward from coordinates", async () => {
    expect(await call(askMode, "locate_ward", { lat: 23.0124, lng: 72.5626 })).toMatchObject({ found: true, ward_id: "paldi" });
  });

  it("finds the ward from an area name", async () => {
    expect(await call(askMode, "locate_ward", { area_name: "Navrangpura" })).toMatchObject({ found: true, ward_id: "navrangpura" });
  });

  it("asks for a location when nothing matches", async () => {
    expect(await call(askMode, "locate_ward", { area_name: "Atlantis" })).toMatchObject({ found: false });
  });
});

describe("route_department", () => {
  it("routes potholes to roads with the department SLA", async () => {
    expect(await call(askMode, "route_department", { issue_type: "pothole", severity: "high" })).toMatchObject({ department_id: "roads", sla_days: 7, priority: "normal" });
  });

  it("gives urgent issues a 1-day SLA", async () => {
    expect(await call(askMode, "route_department", { issue_type: "open_manhole", severity: "urgent" })).toMatchObject({ department_id: "drainage", sla_days: 1, priority: "URGENT (24h SLA)" });
  });
});

describe("check_duplicates + upvote_complaint", () => {
  it("finds the open waterlogging complaint near Mahalaxmi Cross Roads and upvotes it", async () => {
    const dupes = await call(askMode, "check_duplicates", { issue_type: "waterlogging", lat: 23.0125, lng: 72.5627 });
    expect(dupes.duplicates_found).toBeGreaterThan(0);
    const [first] = dupes.matches as { id: string; upvotes: number }[];
    expect(first.id).toBe("AMC-2026-00031");

    const up = await call(askMode, "upvote_complaint", { id: first.id });
    expect(up).toMatchObject({ ok: true, upvotes: first.upvotes + 1 });
  });

  it("finds nothing far away", async () => {
    expect(await call(askMode, "check_duplicates", { issue_type: "waterlogging", lat: 23.2, lng: 72.7 })).toMatchObject({ duplicates_found: 0 });
  });

  it("refuses to upvote an unknown complaint", async () => {
    expect(await call(askMode, "upvote_complaint", { id: "AMC-0" })).toMatchObject({ ok: false });
  });
});

describe("file_complaint (auto mode) + get_status", () => {
  it("files a complaint and reads its status back", async () => {
    const auto = { ...askMode, autonomy: "auto" as const };
    const filed = await call(auto, "file_complaint", {
      issue_type: "pothole",
      title: "Pothole at Paldi",
      description: "Deep pothole.",
      severity: "high",
      ward_id: "paldi",
      department_id: "roads",
      lat: 23.0124,
      lng: 72.5626,
    });
    const id = (filed.complaint as { id: string }).id;
    expect(id).toMatch(/^AMC-2026-\d{5}$/);

    expect(await call(auto, "get_status", { id: id.toLowerCase() })).toMatchObject({ found: true, id, status: "Filed" });
    expect(await call(auto, "get_status", {})).toMatchObject({ found: true, id });
    const mine = (await call(auto, "list_my_complaints", {})) as unknown as { id: string }[];
    expect(mine.map((c) => c.id)).toContain(id);
  });

  it("reports unknown IDs as not found", async () => {
    expect(await call(askMode, "get_status", { id: "AMC-9999-00000" })).toEqual({ found: false });
  });
});

describe("escalate_complaint", () => {
  it("escalates an open complaint to the zonal officer", async () => {
    const out = await call(askMode, "escalate_complaint", { id: "AMC-2026-00031", letter: "Please act." });
    expect(out).toMatchObject({ ok: true, escalated_to: expect.stringContaining("Deputy Commissioner") });
    expect((await readDb()).complaints.find((c) => c.id === "AMC-2026-00031")?.escalated).toBe(true);
  });

  it("refuses unknown complaints", async () => {
    expect(await call(askMode, "escalate_complaint", { id: "AMC-0", letter: "x" })).toMatchObject({ ok: false });
  });
});
