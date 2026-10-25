"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import {
  Camera, ChevronRight, ClipboardList, Clock, ImagePlus, Landmark, LocateFixed, MapPin, Megaphone, RotateCcw, Send, Square, X,
} from "lucide-react";
import { AgentSteps, toolName, type ToolPart } from "@/components/AgentSteps";
import { ApprovalCard, type Draft } from "@/components/ApprovalCard";
import { TicketCard, type TicketSummary } from "@/components/TicketCard";
import { Segmented } from "@/components/ui";
import { istLabel } from "@/lib/format";
import { fileToDataUrl, preparePhoto } from "@/lib/image";
import { SAMPLES } from "@/lib/samples";
import { saveSettings, useSettings } from "@/lib/use-settings";
import type { Autonomy, Department, Ward } from "@/lib/types";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => <div className="h-[200px] rounded-2xl bg-surface-2 animate-pulse" />,
});

interface Loc {
  lat: number;
  lng: number;
  source: string;
}

const QUICK_ASKS = [
  { text: "What's the status of my latest complaint?", label: "Check my latest complaint", icon: ClipboardList },
  { text: "Which of my complaints are overdue? Please escalate them.", label: "Escalate an overdue complaint", icon: Megaphone },
];

const enter = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { type: "spring" as const, stiffness: 380, damping: 32 } };

function isTool(p: UIMessage["parts"][number]): p is UIMessage["parts"][number] & ToolPart {
  return p.type.startsWith("tool-");
}

// The server sends either a JSON body ({ error }) or a plain sentence from the stream; show it if it reads like one.
function friendlyError(message: string) {
  try {
    const parsed = JSON.parse(message);
    if (parsed.error) return parsed.error as string;
  } catch {
    if (message && message.length < 300 && !message.includes("<")) return message;
  }
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

function AgentAvatar() {
  return (
    <span className="grid place-items-center size-8 rounded-full bg-primary-soft text-primary shrink-0 mt-0.5" aria-hidden>
      <Landmark className="size-4" />
    </span>
  );
}

function QuickAsks({ onAsk }: { onAsk: (text: string) => void }) {
  return (
    <div className="card p-1.5">
      {QUICK_ASKS.map(({ text, label, icon: Icon }) => (
        <button key={label} type="button" onClick={() => onAsk(text)} className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2 transition-colors">
          <span className="grid place-items-center size-9 rounded-xl bg-primary-soft text-primary shrink-0"><Icon className="size-[18px]" aria-hidden /></span>
          <span className="flex-1 font-semibold">{label}</span>
          <ChevronRight className="size-[18px] text-muted" aria-hidden />
        </button>
      ))}
    </div>
  );
}

function SideCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-[17px]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function ReportPage() {
  const [photo, setPhoto] = useState<{ full: string; thumb: string; label: string } | null>(null);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [input, setInput] = useState("");
  const settings = useSettings();
  const [meta, setMeta] = useState<{ wards: Ward[]; departments: Department[] }>({ wards: [], departments: [] });
  const [notice, setNotice] = useState<string | null>(null);
  // Thumbnail of the photo in the current report; stored with the complaint when it is filed.
  const [lastThumb, setLastThumb] = useState<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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

  // Scroll only the chat box. scrollIntoView would also scroll the window and jump the page on load.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && messages.length) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  async function pickFile(file: File) {
    try {
      const prepared = await preparePhoto(await fileToDataUrl(file));
      setPhoto({ ...prepared, label: file.name });
      inputRef.current?.focus();
      const exifr = (await import("exifr")).default;
      const gps = await exifr.gps(file).catch(() => null);
      if (gps?.latitude) {
        setLoc({ lat: +gps.latitude.toFixed(5), lng: +gps.longitude.toFixed(5), source: "Photo GPS" });
        setNotice(null);
      } else if (!loc) {
        setNotice("No location in this photo. Use your location or tap the map.");
      }
    } catch {
      setNotice("Couldn't read that image. Try another photo.");
    }
  }

  async function pickSample(s: (typeof SAMPLES)[number]) {
    const prepared = await preparePhoto(s.src);
    setPhoto({ ...prepared, label: s.label });
    setLoc({ lat: s.lat, lng: s.lng, source: `Photo GPS · ${s.place}` });
    setNotice(null);
    inputRef.current?.focus();
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setNotice("Location isn't available in this browser.");
    setNotice("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoc({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), source: "Your location" });
        setNotice(null);
      },
      () => setNotice("Location permission denied. Tap the map instead."),
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

  // A fresh report must not inherit the previous photo or location, or they get filed with the next complaint.
  function newReport() {
    stop();
    setMessages([]);
    setPhoto(null);
    setLastThumb(undefined);
    setLoc(null);
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
    }).catch(() => null);
    if (!res?.ok) {
      setNotice("Couldn't file the complaint with AMC. Please try again.");
      return;
    }
    const { complaint } = await res.json();
    setNotice(null);
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

  /** Assistant parts in order, with consecutive tool calls folded into one progress card. */
  function renderAssistant(m: UIMessage) {
    const blocks: ReactNode[] = [];
    let group: ToolPart[] = [];
    const flush = () => {
      if (!group.length) return;
      const parts = group;
      group = [];
      blocks.push(<AgentSteps key={`steps-${parts[0].toolCallId}`} parts={parts} />);
      for (const p of parts) {
        const tool = toolName(p);
        if (tool === "confirm_and_file" && p.state === "input-available") {
          blocks.push(
            <ApprovalCard
              key={p.toolCallId}
              draft={p.input as unknown as Draft}
              wards={meta.wards}
              departments={meta.departments}
              thumb={lastThumb}
              onApprove={(d) => approve(p, d)}
              onCancel={() => cancel(p)}
            />,
          );
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const out = p.output as any;
        if (p.state === "output-available" && out?.filed && out.complaint) blocks.push(<TicketCard key={`ticket-${p.toolCallId}`} t={out.complaint as TicketSummary} />);
      }
    };
    m.parts.forEach((p, i) => {
      if (isTool(p)) return void group.push(p);
      // Only visible text splits the steps; step-start markers and empty text sit between every tool call.
      if (p.type === "text" && p.text.trim()) {
        flush();
        blocks.push(
          <div key={i} className="rounded-[18px] rounded-tl-md bg-surface border border-border px-4 py-3 leading-relaxed">
            <Rich text={p.text} />
          </div>,
        );
      }
    });
    flush();
    return blocks;
  }

  const selected = loc ? { lat: loc.lat, lng: loc.lng, label: "Issue location" } : null;
  const wardPoints = meta.wards.map((w) => ({ lat: w.lat, lng: w.lng, label: `${w.name} ward office`, color: "#0f766e" }));
  const started = messages.length > 0;

  return (
    <div className="grid gap-5 lg:gap-6 lg:grid-cols-[1fr_360px] items-start">
      {/* Chat: sized so the composer stays on screen below the header */}
      <section aria-label="Report an issue" className="card flex flex-col h-[calc(100dvh-10rem)] lg:h-[calc(100dvh-8rem)] min-h-[520px] overflow-hidden">
        <AnimatePresence initial={false}>
          {started && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-border overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 sm:px-5 py-3">
                <span className={`size-2 rounded-full shrink-0 ${busy ? "bg-accent pulse" : "bg-ok"}`} aria-hidden />
                <span className="flex-1 text-sm font-semibold text-muted" aria-live="polite">{busy ? "Working on it…" : "Your report"}</span>
                <button type="button" className="btn btn-ghost !min-h-10 !py-2 !text-sm whitespace-nowrap" onClick={newReport}>
                  <RotateCcw className="size-4" aria-hidden /> New report
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={scrollRef} className="@container flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8">
          {!started && (
            <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-6">
              <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="space-y-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft text-accent-ink px-3 py-1 text-xs font-semibold">
                  <Clock className="size-3.5" aria-hidden /> Free · takes about a minute
                </span>
                <h1 className="text-[30px] sm:text-[40px] font-extrabold tracking-[-0.02em] leading-[1.12] text-balance">Spotted a problem on your street?</h1>
                <p className="text-muted text-[17px] max-w-xl">
                  Take a photo. We find the right AMC department, file the complaint and keep you posted in your language.
                </p>
              </motion.div>

              <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="grid gap-2.5 sm:flex sm:flex-wrap">
                <button type="button" className="btn btn-primary !min-h-[52px] sm:hidden" onClick={() => cameraRef.current?.click()}>
                  <Camera className="size-5" aria-hidden /> Take a photo
                </button>
                <button type="button" className="btn btn-secondary !min-h-[52px] sm:hidden" onClick={() => galleryRef.current?.click()}>
                  <ImagePlus className="size-5" aria-hidden /> Upload from gallery
                </button>
                <button type="button" className="btn btn-primary !min-h-[52px] !px-6 hidden sm:inline-flex" onClick={() => galleryRef.current?.click()}>
                  <Camera className="size-5" aria-hidden /> Upload a photo
                </button>
                <Link href="/complaints" className="btn btn-secondary !min-h-[52px] !px-6 hidden sm:inline-flex">
                  <ClipboardList className="size-5" aria-hidden /> Track a complaint
                </Link>
              </motion.div>

              <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="space-y-2.5">
                <h2 className="label">Or try an example</h2>
                <div className="grid grid-cols-3 @3xl:grid-cols-6 gap-2.5 sm:gap-3">
                  {SAMPLES.map((s) => (
                    <motion.button
                      key={s.id}
                      type="button"
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.97 }}
                      className="rounded-2xl overflow-hidden border border-border bg-surface text-left hover:border-primary transition-colors"
                      onClick={() => pickSample(s)}
                      aria-label={`Use the ${s.label} example photo`}
                    >
                      <img src={s.src} alt="" className="aspect-[4/3] w-full object-cover" />
                      <span className="block px-2.5 py-2 text-sm font-medium leading-tight">{s.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="lg:hidden">
                <QuickAsks onAsk={send} />
              </motion.div>
            </motion.div>
          )}

          <div className="space-y-4">
            {messages.map((m) =>
              m.role === "user" ? (
                <motion.div key={m.id} {...enter} className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[70%] flex flex-col items-end gap-2">
                    {m.parts.map((p, i) =>
                      p.type === "file" ? (
                        <img key={i} src={p.url} alt="Your photo of the issue" className="rounded-[18px] max-h-56 border border-border" />
                      ) : p.type === "text" ? (
                        <div key={i} className="rounded-[18px] rounded-br-md bg-primary text-white px-4 py-2.5">{p.text}</div>
                      ) : null,
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div key={m.id} {...enter} className="flex gap-2.5">
                  <AgentAvatar />
                  <div className="flex-1 min-w-0 space-y-3 max-w-2xl">{renderAssistant(m)}</div>
                </motion.div>
              ),
            )}

            {status === "submitted" && (
              <motion.div {...enter} className="flex gap-2.5 items-center text-muted" aria-live="polite">
                <AgentAvatar />
                <span className="flex gap-1" aria-label="Thinking">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="size-2 rounded-full bg-primary/60"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12 }}
                    />
                  ))}
                </span>
              </motion.div>
            )}

            {error && (
              <div role="alert" className="rounded-2xl bg-danger-soft text-danger px-4 py-3 flex items-center gap-3">
                <span className="flex-1">{friendlyError(error.message)}</span>
                <button type="button" className="btn btn-secondary !min-h-10 !py-2 !text-sm" onClick={() => regenerate(requestOptions())}>Try again</button>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-surface p-3 sm:px-5 space-y-2">
          <AnimatePresence initial={false}>
            {(photo || loc || notice) && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                {photo && (
                  <span className="flex items-center gap-2 rounded-xl bg-surface-2 pl-1 pr-1.5 py-1">
                    <img src={photo.thumb} alt="" className="size-9 rounded-lg object-cover" />
                    <span className="font-semibold max-w-36 truncate">{photo.label}</span>
                    <button type="button" aria-label="Remove photo" className="grid place-items-center size-8 rounded-lg hover:bg-border" onClick={() => setPhoto(null)}>
                      <X className="size-4" aria-hidden />
                    </button>
                  </span>
                )}
                {loc && (
                  <a href="#location" className="flex items-center gap-1.5 rounded-xl bg-accent-soft text-accent-ink px-3 py-2 font-semibold">
                    <MapPin className="size-4" aria-hidden /> {loc.source}
                  </a>
                )}
                {notice && <span className="text-muted">{notice}</span>}
              </motion.div>
            )}
          </AnimatePresence>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])} />
            <button type="button" className="btn btn-ghost !px-3 sm:hidden" aria-label="Take a photo" onClick={() => cameraRef.current?.click()}>
              <Camera className="size-5" aria-hidden />
            </button>
            <button type="button" className="btn btn-ghost !px-3" aria-label="Attach a photo" onClick={() => galleryRef.current?.click()}>
              <ImagePlus className="size-5" aria-hidden />
            </button>
            <textarea
              ref={inputRef}
              className="input resize-none flex-1 max-h-32"
              rows={1}
              aria-label="Message"
              placeholder={photo ? "Add a note, or just send" : "Describe the issue…"}
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
                <Square className="size-5" aria-hidden />
              </button>
            ) : (
              <button type="submit" className="btn btn-primary !px-3 sm:!px-5" disabled={!input.trim() && !photo} aria-label={photo ? "Report this issue" : "Send"}>
                <Send className="size-5" aria-hidden /> <span className="hidden sm:inline">{photo ? "Report" : "Send"}</span>
              </button>
            )}
          </form>
        </div>
      </section>

      {/* Side panel */}
      <aside className="space-y-4 lg:sticky lg:top-24">
        <div id="location" className="scroll-mt-28">
          <SideCard
            title="Issue location"
            action={
              <button type="button" className="btn btn-ghost !min-h-10 !py-2 !px-3 !text-sm !rounded-full" onClick={useMyLocation}>
                <LocateFixed className="size-4" aria-hidden /> Use my location
              </button>
            }
          >
            <MapPicker selected={selected} points={wardPoints} onPick={(lat, lng) => setLoc({ lat, lng, source: "Pin on map" })} height={200} />
            <p className="text-sm text-muted">
              {loc ? <span className="font-semibold text-accent-ink">{loc.source} · {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span> : "We read it from your photo. If it has none, tap the map."}
            </p>
          </SideCard>
        </div>

        <div className="hidden lg:block">
          <QuickAsks onAsk={send} />
        </div>

        {settings && (
          <SideCard title="Before filing">
            <Segmented<Autonomy>
              label="Before filing"
              value={settings.autonomy}
              onChange={(v) => saveSettings({ autonomy: v })}
              options={[{ value: "ask", label: "Let me check first" }, { value: "auto", label: "File right away" }]}
            />
            <p className="text-sm text-muted">
              {settings.autonomy === "ask" ? "You review and edit the complaint before it goes to AMC." : "The agent files straight away and gives you the ticket ID."}
            </p>
          </SideCard>
        )}
      </aside>
    </div>
  );
}
