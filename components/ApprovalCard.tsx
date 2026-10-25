"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="label">{label}</span>
      {children}
    </label>
  );
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
      className="rounded-[20px] border-2 border-primary bg-surface overflow-hidden shadow-card"
    >
      <div className="bg-primary-soft px-4 sm:px-5 py-3 flex items-center gap-2 text-primary">
        <ShieldCheck className="size-[18px]" aria-hidden />
        <h3 className="font-bold flex-1">Check before we file</h3>
        <span className="text-sm text-muted">Edit anything</span>
      </div>
      <div className="p-4 sm:p-5 grid gap-4 @xl:grid-cols-[150px_1fr]">
        {thumb && <img src={thumb} alt="Your photo of the issue" className="rounded-2xl w-full max-h-44 @xl:max-h-none aspect-[4/3] object-cover" />}
        <div className="grid gap-3.5">
          <Field label="Title">
            <input className="input font-semibold" value={d.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea className="input min-h-20 text-[15px]" value={d.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue">
              <select className="input" value={d.issue_type} onChange={(e) => set("issue_type", e.target.value)}>
                {ISSUE_TYPES.map((t) => <option key={t} value={t}>{ISSUE_LABEL[t]}</option>)}
              </select>
            </Field>
            <Field label="Severity">
              <select className="input" value={d.severity} onChange={(e) => set("severity", e.target.value as Severity)}>
                {(["low", "medium", "high", "urgent"] as const).map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Ward">
              <select className="input" value={d.ward_id} onChange={(e) => set("ward_id", e.target.value)}>
                {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <Field label="Department">
              <select className="input" value={d.department_id} onChange={(e) => set("department_id", e.target.value)}>
                {departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </div>
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex gap-2.5">
        <button
          type="button"
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
          {busy ? <Loader2 className="size-[18px] animate-spin" aria-hidden /> : <Check className="size-[18px]" aria-hidden />}
          {busy ? "Filing…" : "File complaint"}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
          <X className="size-[18px]" aria-hidden /> Cancel
        </button>
      </div>
    </motion.div>
  );
}
