"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUp, BookOpen, Check, ChevronRight, FileText, LayoutDashboard,
  Mic, MicOff, RotateCcw, TriangleAlert, Zap,
} from "lucide-react";
import CourtDiagram from "@/components/CourtDiagram";
import ThemeToggle from "@/components/ThemeToggle";
import BasketballIcon from "@/components/icons/BasketballIcon";

/* ── Types ─────────────────────────────────────────────────────────── */
type Mode = "chat" | "drill" | "play" | "summary";
type Role = "user" | "coach";
interface Message {
  id: string;
  role: Role;
  content: string;
  mode?: Mode;
  diagram?: any;
  isError?: boolean;
  timestamp: Date;
}

/* ── Data ───────────────────────────────────────────────────────────── */
const SUGGESTIONS: Record<Mode, string[]> = {
  chat: ["Improve my free throw %", "Best ball-handling drills", "Defend pick and roll", "Keys to winning close games", "Mental toughness tips"],
  drill: ["Point guard ball handling", "Center post moves", "Perimeter shooting", "Defensive footwork", "Fast break finishing"],
  play: ["Pick and Roll", "Horns set", "Flex offense", "Princeton offense", "Motion offense"],
  summary: [],
};

const MODE_META: Record<Mode, { label: string; icon: typeof Zap; title: string; blurb: string; placeholder: string }> = {
  chat: {
    label: "Ask Carter", icon: Zap,
    title: "What's on your mind, Coach?",
    blurb: "Strategy, drills, mindset, X's and O's. Ask it straight and Carter will answer the same way.",
    placeholder: "Ask Coach Carter anything…",
  },
  drill: {
    label: "Drill Plan", icon: BookOpen,
    title: "What skill are we sharpening?",
    blurb: "Name the position or skill and Carter will build a three-drill practice block around it.",
    placeholder: "Describe the skill to train…",
  },
  play: {
    label: "Play Diagram", icon: LayoutDashboard,
    title: "Which play are we running?",
    blurb: "Name any play and see it drawn on the court. Drag the players to tweak the spacing.",
    placeholder: "Name a play (e.g. Pick and Roll)…",
  },
  summary: {
    label: "Session Summary", icon: FileText,
    title: "Session summary",
    blurb: "Carter wraps up everything you covered in five bullet points.",
    placeholder: "Ask Coach Carter anything…",
  },
};

/* ── Helpers ────────────────────────────────────────────────────────── */
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderContent(text: string) {
  const escaped = escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of escaped.split("\n")) {
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)/);
    const heading = line.match(/^#{1,4}\s+(.*)/);
    if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      if (list !== kind) { close(); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${(bullet ?? numbered)![1]}</li>`);
    } else {
      close();
      if (heading) out.push(`<h3>${heading[1]}</h3>`);
      else if (line.trim()) out.push(`<p>${line}</p>`);
    }
  }
  close();
  return out.join("");
}

function extractDiagram(text: string) {
  try {
    const match = text.match(/\{[\s\S]*"positions"[\s\S]*"actions"[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return null;
}

function stripDiagramJson(text: string) {
  return text
    .replace(/```json[\s\S]*?```/g, "")
    .replace(/\{[\s\S]*"positions"[\s\S]*"actions"[\s\S]*\}/, "")
    .trim();
}

function friendlyError(raw: string) {
  if (/429|rate limit|quota/i.test(raw)) {
    const wait = raw.match(/retry in ([0-9hms. ]+?)(?: or|\.|$)/i)?.[1];
    return {
      title: "Carter's catching his breath",
      body: `The free Gemini quota is used up for now${wait ? ` — try again in about ${wait.trim()}` : ""}.`,
    };
  }
  if (/GOOGLE_API_KEY/i.test(raw)) {
    return { title: "API key missing", body: "Add GOOGLE_API_KEY to your .env.local and restart the dev server." };
  }
  return { title: "Something went wrong", body: raw };
}

/* ── Coach avatar ───────────────────────────────────────────────────── */
function CoachAvatar({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ember-400 to-ember-600 shadow-[0_0_0_3px_rgb(255_107_26/0.14),0_4px_14px_rgb(255_107_26/0.3)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <BasketballIcon size={Math.round(size * 0.58)} className="text-white" />
    </div>
  );
}

/* ── Message bubble ─────────────────────────────────────────────────── */
function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const diagram = msg.diagram;
  // While a play streams in, hide the raw diagram JSON as soon as it starts.
  const displayText = diagram
    ? stripDiagramJson(msg.content)
    : msg.mode === "play" && !isUser
      ? msg.content.split(/```json|\{\s*"play"/)[0].trim()
      : msg.content;
  const time = msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (msg.isError) {
    const err = friendlyError(msg.content);
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3"
      >
        <CoachAvatar />
        <div className="max-w-[min(34rem,85%)] rounded-2xl rounded-tl-md border border-red-500/25 bg-red-500/[0.07] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-err">
            <TriangleAlert size={15} />
            {err.title}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-err-soft">{err.body}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      className={`flex items-end gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      {!isUser && <div className="self-start"><CoachAvatar /></div>}

      <div className={`flex min-w-0 max-w-[min(38rem,88%)] flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
        {isUser && msg.mode === "summary" ? (
          <div className="flex items-center gap-2 rounded-2xl rounded-br-md bg-gradient-to-br from-ember-500 to-ember-600 px-4 py-3 text-[15px] font-medium text-white shadow-[0_6px_20px_rgb(255_107_26/0.22)]">
            <FileText size={16} />
            Session summary
          </div>
        ) : displayText && (
          <div
            className={`msg-content px-4 py-3 ${
              isUser
                ? "rounded-2xl rounded-br-md bg-gradient-to-br from-ember-500 to-ember-600 font-medium text-white shadow-[0_6px_20px_rgb(255_107_26/0.22)]"
                : "rounded-2xl rounded-tl-md border border-line bg-ink-900 text-chalk"
            }`}
            dangerouslySetInnerHTML={{ __html: renderContent(displayText) }}
          />
        )}

        {diagram && (
          <div className="w-full max-w-[26rem]">
            <CourtDiagram data={diagram} />
          </div>
        )}

        <span className="px-1 text-[11px] text-dust/60">{time}</span>
      </div>
    </motion.div>
  );
}

/* ── Typing indicator ───────────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
      <CoachAvatar />
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-line bg-ink-900 px-4 py-3.5" aria-label="Carter is typing">
        {[0, 1, 2].map(i => (
          <span key={i} className="typing-dot size-1.5 rounded-full bg-ember-500" />
        ))}
      </div>
    </motion.div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────── */
function EmptyState({ mode, onSend }: { mode: Mode; onSend: (s: string) => void }) {
  const meta = MODE_META[mode];
  return (
    <motion.div
      key={mode}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-8 py-10 text-center"
    >
      <div className="relative">
        <div className="flex size-24 items-center justify-center rounded-[1.75rem] border border-ember-500/25 bg-gradient-to-br from-ember-500/20 to-ember-600/5 text-ember-500 shadow-[0_0_60px_rgb(255_107_26/0.18)]">
          <BasketballIcon size={52} strokeWidth={1.75} />
        </div>
        <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-ok text-[11px] font-bold text-ink-950 ring-4 ring-ink-950">
          <Check size={13} strokeWidth={3} />
        </span>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-4xl font-bold uppercase leading-none tracking-wide sm:text-5xl">
          {meta.title}
        </h2>
        <p className="mx-auto max-w-sm text-[15px] leading-relaxed text-dust">{meta.blurb}</p>
      </div>

      {SUGGESTIONS[mode].length > 0 && (
        <div className="flex w-full flex-col gap-2">
          {SUGGESTIONS[mode].map((s, i) => (
            <motion.button
              key={s}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              onClick={() => onSend(s)}
              className="group flex w-full items-center justify-between rounded-xl border border-line bg-ink-900/70 px-4 py-3.5 text-left text-[15px] text-chalk/90 transition hover:border-ember-500/50 hover:bg-ember-500/[0.07] hover:text-chalk focus-visible:outline-2 focus-visible:outline-ember-500"
            >
              {s}
              <ChevronRight size={16} className="text-dust/50 transition group-hover:translate-x-0.5 group-hover:text-ember-400" />
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────── */
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  /* Voice — browser Web Speech API (Chrome / Edge / Safari; not Firefox) */
  const flashVoiceError = useCallback((msg: string) => {
    setVoiceError(msg);
    setTimeout(() => setVoiceError(null), 4500);
  }, []);

  const toggleVoice = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      flashVoiceError("Voice input isn't supported in this browser. Try Chrome, Edge or Safari.");
      return;
    }
    if (listening) { recognitionRef.current?.stop(); return; }

    const VOICE_ERRORS: Record<string, string> = {
      "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings.",
      "service-not-allowed": "Microphone access is blocked. Allow it in your browser's site settings.",
      "no-speech": "Didn't catch that. Tap the mic and try again.",
      "audio-capture": "No microphone found.",
      network: "Speech service unreachable. Check your connection.",
    };

    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.continuous = false;
    rec.interimResults = true; // words appear in the box while you speak
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setInput(transcript);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px"; }
      });
    };
    rec.onerror = (e: any) => {
      setListening(false);
      if (e.error !== "aborted") flashVoiceError(VOICE_ERRORS[e.error] ?? `Voice input failed (${e.error}).`);
    };
    rec.onend = () => { setListening(false); textareaRef.current?.focus(); };
    recognitionRef.current = rec;
    try { rec.start(); setListening(true); setVoiceError(null); }
    catch { setListening(false); }
  }, [listening, flashVoiceError]);

  /* Send */
  const send = useCallback(async (text?: string, overrideMode?: Mode) => {
    const msg = (text ?? input).trim();
    const activeMode = overrideMode ?? mode;
    if (!msg && activeMode !== "summary") return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: activeMode === "summary" ? "Session summary" : msg,
      mode: activeMode,
      timestamp: new Date(),
    };
    recognitionRef.current?.stop();
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    try {
      // Errors are UI-only; never feed them back to the model as history.
      const history = messages.filter(m => !m.isError).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, message: msg, mode: activeMode }),
      });

      const coachId = (Date.now() + 1).toString();
      const addCoach = (content: string, extra: Partial<Message> = {}) =>
        setMessages(prev => [...prev, {
          id: coachId, role: "coach", content, mode: activeMode, timestamp: new Date(), ...extra,
        }]);
      const patchCoach = (content: string, extra: Partial<Message> = {}) =>
        setMessages(prev => prev.map(m => (m.id === coachId ? { ...m, content, ...extra } : m)));

      // Errors thrown before the stream opens come back as JSON.
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        addCoach(data.error || "Something went wrong.", { isError: true });
        return;
      }

      // Stream tokens into the bubble as they arrive.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let started = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        if (!started) { started = true; setLoading(false); addCoach(full); }
        else patchCoach(full);
      }
      if (!started) {
        addCoach("Gemini returned no text output.", { isError: true });
      } else if (activeMode === "play") {
        const diagram = extractDiagram(full);
        if (diagram) patchCoach(full, { diagram });
      }
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "coach",
        content: "Network error — check your connection and try again.",
        isError: true,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, mode, messages]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const isEmpty = messages.length === 0;
  const canSend = !loading && (input.trim().length > 0 || mode === "summary");

  return (
    <div className="flex h-dvh flex-col">
      {/* ── Header ── */}
      <header className="shrink-0 border-b border-line/70 bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <CoachAvatar size={40} />
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-bold uppercase tracking-wider">Coach Carter</h1>
                <span className="rounded-md border border-ember-500/30 bg-ember-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ember-400">
                  AI
                </span>
              </div>
              <p className="text-xs text-dust">Basketball Coaching Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.07] px-2.5 py-1 sm:flex">
              <span className="size-1.5 animate-pulse rounded-full bg-ok" />
              <span className="font-mono text-[10px] font-medium tracking-wider text-ok">LIVE</span>
            </div>
            <ThemeToggle />
            {!isEmpty && (
              <button
                onClick={() => setMessages([])}
                title="Clear session"
                aria-label="Clear session"
                className="rounded-lg p-2 text-dust transition hover:bg-ink-800 hover:text-ember-400"
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        </div>

        {/* ── Mode tabs ── */}
        <nav className="no-scrollbar mx-auto flex w-full max-w-3xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6" aria-label="Mode">
          {(Object.keys(MODE_META) as Mode[]).map(key => {
            const { icon: Icon, label } = MODE_META[key];
            const active = mode === key;
            return (
              <button
                key={key}
                onClick={() => { setMode(key); if (key === "summary") send("", "summary"); }}
                aria-current={active ? "page" : undefined}
                className={`relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition focus-visible:outline-2 focus-visible:outline-ember-500 ${
                  active ? "text-ember-300" : "text-dust hover:text-chalk"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mode-pill"
                    className="absolute inset-0 rounded-full border border-ember-500/40 bg-ember-500/[0.12]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon size={14} className="relative" />
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* ── Messages ── */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
          {isEmpty ? (
            <EmptyState mode={mode} onSend={send} />
          ) : (
            messages.map(msg => <Bubble key={msg.id} msg={msg} />)
          )}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* ── Composer ── */}
      <footer className="shrink-0 bg-gradient-to-t from-ink-950 via-ink-950 to-transparent pt-2">
        <div className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">
          <AnimatePresence>
            {!isEmpty && !loading && SUGGESTIONS[mode].length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="no-scrollbar mb-3 flex gap-2 overflow-x-auto"
              >
                {SUGGESTIONS[mode].slice(0, 4).map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="shrink-0 whitespace-nowrap rounded-full border border-line bg-ink-900/80 px-3.5 py-1.5 text-xs font-medium text-dust transition hover:border-ember-500/50 hover:text-ember-300"
                  >
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {voiceError && (
              <motion.p
                role="status"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-2 rounded-lg border border-red-500/25 bg-red-500/[0.07] px-3 py-2 text-xs text-err"
              >
                {voiceError}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-2 rounded-2xl border border-line bg-ink-900 py-2 pl-4 pr-2 shadow-[0_8px_30px_var(--shadow)] transition focus-within:border-ember-500/60 focus-within:shadow-[0_0_0_4px_rgb(255_107_26/0.1),0_8px_30px_var(--shadow)]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
              }}
              onKeyDown={handleKey}
              placeholder={MODE_META[mode].placeholder}
              rows={1}
              disabled={loading}
              className="max-h-36 flex-1 resize-none self-center bg-transparent py-1.5 text-[15px] leading-relaxed text-chalk caret-ember-500 outline-none placeholder:text-dust/60"
            />

            <div className="relative shrink-0">
              <AnimatePresence>
                {listening && (
                  <motion.div
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0, y: 6, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.92 }}
                    transition={{ duration: 0.18 }}
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-3 -translate-x-1/2"
                  >
                    <div className="relative flex items-center gap-1.5 whitespace-nowrap rounded-full border border-ember-500/40 bg-ink-900 px-3 py-1.5 shadow-[0_6px_20px_var(--shadow)]">
                      <span className="flex items-center gap-1" aria-hidden>
                        {[0, 1, 2].map(i => (
                          <span key={i} className="typing-dot size-1.5 rounded-full bg-ember-500" />
                        ))}
                      </span>
                      <span className="text-[11px] font-medium text-ember-400">Listening</span>
                      {/* tail pointing at the mic */}
                      <span className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-ember-500/40 bg-ink-900" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={toggleVoice}
                title={listening ? "Stop listening" : "Voice input"}
                aria-label={listening ? "Stop listening" : "Voice input"}
                className={`flex size-10 items-center justify-center rounded-xl transition hover:bg-ink-800 ${
                  listening ? "bg-ember-500/15 text-ember-400" : "text-dust"
                }`}
              >
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => send()}
              disabled={!canSend}
              aria-label="Send"
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition ${
                canSend
                  ? "bg-gradient-to-br from-ember-500 to-ember-600 text-white shadow-[0_4px_16px_rgb(255_107_26/0.4)]"
                  : "bg-ink-800 text-dust/40"
              }`}
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </motion.button>
          </div>

          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-dust/40">
            Powered by Google Gemini · Coach Carter AI
          </p>
        </div>
      </footer>
    </div>
  );
}
