"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Building2, CheckCircle2, Copy, Eye, FileCheck2, List, Loader2, MapPin, Megaphone, Search, ThumbsUp, XCircle, type LucideIcon,
} from "lucide-react";

export interface ToolPart {
  type: string;
  toolCallId: string;
  state: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}

const META: Record<string, { label: string; icon: LucideIcon }> = {
  analyze_photo: { label: "Analysing photo", icon: Eye },
  locate_ward: { label: "Locating ward", icon: MapPin },
  route_department: { label: "Routing department", icon: Building2 },
  check_duplicates: { label: "Checking duplicates", icon: Search },
  upvote_complaint: { label: "Adding +1", icon: ThumbsUp },
  file_complaint: { label: "Filing complaint", icon: FileCheck2 },
  confirm_and_file: { label: "Waiting for your approval", icon: FileCheck2 },
  get_status: { label: "Fetching live status", icon: Search },
  list_my_complaints: { label: "Listing your complaints", icon: List },
  escalate_complaint: { label: "Escalating", icon: Megaphone },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function summary(tool: string, input: any, out: any): { text: string; warn?: boolean } {
  if (!out) return { text: "" };
  switch (tool) {
    case "analyze_photo":
      return out.rejected
        ? { text: "Not a civic issue", warn: true }
        : { text: `${out.issue} · ${out.severity} severity${out.needs_clarification ? " · unsure, asking you" : ""}`, warn: out.severity === "urgent" };
    case "locate_ward":
      return out.found ? { text: `${out.ward} · ${out.zone}` } : { text: "Location needed", warn: true };
    case "route_department":
      return { text: `${out.department} · SLA ${out.sla_days}d${out.priority?.startsWith("URGENT") ? " · URGENT" : ""}`, warn: out.priority?.startsWith("URGENT") };
    case "check_duplicates":
      return out.duplicates_found
        ? { text: `${out.duplicates_found} open report nearby: ${out.matches[0].id} (${out.matches[0].metres_away} m)`, warn: true }
        : { text: "No duplicates within 250 m" };
    case "upvote_complaint":
      return out.ok ? { text: `+1 on ${out.id} · ${out.upvotes} citizens` } : { text: out.error, warn: true };
    case "get_status":
      return out.found ? { text: `${out.id} · ${out.status}${out.overdue ? " · overdue" : ""}`, warn: out.overdue } : { text: "Not found", warn: true };
    case "list_my_complaints":
      return { text: `${Array.isArray(out) ? out.length : 0} complaints` };
    case "escalate_complaint":
      return out.ok ? { text: `Escalated to ${out.escalated_to}` } : { text: out.error, warn: true };
    case "file_complaint":
    case "confirm_and_file":
      return out.filed ? { text: `Filed ${out.complaint?.id ?? ""}` } : { text: out.reason ?? "Cancelled", warn: true };
    default:
      return { text: input ? JSON.stringify(input).slice(0, 80) : "" };
  }
}

export function StepCard({ part }: { part: ToolPart }) {
  const tool = part.type.replace(/^tool-/, "");
  const meta = META[tool] ?? { label: tool, icon: CheckCircle2 };
  const done = part.state === "output-available";
  const failed = part.state === "output-error" || part.state === "output-denied";
  const start = useRef(0);
  const [ms, setMs] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!start.current) start.current = performance.now();
  }, []);
  useEffect(() => {
    if ((done || failed) && ms === null && start.current) setMs(Math.round(performance.now() - start.current));
  }, [done, failed, ms]);

  const s = summary(tool, part.input, part.output);
  const label = tool === "confirm_and_file" && done ? "Your approval" : meta.label;
  const Icon = failed ? XCircle : s.warn ? AlertTriangle : meta.icon;

  return (
    <div className="rounded-xl border border-border bg-surface text-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left">
        <span
          className={`grid place-items-center size-7 rounded-lg shrink-0 ${
            failed ? "bg-danger-soft text-danger" : s.warn ? "bg-warn-soft text-warn" : done ? "bg-ok-soft text-ok" : "bg-primary-soft text-primary"
          }`}
        >
          {!done && !failed ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-tight">{label}</span>
          <span className="block text-xs text-muted truncate">
            {failed ? part.errorText ?? "Failed" : done ? s.text : "Working…"}
          </span>
        </span>
        <span className="text-[11px] font-mono text-muted shrink-0">{tool}{ms !== null && ` · ${ms}ms`}</span>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2 grid gap-2 text-xs">
          <div>
            <div className="font-semibold text-muted mb-1 flex items-center gap-1"><Copy className="size-3" />Input</div>
            <pre className="bg-surface-2 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(part.input, null, 2)}</pre>
          </div>
          {part.output !== undefined && (
            <div>
              <div className="font-semibold text-muted mb-1">Output</div>
              <pre className="bg-surface-2 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-60">{JSON.stringify(part.output, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
