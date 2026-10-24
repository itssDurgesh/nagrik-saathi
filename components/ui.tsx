import type { ReactNode } from "react";
import { STATUS_LABEL, type Severity, type Status } from "@/lib/types";

const TONE = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONE; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE[tone]}`}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<Status, keyof typeof TONE> = {
  filed: "info",
  assigned: "primary",
  in_progress: "warn",
  resolved: "ok",
};

export function StatusBadge({ status }: { status: Status }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

const SEVERITY_TONE: Record<Severity, keyof typeof TONE> = {
  low: "neutral",
  medium: "info",
  high: "accent",
  urgent: "danger",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge tone={SEVERITY_TONE[severity]}>{severity === "urgent" ? "⚠ Urgent" : severity}</Badge>;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-surface-2 p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            value === o.value ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
