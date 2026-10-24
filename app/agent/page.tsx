"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, CheckCircle2, Cpu, KeyRound, RotateCcw, ShieldCheck, Zap, XCircle } from "lucide-react";
import { Segmented } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { TOOL_INFO } from "@/lib/tool-info";
import type { Language, LogEntry, Settings } from "@/lib/types";

interface State {
  settings: Settings;
  logs: LogEntry[];
  model: string;
  hasKey: boolean;
}

export default function AgentPage() {
  const [s, setS] = useState<State | null>(null);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => fetch("/api/settings").then((r) => r.json()).then(setS), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  async function patch(p: Partial<Settings>) {
    setS((x) => (x ? { ...x, settings: { ...x.settings, ...p } } : x));
    await fetch("/api/settings", { method: "PATCH", body: JSON.stringify(p) });
    setToast("Saved. The agent uses this from the next message.");
    setTimeout(() => setToast(null), 2000);
  }

  async function reset() {
    if (!confirm("Reset all complaints, logs and settings to the demo seed?")) return;
    await fetch("/api/settings", { method: "DELETE" });
    await load();
    setToast("Demo data reset.");
    setTimeout(() => setToast(null), 2000);
  }

  if (!s) return <div className="card h-96 animate-pulse" />;
  const { settings } = s;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent control</h1>
          <p className="text-sm text-muted">Decide how much the agent may do on its own, which tools it can use, and inspect every action it took.</p>
        </div>
        <button className="btn btn-danger" onClick={reset}><RotateCcw className="size-4" /> Reset demo data</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Cpu className="size-4" /> Engine</h2>
          <div className="text-sm grid gap-2">
            <div className="flex justify-between"><span className="text-muted">Model</span><span className="font-mono">{s.model}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Gemini API key</span>
              {s.hasKey ? (
                <span className="text-ok font-semibold flex items-center gap-1"><CheckCircle2 className="size-4" />Connected</span>
              ) : (
                <span className="text-danger font-semibold flex items-center gap-1"><KeyRound className="size-4" />Missing</span>
              )}
            </div>
            <div className="flex justify-between"><span className="text-muted">Actions logged</span><span className="font-semibold">{s.logs.length}</span></div>
          </div>
          {!s.hasKey && (
            <p className="text-xs text-muted bg-surface-2 rounded-lg p-2">
              Add <code>GOOGLE_GENERATIVE_AI_API_KEY</code> to <code>.env.local</code> and restart <code>npm run dev</code>.
            </p>
          )}
        </div>

        <div className="card p-4 space-y-3 lg:col-span-2">
          <h2 className="font-semibold flex items-center gap-2"><Bot className="size-4" /> Behaviour</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { v: "ask" as const, icon: ShieldCheck, title: "Ask me first", body: "The agent drafts the complaint and waits for your approval. You can edit any field." },
              { v: "auto" as const, icon: Zap, title: "Auto-file", body: "The agent files immediately and hands you the ticket ID. Fastest for trusted users." },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => patch({ autonomy: o.v })}
                className={`rounded-xl border-2 p-3 text-left transition ${settings.autonomy === o.v ? "border-primary bg-primary-soft" : "border-border hover:border-muted"}`}
              >
                <div className="flex items-center gap-2 font-semibold"><o.icon className="size-4" />{o.title}</div>
                <p className="text-xs text-muted mt-1">{o.body}</p>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="space-y-1">
              <div className="text-xs text-muted font-semibold">Reply language</div>
              <Segmented<Language>
                value={settings.language}
                onChange={(v) => patch({ language: v })}
                options={[{ value: "en", label: "English" }, { value: "hi", label: "हिंदी" }, { value: "gu", label: "ગુજરાતી" }]}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted font-semibold">Tone</div>
              <Segmented<Settings["tone"]>
                value={settings.tone}
                onChange={(v) => patch({ tone: v })}
                options={[{ value: "simple", label: "Simple" }, { value: "formal", label: "Formal" }]}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-semibold mb-1">Tools</h2>
        <p className="text-xs text-muted mb-3">Switch a tool off and the agent can no longer call it. The filing tool follows the behaviour setting above.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TOOL_INFO.map((t) => {
            const filingInactive =
              (t.name === "file_complaint" && settings.autonomy === "ask") || (t.name === "confirm_and_file" && settings.autonomy === "auto");
            const enabled = !settings.disabledTools.includes(t.name);
            return (
              <label key={t.name} className={`flex items-start gap-3 rounded-xl border border-border p-3 ${filingInactive ? "opacity-50" : ""}`}>
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-[var(--primary)]"
                  checked={enabled}
                  onChange={() =>
                    patch({
                      disabledTools: enabled ? [...settings.disabledTools, t.name] : settings.disabledTools.filter((x) => x !== t.name),
                    })
                  }
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{t.label} <span className="font-mono text-[11px] text-muted">{t.name}</span></span>
                  <span className="block text-xs text-muted">{filingInactive ? "Inactive in the current behaviour mode" : t.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Action log</h2>
          <span className="text-xs text-muted">Live · newest first · click a row for inputs and outputs</span>
        </div>
        {s.logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">No actions yet. Report an issue to see the agent work.</div>
        ) : (
          <ul className="divide-y divide-border">
            {s.logs.map((l) => (
              <li key={l.id}>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-2" onClick={() => setOpenLog(openLog === l.id ? null : l.id)}>
                  {l.ok ? <CheckCircle2 className="size-4 text-ok shrink-0" /> : <XCircle className="size-4 text-danger shrink-0" />}
                  <span className="font-mono font-semibold">{l.tool}</span>
                  <span className="text-xs text-muted ml-auto whitespace-nowrap">{l.ms} ms · {fmtDate(l.at)}</span>
                </button>
                {openLog === l.id && (
                  <div className="grid gap-2 px-4 pb-3 sm:grid-cols-2 text-xs">
                    <pre className="bg-surface-2 rounded-lg p-2 overflow-auto max-h-64 whitespace-pre-wrap break-all">{JSON.stringify(l.input, null, 2)}</pre>
                    <pre className="bg-surface-2 rounded-lg p-2 overflow-auto max-h-64 whitespace-pre-wrap break-all">{JSON.stringify(l.output, null, 2)}</pre>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[3000] rounded-xl bg-text text-bg px-4 py-2 text-sm font-semibold shadow-lg">{toast}</div>}
    </div>
  );
}
