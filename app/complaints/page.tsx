"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Building2, MapPin, Megaphone, MessageSquare, Radio, ThumbsUp } from "lucide-react";
import { StatusTimeline } from "@/components/StatusTimeline";
import { Badge, PageHeader, SeverityBadge, Segmented, StatusBadge } from "@/components/ui";
import { fmtDate, isOverdue, slaLabel } from "@/lib/format";
import { ISSUE_LABEL, type Complaint, type Department, type Ward } from "@/lib/types";

export default function ComplaintsPage() {
  const [data, setData] = useState<{ complaints: Complaint[]; wards: Ward[]; departments: Department[] } | null>(null);
  const [scope, setScope] = useState<"me" | "all">("me");

  useEffect(() => {
    const load = () => fetch("/api/complaints").then((r) => r.json()).then(setData);
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <div className="card h-64 animate-pulse" />;
  const list = data.complaints.filter((c) => scope === "all" || c.reporter === "me");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Live from the AMC system"
        icon={Radio}
        title={scope === "me" ? "My complaints" : "All complaints in the city"}
        description="Track every report from filing to fix. Updates every few seconds."
      >
        <Segmented value={scope} onChange={setScope} options={[{ value: "me", label: "Mine" }, { value: "all", label: "Whole city" }]} />
      </PageHeader>

      {list.length === 0 && (
        <div className="card p-10 text-center">
          <p className="font-semibold">No complaints yet</p>
          <p className="text-sm text-muted mt-1">Report your first issue in under a minute.</p>
          <Link href="/" className="btn btn-primary mt-4">Report an issue</Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {list.map((c) => {
          const ward = data.wards.find((w) => w.id === c.wardId);
          const dept = data.departments.find((d) => d.id === c.departmentId);
          const overdue = isOverdue(c);
          const last = c.history[c.history.length - 1];
          return (
            <article key={c.id} className="card p-4 space-y-3">
              <div className="flex gap-3">
                {c.thumb ? (
                  <img src={c.thumb} alt="" className="size-16 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="size-16 rounded-xl bg-surface-2 grid place-items-center text-2xl shrink-0">📍</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs text-muted">{c.id}</span>
                    <StatusBadge status={c.status} />
                    <SeverityBadge severity={c.severity} />
                    {c.escalated && <Badge tone="danger"><Megaphone className="size-3" />Escalated</Badge>}
                  </div>
                  <h2 className="font-semibold leading-snug mt-1">{c.title}</h2>
                  <div className="text-xs text-muted">{ISSUE_LABEL[c.issueType]} · filed {fmtDate(c.createdAt)}</div>
                </div>
              </div>

              <StatusTimeline status={c.status} />

              <div className="grid gap-1 text-xs text-muted">
                <div className="flex items-center gap-1.5"><Building2 className="size-3.5" />{dept?.name}</div>
                <div className="flex items-center gap-1.5"><MapPin className="size-3.5" />{ward?.name} · {ward?.zone}</div>
                {c.upvotes > 0 && <div className="flex items-center gap-1.5"><ThumbsUp className="size-3.5" />{c.upvotes} other {c.upvotes === 1 ? "citizen" : "citizens"} reported this</div>}
              </div>

              <div className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <div className="text-[11px] font-semibold text-muted uppercase tracking-wide">Latest update · {fmtDate(last.at)}</div>
                <div>{last.note}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-semibold flex items-center gap-1 ${overdue ? "text-danger" : "text-muted"}`}>
                  {overdue && <AlertTriangle className="size-3.5" />} {slaLabel(c)}
                </span>
                <div className="ml-auto flex gap-2">
                  <Link href={`/?q=${encodeURIComponent(`What's the status of ${c.id}?`)}`} className="btn btn-ghost !min-h-0 !py-1.5">
                    <MessageSquare className="size-4" /> Ask agent
                  </Link>
                  {overdue && !c.escalated && (
                    <Link href={`/?q=${encodeURIComponent(`${c.id} is overdue. Please escalate it.`)}`} className="btn btn-danger !min-h-0 !py-1.5">
                      <Megaphone className="size-4" /> Escalate
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
