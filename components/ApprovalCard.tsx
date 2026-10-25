"use client";

import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { ISSUE_LABEL, ISSUE_TYPES, type Department, type Severity, type Ward } from "@/lib/types";

export interface Draft {
  issue_type: string;
  title: string;
  description: string;
  severity: Severity;
  ward_id: string;
  department_id: string;
  lat: number;
  lng: number;
}

export function ApprovalCard({
  draft,
  wards,
  departments,
  thumb,
  onApprove,
  onCancel,
}: {
  draft: Draft;
  wards: Ward[];
  departments: Department[];
  thumb?: string;
  onApprove: (d: Draft) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState(draft);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  return (
    <div className="rounded-2xl border-2 border-primary/45 bg-surface overflow-hidden shadow-sm">
      <div className="bg-primary-soft px-4 py-2.5 flex flex-wrap items-center gap-2 text-primary">
        <ShieldCheck className="size-4" />
        <span className="text-sm font-semibold">Review before filing</span>
        <span className="ml-auto text-[11px] text-muted">Ask-me-first mode · edit anything</span>
      </div>
      {/* Breakpoints follow the chat column's width (@container), not the window, so fields never get squeezed. */}
      <div className="p-4 grid gap-3 @xl:grid-cols-[132px_1fr]">
        {thumb && <img src={thumb} alt="Reported issue" className="rounded-xl w-full max-h-40 @xl:w-[132px] @xl:max-h-none aspect-[4/3] object-cover" />}
        <div className="grid gap-2.5">
          <label className="grid gap-1 text-xs font-semibold text-muted">
            Title
            <input className="input" value={d.title} onChange={(e) => set("title", e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted">
            Description
            <textarea className="input min-h-16" value={d.description} onChange={(e) => set("description", e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs font-semibold text-muted">
              Issue
              <select className="input" value={d.issue_type} onChange={(e) => set("issue_type", e.target.value)}>
                {ISSUE_TYPES.map((t) => <option key={t} value={t}>{ISSUE_LABEL[t]}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted">
              Severity
              <select className="input" value={d.severity} onChange={(e) => set("severity", e.target.value as Severity)}>
                {["low", "medium", "high", "urgent"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted">
              Ward
              <select className="input" value={d.ward_id} onChange={(e) => set("ward_id", e.target.value)}>
                {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted">
              Department
              <select className="input" value={d.department_id} onChange={(e) => set("department_id", e.target.value)}>
                {departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 flex gap-2">
        <button
          className="btn btn-primary flex-1"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onApprove(d);
            } finally {
              setBusy(false);
            }
          }}
        >
          <ShieldCheck className="size-4" /> {busy ? "Filing…" : "Approve & file"}
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={onCancel}>
          <X className="size-4" /> Cancel
        </button>
      </div>
    </div>
  );
}
