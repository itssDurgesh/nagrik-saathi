import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach } from "vitest";

// Every test gets its own live DB file, seeded from data/amc.json on first read.
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "nagrik-test-"));
  process.env.NAGRIK_DB_PATH = path.join(dir, "db.json");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.NAGRIK_DB_PATH;
});
