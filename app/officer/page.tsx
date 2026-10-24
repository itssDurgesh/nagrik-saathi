"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Building2, Map as MapIcon, MapPin, Megaphone, ThumbsUp, X } from "lucide-react";
import { Badge, SeverityBadge, StatusBadge } from "@/components/ui";
import { fmtDate, isOverdue, slaLabel } from "@/lib/format";
import { ISSUE_LABEL, STATUSES, STATUS_LABEL, type Complaint, type Department, type Status, type Ward } from "@/lib/types";

const MapPicker = dynamic(() => import("@/components/MapPicker"), { ssr: false });

const STATUS_COLOR: Record<Status, string> = { filed: "#0369a1", assigned: "#4338ca", in_progress: "#b45309", resolved: "#15803d" };

export default function OfficerPage() {
  const [data, setData] = useState<{ complaints: Complaint[]; wards: Ward[]; departments: Department[] } | null>(null);
  const [dept, setDept] = useState("all");
  const [ward, setWard] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [dragOver, setDragOver] = useState<Status | null>(null);

  const load = useCallback(() => fetch("/api/complaints").then((r) => r.json()).then(setData), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function move(id: string, status: Status, note = "") {
    await fetch(`/api/complaints/${id}`, { method: "PATCH", body: JSON.stringify({ status, note }) });
    load();
  }

  if (!data) return <div className="card h-96 animate-pulse" />;

  const list = data.complaints.filter((c) => (dept === "all" || c.departmentId === dept) && (ward === "all" || c.wardId === ward));
  const open = data.complaints.find((c) => c.id === openId);
  const stats = [
    { label: "Open", value: data.complaints.filter((c) => c.status !== "resolved").length, tone: "text-primary" },
    { label: "Overdue", value: data.complaints.filter(isOverdue).length, tone: "text-danger" },
    { label: "Escalated", value: data.complaints.filter((c) => c.escalated && c.status !== "resolved").length, tone: "text-accent" },
    { label: "Resolved", value: data.complaints.filter((c) => c.status === "resolved").length, tone: "text-ok" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-accent">Mock AMC staff console</div>
          <h1 className="text-2xl font-bold tracking-tight">Complaint board</h1>
          <p className="text-sm text-muted">Drag a card to change its status. The citizen&apos;s agent reads changes live.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input !w-auto" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">All departments</option>
            {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="input !w-auto" value={ward} onChange={(e) => setWard(e.target.value)}>
            <option value="all">All wards</option>
            {data.wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <button className="btn btn-ghost" onClick={() => setShowMap((s) => !s)}>
            <MapIcon className="size-4" /> {showMap ? "Hide map" : "City map"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <div className="text-xs text-muted font-semibold">{s.label}</div>
            <div className={`text-2xl font-bold ${s.tone}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {showMap && (
        <div className="card p-3">
          <MapPicker
            height={320}
            points={list.map((c) => ({ lat: c.lat, lng: c.lng, color: STATUS_COLOR[c.status], label: `${c.id} · ${c.title} (${STATUS_LABEL[c.status]})` }))}
          />
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted">
            {STATUSES.map((s) => (
              <span key={s} className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[s]}</span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {STATUSES.map((s) => {
          const col = list.filter((c) => c.status === s);
          return (
            <section
              key={s}
              onDragOver={(e) => { e.preventDefault(); setDragOver(s); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData("text/plain");
                const c = data.complaints.find((x) => x.id === id);
                if (c && c.status !== s) move(id, s);
              }}
              className={`rounded-2xl p-2 min-h-48 transition ${dragOver === s ? "bg-primary-soft ring-2 ring-primary" : "bg-surface-2"}`}
            >
              <div className="flex items-center justify-between px-2 py-1.5">
                <StatusBadge status={s} />
                <span className="text-xs font-semibold text-muted">{col.length}</span>
              </div>
              <div className="space-y-2">
                {col.map((c) => {
                  const w = data.wards.find((x) => x.id === c.wardId);
                  const overdue = isOverdue(c);
                  return (
                    <button
                      key={c.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                      onClick={() => setOpenId(c.id)}
                      className={`card w-full text-left p-3 cursor-grab active:cursor-grabbing hover:border-primary transition ${overdue ? "!border-danger/50" : ""}`}
                    >
                      <div className="flex gap-2.5">
                        {c.thumb && <img src={c.thumb} alt="" className="size-12 rounded-lg object-cover shrink-0" />}
                        <div className="min-w-0">
                          <div className="font-mono text-[11px] text-muted">{c.id}</div>
                          <div className="text-sm font-semibold leading-snug line-clamp-2">{c.title}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <SeverityBadge severity={c.severity} />
                        {c.escalated && <Badge tone="danger"><Megaphone className="size-3" />Escalated</Badge>}
                        {c.upvotes > 0 && <Badge><ThumbsUp className="size-3" />{c.upvotes}</Badge>}
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[11px] text-muted">
                        <span>{w?.name}</span>
                        <span className={overdue ? "text-danger font-semibold" : ""}>{slaLabel(c)}</span>
                      </div>
                    </button>
                  );
                })}
                {col.length === 0 && <div className="text-xs text-muted text-center py-6">Drop cards here</div>}
              </div>
            </section>
          );
        })}
      </div>

      {open && (
        <Drawer
          c={open}
          ward={data.wards.find((w) => w.id === open.wardId)}
          dept={data.departments.find((d) => d.id === open.departmentId)}
          onClose={() => setOpenId(null)}
          onSave={async (status, note) => {
            await move(open.id, status, note);
          }}
        />
      )}
    </div>
  );
}

function Drawer({
  c, ward, dept, onClose, onSave,
}: {
  c: Complaint;
  ward?: Ward;
  dept?: Department;
  onClose: () => void;
  onSave: (status: Status, note: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<Status>(c.status);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-[2000] flex justify-end bg-black/40" onClick={onClose}>
      <aside className="w-full max-w-md h-full bg-surface overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <div className="font-mono text-xs text-muted">{c.id}</div>
            <h2 className="text-lg font-bold leading-snug">{c.title}</h2>
          </div>
          <button className="btn btn-ghost !px-2" aria-label="Close" onClick={onClose}><X className="size-4" /></button>
        </div>
        {c.thumb && <img src={c.thumb} alt="" className="w-full rounded-xl" />}
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={c.status} />
          <SeverityBadge severity={c.severity} />
          {isOverdue(c) && <Badge tone="danger"><AlertTriangle className="size-3" />{slaLabel(c)}</Badge>}
        </div>
        <p className="text-sm">{c.description}</p>
        <div className="grid gap-1 text-sm text-muted">
          <div className="flex items-center gap-2"><Building2 className="size-4" />{dept?.name} · {ISSUE_LABEL[c.issueType]}</div>
          <div className="flex items-center gap-2"><MapPin className="size-4" />{ward?.name}, {ward?.zone} · {c.lat.toFixed(4)}, {c.lng.toFixed(4)}</div>
        </div>

        <div className="card p-3 space-y-2">
          <div className="text-sm font-semibold">Update status</div>
          <div className="grid grid-cols-2 gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold border ${status === s ? "border-primary bg-primary-soft text-primary" : "border-border"}`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <textarea
            className="input min-h-20"
            placeholder="Note for the citizen, e.g. “Team dispatched, will fix by tomorrow 5 PM”"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            className="btn btn-primary w-full"
            disabled={saving || (status === c.status && !note.trim())}
            onClick={async () => {
              setSaving(true);
              await onSave(status, note.trim());
              setNote("");
              setSaving(false);
            }}
          >
            {saving ? "Saving…" : "Save update"}
          </button>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">History</div>
          <ol className="relative border-l border-border ml-2 space-y-3">
            {[...c.history].reverse().map((h, i) => (
              <li key={i} className="ml-4">
                <span className="absolute -left-1.5 size-3 rounded-full bg-primary" />
                <div className="text-xs text-muted">{fmtDate(h.at)} · {h.by} · {h.status.replace("_", " ")}</div>
                <div className="text-sm">{h.note}</div>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}
