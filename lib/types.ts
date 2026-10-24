export type Status = "filed" | "assigned" | "in_progress" | "resolved";
export type Severity = "low" | "medium" | "high" | "urgent";
export type Language = "en" | "hi" | "gu";
export type Autonomy = "ask" | "auto";

export interface Ward {
  id: string;
  name: string;
  zone: string;
  lat: number;
  lng: number;
  office: string;
  zonalOfficer: string;
}

export interface Department {
  id: string;
  name: string;
  slaDays: number;
  issues: string[];
}

export interface HistoryEntry {
  status: Status | "escalated" | "upvoted";
  at: string;
  by: "citizen" | "officer" | "agent";
  note: string;
}

export interface Complaint {
  id: string;
  issueType: string;
  title: string;
  description: string;
  severity: Severity;
  departmentId: string;
  wardId: string;
  lat: number;
  lng: number;
  reporter: "me" | "other";
  upvotes: number;
  status: Status;
  escalated: boolean;
  createdAt: string;
  dueAt: string;
  history: HistoryEntry[];
  thumb?: string;
}

export interface Settings {
  autonomy: Autonomy;
  language: Language;
  tone: "simple" | "formal";
  disabledTools: string[];
}

export interface LogEntry {
  id: string;
  at: string;
  tool: string;
  input: unknown;
  output: unknown;
  ms: number;
  ok: boolean;
}

export interface Db {
  settings: Settings;
  counter: number;
  wards: Ward[];
  departments: Department[];
  complaints: Complaint[];
  logs: LogEntry[];
}

export const STATUSES: Status[] = ["filed", "assigned", "in_progress", "resolved"];

export const STATUS_LABEL: Record<Status, string> = {
  filed: "Filed",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
};

export const ISSUE_TYPES = [
  "pothole",
  "damaged_road",
  "broken_footpath",
  "garbage",
  "overflowing_bin",
  "dead_animal",
  "streetlight",
  "fallen_wire",
  "waterlogging",
  "blocked_drain",
  "open_manhole",
  "water_leak",
  "encroachment",
  "other",
] as const;

export const ISSUE_LABEL: Record<string, string> = {
  pothole: "Pothole",
  damaged_road: "Damaged road",
  broken_footpath: "Broken footpath",
  garbage: "Garbage dump",
  overflowing_bin: "Overflowing bin",
  dead_animal: "Dead animal",
  streetlight: "Broken streetlight",
  fallen_wire: "Fallen electric wire",
  waterlogging: "Waterlogging",
  blocked_drain: "Blocked drain",
  open_manhole: "Open manhole",
  water_leak: "Water leak",
  encroachment: "Encroachment",
  other: "Other civic issue",
};
