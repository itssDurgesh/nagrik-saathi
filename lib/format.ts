import type { Complaint } from "./types";

export function isOverdue(c: Pick<Complaint, "status" | "dueAt">) {
  return c.status !== "resolved" && new Date(c.dueAt).getTime() < Date.now();
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Human date in Ahmedabad time, so the model never has to convert UTC itself. */
export function istLabel(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "in 2d 4h" / "3d overdue" */
export function slaLabel(c: Pick<Complaint, "status" | "dueAt">) {
  if (c.status === "resolved") return "Resolved";
  const diff = new Date(c.dueAt).getTime() - Date.now();
  const abs = Math.abs(diff);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const span = d > 0 ? `${d}d ${h}h` : `${h}h`;
  return diff < 0 ? `${span} overdue` : `due in ${span}`;
}
