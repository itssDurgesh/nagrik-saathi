"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Building2, Camera, Clock, MapPin, Megaphone, MessageCircle, Users } from "lucide-react";
import { Badge, SeverityBadge, Segmented, StatusBadge, StatusProgress } from "@/components/ui";
import { fmtDate, isOverdue, slaLabel } from "@/lib/format";
import { ISSUE_LABEL, type Complaint, type Department, type Ward } from "@/lib/types";

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 380, damping: 32 } } };

export default function ComplaintsPage() {
  const [data, setData] = useState<{ complaints: Complaint[]; wards: Ward[]; departments: Department[] } | null>(null);
  const [scope, setScope] = useState<"me" | "all">("me");

  useEffect(() => {
    const load = () => fetch("/api/complaints").then((r) => r.json()).then(setData).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const list = data?.complaints.filter((c) => scope === "all" || c.reporter === "me") ?? [];
  const stats = [
    { label: "Open", value: list.filter((c) => c.status !== "resolved").length, tone: "text-primary" },
    { label: "Overdue", value: list.filter(isOverdue).length, tone: "text-danger" },
    { label: "Fixed", value: list.filter((c) => c.status === "resolved").length, tone: "text-ok" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-[-0.02em] leading-tight">
            {scope === "me" ? "My reports" : "Reports across the city"}
          </h1>
          <p className="text-muted">Every complaint from filing to fixed. Updates every few seconds.</p>
        </div>
        <div className="w-full sm:w-72">
          <Segmented label="Show" value={scope} onChange={setScope} options={[{ value: "me", label: "Mine" }, { value: "all", label: "Whole city" }]} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-4 max-w-xl">
        {stats.map((s) => (
          <div key={s.label} className="card !shadow-none px-4 py-3">
            <div className={`text-2xl font-extrabold tabular-nums ${s.tone}`}>{data ? s.value : "–"}</div>
            <div className="text-sm text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {!data && (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="card h-60 animate-pulse" />)}
        </div>
      )}

      {data && list.length === 0 && (
        <div className="card p-10 text-center space-y-2">
          <p className="font-bold text-lg">No reports yet</p>
          <p className="text-muted">Spotted a pothole or overflowing bin? Report it in under a minute.</p>
          <Link href="/" className="btn btn-primary mt-3"><Camera className="size-[18px]" aria-hidden /> Report an issue</Link>
        </div>
      )}

      <motion.ul key={scope} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }} className="grid gap-4 md:grid-cols-2">
        {list.map((c) => {
          const ward = data?.wards.find((w) => w.id === c.wardId);
          const dept = data?.departments.find((d) => d.id === c.departmentId);
          const overdue = isOverdue(c);
          const last = c.history[c.history.length - 1];
          return (
            <motion.li key={c.id} variants={item} className="card p-4 sm:p-5 space-y-4">
              <div className="flex gap-3.5">
                {c.thumb ? (
                  <img src={c.thumb} alt="" className="size-16 sm:size-[72px] rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="size-16 sm:size-[72px] rounded-xl bg-surface-2 grid place-items-center shrink-0 text-muted"><MapPin className="size-6" aria-hidden /></div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={c.status} />
                    {overdue && <Badge tone="danger"><AlertTriangle className="size-3" aria-hidden />Overdue</Badge>}
                    {c.severity === "urgent" && <SeverityBadge severity="urgent" />}
                    {c.escalated && <Badge tone="accent"><Megaphone className="size-3" aria-hidden />Escalated</Badge>}
                  </div>
                  <h2 className="font-bold leading-snug">{c.title}</h2>
                  <p className="text-sm text-muted tabular-nums">{c.id} · {ISSUE_LABEL[c.issueType] ?? c.issueType} · filed {fmtDate(c.createdAt)}</p>
                </div>
              </div>

              <StatusProgress status={c.status} overdue={overdue} />

              <div className="grid gap-1.5 text-sm text-muted">
                <div className="flex items-center gap-2"><Building2 className="size-4 shrink-0" aria-hidden />{dept?.name}</div>
                <div className="flex items-center gap-2"><MapPin className="size-4 shrink-0" aria-hidden />{ward?.name} · {ward?.zone}</div>
                {c.upvotes > 0 && (
                  <div className="flex items-center gap-2"><Users className="size-4 shrink-0" aria-hidden />{c.upvotes} other {c.upvotes === 1 ? "citizen" : "citizens"} reported this</div>
                )}
              </div>

              <div className="rounded-xl bg-bg px-3.5 py-2.5">
                <div className="label">Latest update · {fmtDate(last.at)}</div>
                <div className="text-[15px] mt-0.5">{last.note}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`flex items-center gap-1.5 text-sm font-semibold mr-auto ${overdue ? "text-danger" : "text-muted"}`}>
                  <Clock className="size-4" aria-hidden /> {slaLabel(c).replace(/^./, (ch) => ch.toUpperCase())}
                </span>
                <Link href={`/?q=${encodeURIComponent(`What's the status of ${c.id}?`)}`} className="btn btn-ghost !min-h-10 !py-2 !text-sm">
                  <MessageCircle className="size-4" aria-hidden /> Ask status
                </Link>
                {overdue && !c.escalated && (
                  <Link href={`/?q=${encodeURIComponent(`${c.id} is overdue. Please escalate it.`)}`} className="btn btn-danger !min-h-10 !py-2 !text-sm">
                    <Megaphone className="size-4" aria-hidden /> Escalate
                  </Link>
                )}
              </div>
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}
