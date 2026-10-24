import { Check } from "lucide-react";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/types";

export function StatusTimeline({ status }: { status: Status }) {
  const current = STATUSES.indexOf(status);
  return (
    <ol className="flex items-center w-full">
      {STATUSES.map((s, i) => {
        const done = i <= current;
        return (
          <li key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`grid place-items-center size-6 rounded-full text-[11px] font-bold ${
                  done ? (s === "resolved" ? "bg-ok text-white" : "bg-primary text-white") : "bg-surface-2 text-muted"
                }`}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={`text-[11px] whitespace-nowrap ${done ? "text-text font-semibold" : "text-muted"}`}>
                {STATUS_LABEL[s]}
              </span>
            </div>
            {i < STATUSES.length - 1 && (
              <span className={`h-0.5 flex-1 mx-1 mb-5 rounded ${i < current ? "bg-primary" : "bg-border"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
