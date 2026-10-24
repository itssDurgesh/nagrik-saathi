"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import {
  Bot, Camera, Crosshair, ImagePlus, Loader2, MapPin, RotateCcw, Send, Sparkles, Square, X,
} from "lucide-react";
import { ApprovalCard, type Draft } from "@/components/ApprovalCard";
import { StepCard, summary, type ToolPart } from "@/components/StepCard";
import { TicketCard, type TicketSummary } from "@/components/TicketCard";
import { Segmented } from "@/components/ui";
import { istLabel } from "@/lib/format";
import { fileToDataUrl, preparePhoto } from "@/lib/image";
import { SAMPLES } from "@/lib/samples";
import type { Department, Language, Settings, Ward, Autonomy } from "@/lib/types";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => <div className="h-[220px] rounded-xl bg-surface-2 animate-pulse" />,
});

interface Loc {
  lat: number;
  lng: number;
  source: string;
}

const QUICK_PROMPTS = [
  "What's the status of my latest complaint?",
  "Show all my complaints",
  "AMC-2026-00038 is overdue. Please escalate it.",
];

const PIPELINE = [
  { tool: "analyze_photo", label: "See the issue" },
  { tool: "locate_ward", label: "Find the ward" },
  { tool: "route_department", label: "Pick department" },
  { tool: "check_duplicates", label: "Check duplicates" },
  { tool: "file", label: "File & get ticket ID" },
];

function isTool(p: UIMessage["parts"][number]): p is UIMessage["parts"][number] & ToolPart {
  return p.type.startsWith("tool-");
}

function friendlyError(message: string) {
  try {
    const parsed = JSON.parse(message);
    if (parsed.error) return parsed.error as string;
  } catch {}
  return "Something went wrong talking to the agent. Please try again.";
}

/** Tiny formatter: paragraphs, line breaks and **bold**. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="mb-2 last:mb-0 whitespace-pre-line">
          {para.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
            seg.startsWith("**") ? <strong key={j}>{seg.slice(2, -2)}</strong> : <span key={j}>{seg.replace(/^[*-] /gm, "• ")}</span>,
          )}
        </p>
      ))}
    </>
  );
}

export default function ReportPage() {
  const [photo, setPhoto] = useState<{ full: string; thumb: string; label: string } | null>(null);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [meta, setMeta] = useState<{ wards: Ward[]; departments: Department[] }>({ wards: [], departments: [] });
  const [notice, setNotice] = useState<string | null>(null);
  // Thumbnail of the photo in the current report; stored with the complaint when it is filed.
  const [lastThumb, setLastThumb] = useState<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const autoSent = useRef(false);

  const [transport] = useState(() => new DefaultChatTransport({ api: "/api/agent" }));

  const { messages, sendMessage, status, stop, error, regenerate, setMessages, addToolOutput } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });
  const busy = status === "submitted" || status === "streaming";
  // Location and photo thumbnail travel with every request, including automatic follow-ups.
  const requestOptions = (thumb = lastThumb) => ({ body: { location: loc, thumb } });

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setSettings(d.settings));
    fetch("/api/complaints").then((r) => r.json()).then((d) => setMeta({ wards: d.wards, departments: d.departments }));
  }, []);

  // Deep links from other pages: /?q=Escalate AMC-...
  useEffect(() => {
    if (autoSent.current) return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      autoSent.current = true;
      window.history.replaceState(null, "", "/");
      sendMessage({ text: q });
    }
  }, [sendMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  async function patchSettings(patch: Partial<Settings>) {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    await fetch("/api/settings", { method: "PATCH", body: JSON.stringify(patch) });
  }

  async function pickFile(file: File) {
    try {
      const prepared = await preparePhoto(await fileToDataUrl(file));
      setPhoto({ ...prepared, label: file.name });
      const exifr = (await import("exifr")).default;
      const gps = await exifr.gps(file).catch(() => null);
      if (gps?.latitude) {
        setLoc({ lat: +gps.latitude.toFixed(5), lng: +gps.longitude.toFixed(5), source: "photo GPS" });
        setNotice("Location read from the photo's GPS tag.");
      } else if (!loc) {
        setNotice("No GPS in this photo. Tap “Use my location” or drop a pin on the map.");
      }
    } catch {
      setNotice("Couldn't read that image. Try another photo.");
    }
  }

  async function pickSample(s: (typeof SAMPLES)[number]) {
    const prepared = await preparePhoto(s.src);
    setPhoto({ ...prepared, label: s.label });
    setLoc({ lat: s.lat, lng: s.lng, source: `photo GPS · ${s.place}` });
    setNotice(null);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setNotice("Location isn't available in this browser.");
    setNotice("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoc({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), source: "device location" });
        setNotice(null);
      },
      () => setNotice("Location permission denied. Drop a pin on the map instead."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function send(text?: string) {
    const body = (text ?? input).trim() || (photo ? "Please report this issue." : "");
    if (!body || busy) return;
    const thumb = photo?.thumb ?? lastThumb;
    if (photo) setLastThumb(photo.thumb);
    sendMessage(
      {
        text: body,
        files: photo ? [{ type: "file", mediaType: "image/jpeg", filename: "issue.jpg", url: photo.full }] : undefined,
      },
      requestOptions(thumb),
    );
    setPhoto(null);
    setInput("");
    setNotice(null);
  }

  async function approve(part: ToolPart, d: Draft) {
    const res = await fetch("/api/complaints", {
      method: "POST",
      body: JSON.stringify({
        issueType: d.issue_type,
        title: d.title,
        description: d.description,
        severity: d.severity,
        departmentId: d.department_id,
        wardId: d.ward_id,
        lat: d.lat,
        lng: d.lng,
        thumb: lastThumb,
      }),
    });
    const { complaint } = await res.json();
    const ward = meta.wards.find((w) => w.id === complaint.wardId);
    const dept = meta.departments.find((x) => x.id === complaint.departmentId);
    addToolOutput({
      tool: "confirm_and_file",
      toolCallId: part.toolCallId,
      output: {
        filed: true,
        user_edited: JSON.stringify(d) !== JSON.stringify(part.input),
        complaint: {
          id: complaint.id,
          title: complaint.title,
          status: "Filed",
          ward: ward?.name,
          ward_office: ward?.office,
          department: dept?.name,
          due_at: complaint.dueAt,
          due_ist: istLabel(complaint.dueAt),
        },
      },
      options: requestOptions(),
    });
  }

  function cancel(part: ToolPart) {
    addToolOutput({
      tool: "confirm_and_file",
      toolCallId: part.toolCallId,
      output: { filed: false, reason: "User cancelled the draft" },
      options: requestOptions(),
    });
  }

  // Tool steps since the last photo, for the pipeline view.
  const pipeline = useMemo(() => {
    const lastPhoto = messages.findLastIndex((m) => m.role === "user" && m.parts.some((p) => p.type === "file"));
    if (lastPhoto < 0) return null;
    const parts = messages.slice(lastPhoto + 1).flatMap((m) => m.parts.filter(isTool));
    const byTool = new Map(parts.map((p) => [p.type.replace(/^tool-/, ""), p]));
    const file = byTool.get("confirm_and_file") ?? byTool.get("file_complaint") ?? byTool.get("upvote_complaint");
    return PIPELINE.map((s) => ({ ...s, part: s.tool === "file" ? file : byTool.get(s.tool) }));
  }, [messages]);

  const selected = loc ? { lat: loc.lat, lng: loc.lng, label: "Issue location" } : null;
  const wardPoints = meta.wards.map((w) => ({ lat: w.lat, lng: w.lng, label: `${w.name} ward office`, color: "#4338ca" }));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* Chat */}
      <section className="card flex flex-col h-[calc(100dvh-6.5rem)] min-h-[540px] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <span className="grid place-items-center size-8 rounded-full bg-primary text-white"><Bot className="size-4" /></span>
          <div className="leading-tight">
            <div className="font-semibold text-sm">Nagrik Saathi agent</div>
            <div className="text-xs text-muted flex items-center gap-1">
              <span className={`size-1.5 rounded-full ${busy ? "bg-warn pulse" : "bg-ok"}`} />
              {busy ? "Working…" : "Online · Gemini + AMC tools"}
            </div>
          </div>
          {messages.length > 0 && (
            <button className="btn btn-ghost ml-auto !min-h-0 !py-1.5" onClick={() => { stop(); setMessages([]); }}>
              <RotateCcw className="size-4" /> New report
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="max-w-xl mx-auto text-center py-6">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft text-accent px-3 py-1 text-xs font-semibold mb-3">
                <Sparkles className="size-3.5" /> AI agent for AMC Ahmedabad
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Snap it. We&apos;ll file it.</h1>
              <p className="text-muted mt-2">
                Send a photo of a pothole, garbage, a broken streetlight or waterlogging. The agent finds the ward and
                department, files the complaint and tracks it for you.
              </p>
              <div className="grid grid-cols-3 gap-2 mt-5 text-xs">
                {["1. Send a photo", "2. Review the draft", "3. Get a ticket ID"].map((s) => (
                  <div key={s} className="rounded-xl bg-surface-2 px-2 py-3 font-semibold">{s}</div>
                ))}
              </div>
              <div className="mt-6 text-xs font-semibold text-muted uppercase tracking-wide">Try a sample photo</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
                {SAMPLES.map((s) => (
                  <button
                    key={s.id}
                    className="group rounded-xl overflow-hidden border border-border bg-surface-2 text-left hover:border-primary transition"
                    onClick={() => pickSample(s)}
                  >
                    <img src={s.src} alt={s.label} className="aspect-square w-full object-cover group-hover:scale-105 transition" />
                    <span className="block px-1.5 py-1 text-[11px] font-semibold truncate">{s.emoji} {s.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-5 text-xs font-semibold text-muted uppercase tracking-wide">Or ask</div>
              <div className="flex flex-col gap-2 mt-2">
                {QUICK_PROMPTS.map((q) => (
                  <button key={q} className="rounded-xl border border-border px-3 py-2 text-sm text-left hover:bg-surface-2" onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] sm:max-w-[70%] space-y-2">
                  {m.parts.map((p, i) =>
                    p.type === "file" ? (
                      <img key={i} src={p.url} alt="Uploaded issue" className="rounded-2xl max-h-56 ml-auto border border-border" />
                    ) : p.type === "text" ? (
                      <div key={i} className="rounded-2xl rounded-br-md bg-primary text-white px-4 py-2.5 text-sm">{p.text}</div>
                    ) : null,
                  )}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-2.5">
                <span className="grid place-items-center size-7 rounded-full bg-primary-soft text-primary shrink-0 mt-1"><Bot className="size-4" /></span>
                <div className="flex-1 min-w-0 space-y-2 max-w-2xl">
                  {m.parts.map((p, i) => {
                    if (p.type === "text" && p.text.trim()) {
                      return (
                        <div key={i} className="rounded-2xl rounded-tl-md bg-surface-2 px-4 py-2.5 text-sm leading-relaxed">
                          <Rich text={p.text} />
                        </div>
                      );
                    }
                    if (!isTool(p)) return null;
                    const tool = p.type.replace(/^tool-/, "");
                    if (tool === "confirm_and_file" && p.state === "input-available") {
                      return (
                        <ApprovalCard
                          key={p.toolCallId}
                          draft={p.input as unknown as Draft}
                          wards={meta.wards}
                          departments={meta.departments}
                          thumb={lastThumb}
                          onApprove={(d) => approve(p, d)}
                          onCancel={() => cancel(p)}
                        />
                      );
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const out = p.output as any;
                    return (
                      <div key={p.toolCallId} className="space-y-2">
                        <StepCard part={p} />
                        {p.state === "output-available" && out?.filed && out.complaint && (
                          <TicketCard t={out.complaint as TicketSummary} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ),
          )}

          {status === "submitted" && (
            <div className="flex gap-2.5 items-center text-sm text-muted">
              <span className="grid place-items-center size-7 rounded-full bg-primary-soft text-primary"><Loader2 className="size-4 animate-spin" /></span>
              Thinking…
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-danger-soft text-danger px-4 py-3 text-sm flex items-center gap-3">
              <span className="flex-1">{friendlyError(error.message)}</span>
              <button className="btn btn-ghost !min-h-0 !py-1.5" onClick={() => regenerate(requestOptions())}>Retry</button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3 space-y-2">
          {(photo || loc || notice) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {photo && (
                <span className="flex items-center gap-2 rounded-xl bg-surface-2 pl-1 pr-2 py-1">
                  <img src={photo.thumb} alt="" className="size-9 rounded-lg object-cover" />
                  <span className="font-semibold max-w-32 truncate">{photo.label}</span>
                  <button aria-label="Remove photo" onClick={() => setPhoto(null)}><X className="size-3.5" /></button>
                </span>
              )}
              {loc && (
                <span className="flex items-center gap-1 rounded-xl bg-accent-soft text-accent px-2 py-1.5 font-semibold">
                  <MapPin className="size-3.5" /> {loc.source} · {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                </span>
              )}
              {notice && <span className="text-muted">{notice}</span>}
            </div>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])} />
            <button type="button" className="btn btn-ghost !px-3 sm:hidden" aria-label="Take photo" onClick={() => cameraRef.current?.click()}>
              <Camera className="size-5" />
            </button>
            <button type="button" className="btn btn-ghost !px-3" aria-label="Attach photo" onClick={() => galleryRef.current?.click()}>
              <ImagePlus className="size-5" />
            </button>
            <textarea
              className="input resize-none flex-1 min-h-10 max-h-32"
              rows={1}
              placeholder={photo ? "Add a note (optional) and send" : "Describe the issue or ask about a complaint…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            {busy ? (
              <button type="button" className="btn btn-danger !px-3" aria-label="Stop" onClick={() => stop()}>
                <Square className="size-4" />
              </button>
            ) : (
              <button type="submit" className="btn btn-primary !px-4" disabled={!input.trim() && !photo}>
                <Send className="size-4" /> <span className="hidden sm:inline">{photo ? "Report" : "Send"}</span>
              </button>
            )}
          </form>
        </div>
      </section>

      {/* Side panel */}
      <aside className="space-y-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm">Issue location</h2>
            <button className="btn btn-ghost !min-h-0 !py-1 !px-2 text-xs" onClick={useMyLocation}>
              <Crosshair className="size-3.5" /> Use my location
            </button>
          </div>
          <MapPicker selected={selected} points={wardPoints} onPick={(lat, lng) => setLoc({ lat, lng, source: "map pin" })} />
          <p className="text-xs text-muted mt-2">Tap the map to drop a pin. Blue dots are AMC ward offices.</p>
        </div>

        <div className="card p-4">
          <h2 className="font-semibold text-sm mb-3">Agent pipeline</h2>
          <ol className="space-y-2">
            {PIPELINE.map((s, i) => {
              const part = pipeline?.[i]?.part;
              const done = part?.state === "output-available";
              const running = part && !done && part.state !== "output-error";
              const sum = done ? summary(part.type.replace(/^tool-/, ""), part.input, part.output) : null;
              return (
                <li key={s.tool} className="flex items-start gap-2.5">
                  <span
                    className={`grid place-items-center size-6 rounded-full text-[11px] font-bold shrink-0 ${
                      done ? (sum?.warn ? "bg-warn text-white" : "bg-ok text-white") : running ? "bg-primary text-white" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {running ? <Loader2 className="size-3.5 animate-spin" /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className={`text-sm ${done || running ? "font-semibold" : "text-muted"}`}>{s.label}</div>
                    {sum?.text && <div className="text-xs text-muted truncate">{sum.text}</div>}
                    {part?.type === "tool-confirm_and_file" && part.state === "input-available" && (
                      <div className="text-xs text-primary font-semibold">Waiting for your approval</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {settings && (
          <div className="card p-4 space-y-3">
            <h2 className="font-semibold text-sm">Agent controls</h2>
            <div className="space-y-1">
              <div className="text-xs text-muted font-semibold">Before filing</div>
              <Segmented<Autonomy>
                value={settings.autonomy}
                onChange={(v) => patchSettings({ autonomy: v })}
                options={[{ value: "ask", label: "Ask me first" }, { value: "auto", label: "Auto-file" }]}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted font-semibold">Reply language</div>
              <Segmented<Language>
                value={settings.language}
                onChange={(v) => patchSettings({ language: v })}
                options={[{ value: "en", label: "English" }, { value: "hi", label: "हिंदी" }, { value: "gu", label: "ગુજરાતી" }]}
              />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
