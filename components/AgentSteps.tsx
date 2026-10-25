"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Clock, Loader2, X } from "lucide-react";

export interface ToolPart {
  type: string;
  toolCallId: string;
  state: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}

export const toolName = (p: ToolPart) => p.type.replace(/^tool-/, "");

// What the citizen sees for each agent step: [while running, when done].
const LABEL: Record<string, [string, string]> = {
  analyze_photo: ["Looking at your photo", "Spotted the issue"],
  locate_ward: ["Finding your ward", "Found your ward"],
  route_department: ["Picking the department", "Picked the department"],
  check_duplicates: ["Checking for duplicates", "Checked for duplicates"],
  upvote_complaint: ["Adding your +1", "Added your +1 to the existing report"],
  file_complaint: ["Filing with AMC", "Filed with AMC"],
  confirm_and_file: ["Preparing the draft", "Filed with AMC"],
  get_status: ["Checking live status", "Checked live status"],
  list_my_complaints: ["Loading your reports", "Loaded your reports"],
  escalate_complaint: ["Escalating", "Escalated"],
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** One plain-language line about what a finished step found. `warn` marks results worth a second look. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function summary(tool: string, out: any): { text: string; warn?: boolean } {
  if (!out) return { text: "" };
  switch (tool) {
    case "analyze_photo":
      return out.rejected
        ? { text: "This doesn't look like a civic issue", warn: true }
        : { text: `${out.issue} · ${out.severity === "urgent" ? "urgent, danger to life" : `${out.severity} priority`}`, warn: out.severity === "urgent" };
    case "locate_ward":
      return out.found ? { text: `${out.ward} · ${out.zone}` } : { text: "Need your location", warn: true };
    case "route_department":
      return out.priority?.startsWith("URGENT")
        ? { text: `${out.department} · fix within 24 hours`, warn: true }
        : { text: `${out.department} · fix within ${plural(out.sla_days, "day")}` };
    case "check_duplicates":
      return out.duplicates_found
        ? { text: `Already reported ${out.matches[0].metres_away} m away (${out.matches[0].id})`, warn: true }
        : { text: "No open report within 250 m" };
    case "upvote_complaint":
      return out.ok ? { text: `${out.id} · ${plural(out.upvotes, "person")} reported this` } : { text: out.error, warn: true };
    case "get_status":
      return out.found ? { text: `${out.id} · ${out.status}${out.overdue ? " · overdue" : ""}`, warn: out.overdue } : { text: "Couldn't find that complaint", warn: true };
    case "list_my_complaints":
      return { text: plural(Array.isArray(out) ? out.length : 0, "complaint") };
    case "escalate_complaint":
      return out.ok ? { text: `Sent to ${out.escalated_to}` } : { text: out.error, warn: true };
    case "file_complaint":
    case "confirm_and_file":
      return out.filed ? { text: `Ticket ${out.complaint?.id ?? ""}` } : { text: "You cancelled this draft", warn: true };
    default:
      return { text: "" };
  }
}

type RowState = "done" | "warn" | "active" | "waiting" | "failed";

function Marker({ state }: { state: RowState }) {
  const styles: Record<RowState, string> = {
    done: "bg-primary text-white",
    warn: "bg-accent-soft text-accent-ink",
    active: "bg-primary-soft text-primary",
    waiting: "bg-primary-soft text-primary",
    failed: "bg-danger-soft text-danger",
  };
  return (
    <span className={`relative grid place-items-center size-7 shrink-0 rounded-full ${styles[state]}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 26 }}
          className="grid place-items-center"
        >
          {state === "done" ? <Check className="size-4" strokeWidth={3} /> :
            state === "warn" ? <AlertTriangle className="size-3.5" /> :
            state === "failed" ? <X className="size-4" /> :
            state === "waiting" ? <Clock className="size-4" /> :
            <Loader2 className="size-4 animate-spin" />}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The agent's work for one turn, as a single checklist card. */
export function AgentSteps({ parts }: { parts: ToolPart[] }) {
  // A malformed call the model retried successfully is noise for a citizen; hide it.
  const visible = parts.filter(
    (p, i) => p.state !== "output-error" || !parts.slice(i + 1).some((q) => toolName(q) === toolName(p) && q.state === "output-available"),
  );
  const filing = visible.some((p) => ["analyze_photo", "confirm_and_file", "file_complaint"].includes(toolName(p)));
  const working = visible.some((p) => p.state === "input-streaming" || (p.state === "input-available" && toolName(p) !== "confirm_and_file"));

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-bold text-[17px]">{filing ? "Filing your report" : "Looking it up"}</h3>
        {working && <span className="text-xs font-semibold text-primary flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-primary pulse" />Working</span>}
      </div>
      <ol className="space-y-3">
        {visible.map((p) => {
          const tool = toolName(p);
          const done = p.state === "output-available";
          const failed = p.state === "output-error" || p.state === "output-denied";
          const waiting = tool === "confirm_and_file" && p.state === "input-available";
          const s = done ? summary(tool, p.output) : null;
          const state: RowState = failed ? "failed" : waiting ? "waiting" : done ? (s?.warn ? "warn" : "done") : "active";
          const [running, finished] = LABEL[tool] ?? ["Working", "Done"];
          const title = waiting ? "Waiting for you" : done ? finished : failed ? "Couldn't finish this step" : running;
          const detail = waiting ? "Check the details below, then file" : failed ? "The agent will try another way" : s?.text;
          return (
            <motion.li
              key={p.toolCallId}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="flex items-center gap-3"
            >
              <Marker state={state} />
              <div className="min-w-0">
                <div className={`font-semibold leading-snug ${done || waiting ? "" : "text-muted"}`}>{title}</div>
                {detail && <div className="text-sm text-muted">{detail}</div>}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
