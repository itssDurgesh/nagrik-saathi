import { tool } from "ai";
import { z } from "zod";
import { findWardByName, nearestWard, distanceM } from "./geo";
import { addLog, createComplaint, readDb, slaDaysFor, updateDb } from "./store";
import { isOverdue, istLabel } from "./format";
import { ISSUE_LABEL, ISSUE_TYPES, STATUS_LABEL, type Complaint, type Db, type Settings } from "./types";

export interface AgentContext {
  location: { lat: number; lng: number; source: string } | null;
  thumb?: string;
}

const issueType = z.enum(ISSUE_TYPES);
const severity = z.enum(["low", "medium", "high", "urgent"]);

const complaintFields = z.object({
  issue_type: issueType,
  title: z.string().describe("Short title, max 8 words, include a landmark if known"),
  description: z.string().describe("1-2 sentence description of what is visible and why it matters"),
  severity,
  ward_id: z.string(),
  department_id: z.string(),
  lat: z.number(),
  lng: z.number(),
});

/** Wraps a tool's execute so every call lands in the agent log shown on /agent. */
function logged<I, O>(name: string, fn: (input: I) => Promise<O>) {
  return async (input: I) => {
    const start = Date.now();
    try {
      const output = await fn(input);
      await addLog({ tool: name, input, output, ms: Date.now() - start, ok: true });
      return output;
    } catch (err) {
      await addLog({ tool: name, input, output: String(err), ms: Date.now() - start, ok: false });
      throw err;
    }
  };
}

function summarize(db: Db, c: Complaint) {
  const ward = db.wards.find((w) => w.id === c.wardId);
  const dept = db.departments.find((d) => d.id === c.departmentId);
  const history = c.history.map((h) => ({ ...h, at: istLabel(h.at) }));
  return {
    id: c.id,
    title: c.title,
    issue: ISSUE_LABEL[c.issueType] ?? c.issueType,
    status: STATUS_LABEL[c.status],
    escalated: c.escalated,
    overdue: isOverdue(c),
    upvotes: c.upvotes,
    ward: ward?.name,
    ward_office: ward?.office,
    department: dept?.name,
    filed_ist: istLabel(c.createdAt),
    due_ist: istLabel(c.dueAt),
    due_at: c.dueAt,
    latest_update: history[history.length - 1],
    history,
  };
}

export function buildTools(ctx: AgentContext, settings: Settings) {
  const tools = {
    analyze_photo: tool({
      description:
        "ALWAYS call first when the user shares a photo. Record what you see in the photo: whether it is a civic issue, its type, severity and a short description.",
      inputSchema: z.object({
        is_civic_issue: z.boolean().describe("false for selfies, food, pets, documents, or anything that is not a public civic problem"),
        issue_type: issueType,
        severity: severity.describe("urgent = immediate danger to life (open manhole, fallen live wire, deep flooding)"),
        title: z.string(),
        description: z.string(),
        confidence: z.number().min(0).max(1),
      }),
      execute: logged("analyze_photo", async (input) => {
        if (!input.is_civic_issue) return { rejected: true, reason: "Not a civic issue" };
        const db = await readDb();
        const dept = db.departments.find((d) => d.issues.includes(input.issue_type));
        return {
          rejected: false,
          issue: ISSUE_LABEL[input.issue_type],
          severity: input.severity,
          likely_department: dept?.name,
          needs_clarification: input.confidence < 0.6,
        };
      }),
    }),

    locate_ward: tool({
      description:
        "Find the AMC ward for a location. Pass lat/lng when the user's location is known, otherwise an area or landmark name in Ahmedabad.",
      inputSchema: z.object({
        lat: z.number().optional(),
        lng: z.number().optional(),
        area_name: z.string().optional(),
      }),
      execute: logged("locate_ward", async ({ lat, lng, area_name }) => {
        const db = await readDb();
        if (lat != null && lng != null) {
          const { ward, distanceM } = nearestWard(db.wards, lat, lng);
          return { found: true, ward_id: ward.id, ward: ward.name, zone: ward.zone, office: ward.office, lat, lng, km_from_ward_centre: +(distanceM / 1000).toFixed(1) };
        }
        const ward = area_name ? findWardByName(db.wards, area_name) : undefined;
        if (!ward) return { found: false, hint: "Ask the user to share their location or drop a pin on the map." };
        return { found: true, ward_id: ward.id, ward: ward.name, zone: ward.zone, office: ward.office, lat: ward.lat, lng: ward.lng };
      }),
    }),

    route_department: tool({
      description: "Pick the responsible AMC department and SLA for an issue type.",
      inputSchema: z.object({ issue_type: issueType, severity }),
      execute: logged("route_department", async ({ issue_type, severity }) => {
        const db = await readDb();
        const dept = db.departments.find((d) => d.issues.includes(issue_type)) ?? db.departments.find((d) => d.id === "estate")!;
        const slaDays = slaDaysFor(db, dept.id, severity);
        return { department_id: dept.id, department: dept.name, sla_days: slaDays, priority: severity === "urgent" ? "URGENT (24h SLA)" : "normal" };
      }),
    }),

    check_duplicates: tool({
      description: "Check for open complaints of the same kind within 250 m before filing a new one.",
      inputSchema: z.object({ issue_type: issueType, lat: z.number(), lng: z.number() }),
      execute: logged("check_duplicates", async ({ issue_type, lat, lng }) => {
        const db = await readDb();
        const dept = db.departments.find((d) => d.issues.includes(issue_type));
        const matches = db.complaints
          .filter((c) => c.status !== "resolved" && (c.issueType === issue_type || c.departmentId === dept?.id))
          .map((c) => ({ c, d: distanceM(lat, lng, c.lat, c.lng) }))
          .filter((m) => m.d <= 250)
          .sort((a, b) => a.d - b.d)
          .map(({ c, d }) => ({ id: c.id, title: c.title, status: STATUS_LABEL[c.status], upvotes: c.upvotes, metres_away: Math.round(d) }));
        return matches.length
          ? { duplicates_found: matches.length, matches, next_step: `Call upvote_complaint with id ${matches[0].id} now, before replying.` }
          : { duplicates_found: 0, matches };
      }),
    }),

    upvote_complaint: tool({
      description: "Add the user's +1 to an existing open complaint instead of filing a duplicate.",
      inputSchema: z.object({ id: z.string() }),
      execute: logged("upvote_complaint", async ({ id }) =>
        updateDb((db) => {
          const c = db.complaints.find((x) => x.id === id);
          if (!c) return { ok: false, error: "No such complaint" };
          c.upvotes += 1;
          c.history.push({ status: "upvoted", at: new Date().toISOString(), by: "citizen", note: `Another citizen reported the same issue (+1, total ${c.upvotes})` });
          return { ok: true, id: c.id, upvotes: c.upvotes, status: STATUS_LABEL[c.status] };
        }),
      ),
    }),

    // Ask mode: no execute, so the browser shows an editable approval card and files on approve.
    confirm_and_file: tool({
      description:
        "Show the user the complaint draft for approval. The user can edit fields, then it is filed. Returns { filed, complaint } or { filed: false, reason }.",
      inputSchema: complaintFields,
    }),

    // Auto mode: files straight away.
    file_complaint: tool({
      description: "File the complaint in the AMC system and get a tracking ID.",
      inputSchema: complaintFields,
      execute: logged("file_complaint", async (f) => {
        const c = await createComplaint({
          issueType: f.issue_type,
          title: f.title,
          description: f.description,
          severity: f.severity,
          departmentId: f.department_id,
          wardId: f.ward_id,
          lat: f.lat,
          lng: f.lng,
          thumb: ctx.thumb,
        });
        return { filed: true, complaint: summarize(await readDb(), c) };
      }),
    }),

    get_status: tool({
      description: "Get the live status of a complaint by ID. Omit id to get the user's most recent complaint.",
      inputSchema: z.object({ id: z.string().optional() }),
      execute: logged("get_status", async ({ id }) => {
        const db = await readDb();
        const c = id
          ? db.complaints.find((x) => x.id.toLowerCase() === id.toLowerCase().trim())
          : db.complaints.filter((x) => x.reporter === "me").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        if (!c) return { found: false };
        return { found: true, ...summarize(db, c) };
      }),
    }),

    list_my_complaints: tool({
      description: "List all complaints filed by this user with their current status.",
      inputSchema: z.object({}),
      execute: logged("list_my_complaints", async () => {
        const db = await readDb();
        return db.complaints
          .filter((c) => c.reporter === "me")
          .map((c) => ({ id: c.id, title: c.title, status: STATUS_LABEL[c.status], overdue: isOverdue(c), escalated: c.escalated }));
      }),
    }),

    escalate_complaint: tool({
      description: "Escalate an overdue complaint to the zonal Deputy Commissioner. Include a short, polite escalation letter.",
      inputSchema: z.object({ id: z.string(), letter: z.string().describe("3-5 sentence escalation letter in English") }),
      execute: logged("escalate_complaint", async ({ id, letter }) =>
        updateDb((db) => {
          const c = db.complaints.find((x) => x.id === id);
          if (!c) return { ok: false, error: "No such complaint" };
          if (c.status === "resolved") return { ok: false, error: "Already resolved" };
          const ward = db.wards.find((w) => w.id === c.wardId)!;
          c.escalated = true;
          c.history.push({ status: "escalated", at: new Date().toISOString(), by: "agent", note: `Escalated to ${ward.zonalOfficer}: ${letter}` });
          return { ok: true, id: c.id, escalated_to: ward.zonalOfficer, was_overdue: isOverdue(c) };
        }),
      ),
    }),
  };

  // Autonomy decides which filing tool exists; the control panel can switch tools off entirely.
  const hidden = new Set(settings.disabledTools);
  hidden.add(settings.autonomy === "ask" ? "file_complaint" : "confirm_and_file");
  return Object.fromEntries(Object.entries(tools).filter(([name]) => !hidden.has(name))) as Partial<typeof tools>;
}
