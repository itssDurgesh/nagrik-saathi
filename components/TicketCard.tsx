"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, Check, CircleCheckBig, ClipboardList, Clock, Copy, MapPin, MessageCircle } from "lucide-react";
import { istLabel } from "@/lib/format";

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
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className="rounded-[20px] overflow-hidden border-[1.5px] border-ok bg-surface shadow-raised"
    >
      <div className="bg-ok-soft px-4 sm:px-5 py-3.5 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-ok">
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 18, delay: 0.15 }}>
              <CircleCheckBig className="size-4" aria-hidden />
            </motion.span>
            Complaint filed
          </div>
          <div className="text-[22px] leading-tight font-extrabold tabular-nums mt-0.5">{t.id}</div>
        </div>
        <button
          type="button"
          className="btn btn-secondary !min-h-10 !px-3 !text-sm"
          onClick={() => {
            navigator.clipboard?.writeText(t.id);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copied" : "Copy ID"}
        </button>
      </div>
      <div className="px-4 sm:px-5 py-4 space-y-2.5">
        <div className="font-semibold">{t.title}</div>
        <div className="flex items-start gap-2 text-sm text-muted"><Building2 className="size-[18px] shrink-0" aria-hidden />{t.department}</div>
        <div className="flex items-start gap-2 text-sm text-muted"><MapPin className="size-[18px] shrink-0" aria-hidden />{t.ward_office ?? t.ward}</div>
        <div className="flex items-center gap-2 rounded-xl bg-accent-soft text-accent-ink px-3 py-2.5 font-semibold">
          <Clock className="size-[18px] shrink-0" aria-hidden /> Fix expected by {istLabel(t.due_at)}
        </div>
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <a className="btn btn-secondary" href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer">
            <MessageCircle className="size-[18px]" aria-hidden /> Share
          </a>
          <Link className="btn btn-ghost" href="/complaints">
            <ClipboardList className="size-[18px]" aria-hidden /> Track it
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
