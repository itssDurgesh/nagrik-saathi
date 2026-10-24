import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isOverdue, istLabel, slaLabel } from "@/lib/format";

const NOW = new Date("2026-10-24T12:00:00.000Z");
const inHours = (h: number) => new Date(NOW.getTime() + h * 3600000).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("isOverdue", () => {
  it("is true for an open complaint past its due date", () => {
    expect(isOverdue({ status: "assigned", dueAt: inHours(-1) })).toBe(true);
  });

  it("is false before the due date", () => {
    expect(isOverdue({ status: "filed", dueAt: inHours(5) })).toBe(false);
  });

  it("is never true once resolved", () => {
    expect(isOverdue({ status: "resolved", dueAt: inHours(-100) })).toBe(false);
  });
});

describe("slaLabel", () => {
  it("shows days and hours remaining", () => {
    expect(slaLabel({ status: "filed", dueAt: inHours(52) })).toBe("due in 2d 4h");
  });

  it("shows only hours when under a day", () => {
    expect(slaLabel({ status: "filed", dueAt: inHours(5) })).toBe("due in 5h");
  });

  it("shows how far overdue", () => {
    expect(slaLabel({ status: "in_progress", dueAt: inHours(-73) })).toBe("3d 1h overdue");
  });

  it("says Resolved for resolved complaints", () => {
    expect(slaLabel({ status: "resolved", dueAt: inHours(-73) })).toBe("Resolved");
  });
});

describe("istLabel", () => {
  it("renders in Ahmedabad time", () => {
    // 12:00 UTC is 5:30 pm IST.
    expect(istLabel(NOW.toISOString())).toMatch(/5:30/);
  });
});
