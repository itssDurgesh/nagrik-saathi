import { afterEach, describe, expect, it } from "vitest";
import { POST as agentPOST } from "@/app/api/agent/route";
import { PATCH as complaintPATCH } from "@/app/api/complaints/[id]/route";
import { GET as complaintsGET, POST as complaintsPOST } from "@/app/api/complaints/route";
import { DELETE as settingsDELETE, GET as settingsGET, PATCH as settingsPATCH } from "@/app/api/settings/route";

const json = (body: unknown, method = "POST") =>
  new Request("http://localhost/api", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const newComplaint = {
  issueType: "garbage",
  title: "Garbage pile at Paldi",
  description: "Overflowing garbage.",
  severity: "medium",
  departmentId: "swm",
  wardId: "paldi",
  lat: 23.0124,
  lng: 72.5626,
};

describe("POST /api/agent", () => {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  afterEach(() => {
    if (key === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    else process.env.GOOGLE_GENERATIVE_AI_API_KEY = key;
  });

  it("returns a readable JSON error when the Gemini key is missing", async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const res = await agentPOST(json({ messages: [] }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/GOOGLE_GENERATIVE_AI_API_KEY/);
  });
});

describe("/api/complaints", () => {
  it("lists complaints, wards and departments", async () => {
    const body = await (await complaintsGET()).json();
    expect(body.complaints.length).toBeGreaterThan(0);
    expect(body.wards.length).toBeGreaterThan(0);
    expect(body.departments.length).toBeGreaterThan(0);
  });

  it("files an approved draft and logs it", async () => {
    const { complaint } = await (await complaintsPOST(json(newComplaint))).json();
    expect(complaint.id).toMatch(/^AMC-2026-\d{5}$/);
    const { logs } = await (await settingsGET()).json();
    expect(logs[0]).toMatchObject({ tool: "confirm_and_file", ok: true });
  });

  it("lets an officer move a ticket", async () => {
    const { complaint } = await (await complaintsPOST(json(newComplaint))).json();
    const res = await complaintPATCH(json({ status: "assigned", note: "Team sent" }, "PATCH"), { params: Promise.resolve({ id: complaint.id }) });
    expect((await res.json()).complaint.status).toBe("assigned");
  });

  it("404s for an unknown ticket", async () => {
    const res = await complaintPATCH(json({ status: "assigned" }, "PATCH"), { params: Promise.resolve({ id: "AMC-0" }) });
    expect(res.status).toBe(404);
  });
});

describe("/api/settings", () => {
  it("updates settings and resets to the seed", async () => {
    const { settings } = await (await settingsPATCH(json({ autonomy: "auto", language: "gu" }, "PATCH"))).json();
    expect(settings).toMatchObject({ autonomy: "auto", language: "gu", tone: "simple" });

    await settingsDELETE();
    expect((await (await settingsGET()).json()).settings).toMatchObject({ autonomy: "ask", language: "en" });
  });
});
