import { promises as fs } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { createComplaint, readDb, resetDb, setStatus, slaDaysFor, updateDb, type NewComplaint } from "@/lib/store";

const pothole: NewComplaint = {
  issueType: "pothole",
  title: "Pothole near Stadium Circle",
  description: "Deep pothole in the left lane.",
  severity: "high",
  departmentId: "roads",
  wardId: "navrangpura",
  lat: 23.0365,
  lng: 72.5611,
};

const slaDays = (c: { createdAt: string; dueAt: string }) => (Date.parse(c.dueAt) - Date.parse(c.createdAt)) / 86400000;

describe("readDb", () => {
  it("seeds the live DB from data/amc.json on first read", async () => {
    const db = await readDb();
    expect(db.wards.length).toBeGreaterThan(0);
    expect(db.departments.map((d) => d.id)).toContain("roads");
    expect(await fs.readFile(process.env.NAGRIK_DB_PATH!, "utf8")).toContain('"wards"');
  });

  it("still returns the seed when the live DB cannot be written (read-only serverless bundle)", async () => {
    process.env.NAGRIK_DB_PATH = path.join(process.env.NAGRIK_DB_PATH!, "no-such-dir", "db.json");
    const db = await readDb();
    expect(db.complaints.length).toBeGreaterThan(0);
  });
});

describe("createComplaint", () => {
  it("assigns a sequential AMC tracking ID and stores the complaint", async () => {
    const before = (await readDb()).counter;
    const c = await createComplaint(pothole);
    expect(c.id).toBe(`AMC-2026-${String(before + 1).padStart(5, "0")}`);
    expect(c.status).toBe("filed");
    expect(c.reporter).toBe("me");
    expect(c.history[0].status).toBe("filed");

    const db = await readDb();
    expect(db.counter).toBe(before + 1);
    expect(db.complaints[0].id).toBe(c.id);
  });

  it("uses the department SLA for normal severity", async () => {
    expect(slaDays(await createComplaint(pothole))).toBe(7);
  });

  it("gives urgent issues a 24-hour SLA", async () => {
    const c = await createComplaint({ ...pothole, issueType: "open_manhole", departmentId: "drainage", severity: "urgent" });
    expect(slaDays(c)).toBe(1);
  });

  it("does not lose writes when complaints are filed concurrently", async () => {
    const before = (await readDb()).counter;
    const filed = await Promise.all([1, 2, 3, 4, 5].map(() => createComplaint(pothole)));
    expect(new Set(filed.map((c) => c.id)).size).toBe(5);
    expect((await readDb()).counter).toBe(before + 5);
  });
});

describe("slaDaysFor", () => {
  it("falls back to 7 days for an unknown department", async () => {
    expect(slaDaysFor(await readDb(), "nope", "low")).toBe(7);
  });
});

describe("setStatus", () => {
  it("moves a complaint and records the officer note", async () => {
    const c = await createComplaint(pothole);
    const updated = await setStatus(c.id, "in_progress", "Crew dispatched");
    expect(updated?.status).toBe("in_progress");
    expect(updated?.history.at(-1)).toMatchObject({ status: "in_progress", by: "officer", note: "Crew dispatched" });
  });

  it("returns null for an unknown ID", async () => {
    expect(await setStatus("AMC-0000", "resolved", "")).toBeNull();
  });
});

describe("resetDb", () => {
  it("restores the seed data", async () => {
    const seedCount = (await readDb()).complaints.length;
    await createComplaint(pothole);
    await updateDb((db) => {
      db.settings.autonomy = "auto";
    });
    await resetDb();
    const db = await readDb();
    expect(db.complaints.length).toBe(seedCount);
    expect(db.settings.autonomy).toBe("ask");
  });
});
