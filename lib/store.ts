import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { Complaint, Db, LogEntry, Severity, Status } from "./types";

// data/amc.json is the seed; data/db.json is the live mock AMC database.
// Serverless hosts (Vercel) ship a read-only bundle, so the live copy goes to /tmp there.
const SEED = path.join(process.cwd(), "data", "amc.json");
function dbPath() {
  if (process.env.NAGRIK_DB_PATH) return process.env.NAGRIK_DB_PATH;
  if (process.env.VERCEL) return path.join(os.tmpdir(), "nagrik-db.json");
  return path.join(process.cwd(), "data", "db.json");
}

// Serialise writes so concurrent tool calls don't clobber each other.
let queue: Promise<unknown> = Promise.resolve();

export async function readDb(): Promise<Db> {
  try {
    return JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ dbPath(), "utf8"));
  } catch {
    const seed = await fs.readFile(SEED, "utf8");
    // A failed copy must not take the agent down; reads still work from the seed.
    await fs.writeFile(/*turbopackIgnore: true*/ dbPath(), seed).catch((err) => console.error("Could not create live DB:", err));
    return JSON.parse(seed);
  }
}

export function updateDb<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    await fs.writeFile(/*turbopackIgnore: true*/ dbPath(), JSON.stringify(db, null, 2));
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

export async function resetDb() {
  await fs.writeFile(/*turbopackIgnore: true*/ dbPath(), await fs.readFile(SEED, "utf8"));
}

export async function addLog(entry: Omit<LogEntry, "id" | "at">) {
  await updateDb((db) => {
    db.logs.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), ...entry });
    db.logs = db.logs.slice(0, 200);
  });
}

export interface NewComplaint {
  issueType: string;
  title: string;
  description: string;
  severity: Severity;
  departmentId: string;
  wardId: string;
  lat: number;
  lng: number;
  thumb?: string;
}

export function slaDaysFor(db: Db, departmentId: string, severity: Severity) {
  if (severity === "urgent") return 1;
  return db.departments.find((d) => d.id === departmentId)?.slaDays ?? 7;
}

export function createComplaint(input: NewComplaint): Promise<Complaint> {
  return updateDb((db) => {
    db.counter += 1;
    const now = new Date();
    const due = new Date(now.getTime() + slaDaysFor(db, input.departmentId, input.severity) * 86400000);
    const complaint: Complaint = {
      ...input,
      id: `AMC-2026-${String(db.counter).padStart(5, "0")}`,
      reporter: "me",
      upvotes: 0,
      status: "filed",
      escalated: false,
      createdAt: now.toISOString(),
      dueAt: due.toISOString(),
      history: [{ status: "filed", at: now.toISOString(), by: "citizen", note: "Complaint filed via Nagrik Saathi" }],
    };
    db.complaints.unshift(complaint);
    return complaint;
  });
}

export function setStatus(id: string, status: Status, note: string) {
  return updateDb((db) => {
    const c = db.complaints.find((x) => x.id === id);
    if (!c) return null;
    c.status = status;
    c.history.push({ status, at: new Date().toISOString(), by: "officer", note: note || `Moved to ${status}` });
    return c;
  });
}
