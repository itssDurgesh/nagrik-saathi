"use client";

import { useState } from "react";
import { Building2, CalendarClock, Copy, Check, MapPin, MessageCircle } from "lucide-react";
import { fmtDate } from "@/lib/format";

export interface TicketSummary {
  id: string;
  title: string;
  issue?: string;
  status?: string;
  ward?: string;
  ward_office?: string;
  department?: string;
  due_at: string;
}

export function TicketCard({ t }: { t: TicketSummary }) {
  const [copied, setCopied] = useState(false);
  const share = `My AMC complaint ${t.id}: ${t.title}. Department: ${t.department}. Track it on Nagrik Saathi.`;
  return (
    <div className="rounded-2xl overflow-hidden border border-ok/30 bg-surface">
      <div className="bg-ok-soft px-4 py-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ok">Complaint filed</div>
          <div className="font-mono text-lg font-bold">{t.id}</div>
        </div>
        <button
          className="btn btn-ghost !min-h-0 !py-1.5"
          onClick={() => {
            navigator.clipboard?.writeText(t.id);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="px-4 py-3 space-y-2 text-sm">
        <div className="font-semibold">{t.title}</div>
        <div className="flex items-start gap-2 text-muted"><Building2 className="size-4 mt-0.5 shrink-0" />{t.department}</div>
        <div className="flex items-start gap-2 text-muted"><MapPin className="size-4 mt-0.5 shrink-0" />{t.ward} · {t.ward_office}</div>
        <div className="flex items-start gap-2 text-muted"><CalendarClock className="size-4 mt-0.5 shrink-0" />Resolve by {fmtDate(t.due_at)}</div>
        <a
          className="btn btn-ghost w-full mt-1"
          href={`https://wa.me/?text=${encodeURIComponent(share)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle className="size-4" /> Share on WhatsApp
        </a>
      </div>
    </div>
  );
}
