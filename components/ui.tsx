"use client";

import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { STATUSES, STATUS_LABEL, type Severity, type Status } from "@/lib/types";

const TONE = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent-ink",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONE; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${TONE[tone]}`}>
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
  return (
    <Badge tone={STATUS_TONE[status]}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

const SEVERITY_TONE: Record<Severity, keyof typeof TONE> = {
  low: "neutral",
  medium: "info",
  high: "accent",
  urgent: "danger",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge tone={SEVERITY_TONE[severity]}>{severity === "urgent" ? "Urgent" : `${severity[0].toUpperCase()}${severity.slice(1)} priority`}</Badge>;
}

/** Four-step status bar: filed → assigned → in progress → resolved. */
export function StatusProgress({ status, overdue }: { status: Status; overdue?: boolean }) {
  const current = STATUSES.indexOf(status);
  return (
    <div
      role="img"
      aria-label={`Step ${current + 1} of ${STATUSES.length}: ${STATUS_LABEL[status]}`}
      className="flex gap-1"
    >
      {STATUSES.map((s, i) => (
        <span key={s} className="h-1.5 flex-1 rounded-full bg-surface-2 overflow-hidden">
          {i <= current && (
            <motion.span
              className={`block h-full rounded-full ${status === "resolved" ? "bg-ok" : overdue ? "bg-danger" : "bg-primary"}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              style={{ originX: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
        </span>
      ))}
    </div>
  );
}

/** Title block shared by every page: eyebrow chip, heading, one-line description, optional actions. */
export function PageHeader({
  eyebrow,
  icon: Icon,
  title,
  description,
  children,
}: {
  eyebrow: string;
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex-1 min-w-64 space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft text-accent-ink px-3 py-1 text-xs font-semibold">
          <Icon className="size-3.5" aria-hidden /> {eyebrow}
        </span>
        <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-[-0.02em] leading-tight text-balance">{title}</h1>
        <p className="text-muted max-w-2xl">{description}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-2xl bg-surface-2 p-1 gap-1">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`relative flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
              on ? "text-primary" : "text-muted hover:text-text"
            }`}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-xl bg-surface shadow-card"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
