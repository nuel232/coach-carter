"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Zap, BookOpen, Layout, FileText, Mic, MicOff, RotateCcw, ChevronRight } from "lucide-react";
import CourtDiagram from "@/components/CourtDiagram";

/* ── Types ─────────────────────────────────────────────────────────── */
type Mode = "chat" | "drill" | "play" | "summary";
type Role = "user" | "coach";
interface Message {
  id: string;
  role: Role;
  content: string;
  mode?: Mode;
  diagram?: any;
  timestamp: Date;
}

/* ── Data ───────────────────────────────────────────────────────────── */
const SUGGESTIONS: Record<Mode, string[]> = {
  chat: ["Improve my free throw %", "Best ball-handling drills", "Defend pick and roll", "Keys to winning close games", "Mental toughness tips"],
  drill: ["Point guard ball handling", "Center post moves", "Perimeter shooting", "Defensive footwork", "Fast break finishing"],
  play: ["Pick and Roll", "Horns set", "Flex offense", "Princeton offense", "Motion offense"],
  summary: [],
};

const MODE_META = {
  chat:    { label: "Ask Carter",      icon: Zap,      color: "#f97316" },
  drill:   { label: "Drill Plan",      icon: BookOpen, color: "#3b82f6" },
  play:    { label: "Play Diagram",    icon: Layout,   color: "#22c55e" },
  summary: { label: "Session Summary", icon: FileText, color: "#a855f7" },
};

/* ── Helpers ────────────────────────────────────────────────────────── */
function renderContent(text: string) {
  const escaped = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
  const lines = escaped.split("\n");
  const out: string[] = [];
  let inList = false;
  for (const line of lines) {
    if (line.startsWith("- ")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${line.slice(2)}</li>`);
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      if (line.trim()) out.push(`<p>${line}</p>`);
    }
  }
  if (inList) out.push("</ul>");
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

/* ── Coach avatar ───────────────────────────────────────────────────── */
function CoachAvatar({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center rounded-full"
      style={{
        width: size, height: size,
        background: "linear-gradient(135deg, #f97316, #ea580c)",
        boxShadow: "0 0 0 2px #f9731622, 0 2px 8px #f9731644",
        fontSize: size * 0.48,
      }}
    >
      🏀
    </div>
  );
}

/* ── Message bubble ─────────────────────────────────────────────────── */
function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const diagram = msg.diagram;
  const displayText = diagram ? stripDiagramJson(msg.content) : msg.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      className={`flex gap-3 items-end ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {!isUser && <CoachAvatar />}

      <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`} style={{ maxWidth: "75%" }}>
        {displayText && (
          <div
            className={`px-4 py-3 text-sm leading-relaxed msg-content ${
              isUser
                ? "rounded-2xl rounded-br-md text-white"
                : "rounded-2xl rounded-bl-md text-neutral-100"
            }`}
            style={
              isUser
                ? { background: "linear-gradient(135deg, #f97316, #ea580c)", boxShadow: "0 2px 12px #f9731630" }
                : { background: "#161616", border: "1px solid #252525" }
            }
            dangerouslySetInnerHTML={{ __html: renderContent(displayText) }}
          />
        )}

        {diagram && (
          <div className="w-full" style={{ maxWidth: 420 }}>
            <CourtDiagram data={diagram} />
          </div>
        )}

        <span className="text-[10px] text-neutral-600 px-1">
          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
}

/* ── Typing indicator ───────────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 items-end"
    >
      <CoachAvatar />
      <div
        className="px-4 py-3 rounded-2xl rounded-bl-md flex gap-1.5 items-center"
        style={{ background: "#161616", border: "1px solid #252525" }}
      >
        {[0, 1, 2].map(i => (
          <div key={i} className="typing-dot w-2 h-2 rounded-full" style={{ background: "#f97316" }} />
        ))}
      </div>
    </motion.div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────── */
function EmptyState({ mode, onSend }: { mode: Mode; onSend: (s: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center h-full gap-8 px-4 text-center"
    >
      {/* Logo */}
      <div className="relative">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl"
          style={{
            background: "linear-gradient(135deg, #f9731618, #ea580c10)",
            border: "1px solid #f9731630",
            boxShadow: "0 0 40px #f9731618",
          }}
        >
          🏀
        </div>
        <div
          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: "#22c55e", fontSize: 11 }}
        >
          ✓
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-2 tracking-tight">
          {mode === "drill" ? "What skill are we sharpening?" :
           mode === "play" ? "Which play do you want to run?" :
           "What's on your mind, Coach?"}
        </h2>
        <p className="text-sm text-neutral-500 max-w-[280px] leading-relaxed">
          {mode === "drill" ? "Describe the position or skill and Carter will build a custom drill plan." :
           mode === "play" ? "Name any play and see it drawn on the court with player movement." :
           "Ask Coach Carter anything about basketball — strategy, drills, mindset, X's and O's."}
        </p>
      </div>

      {/* Suggestion chips */}
      {SUGGESTIONS[mode].length > 0 && (
        <div className="flex flex-col gap-2 w-full max-w-sm">
          {SUGGESTIONS[mode].map((s, i) => (
            <motion.button
              key={s}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => onSend(s)}
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm text-left transition-all group"
              style={{ background: "#131313", border: "1px solid #222" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "#f9731640";
                (e.currentTarget as HTMLElement).style.background = "#f9731608";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "#222";
                (e.currentTarget as HTMLElement).style.background = "#131313";
              }}
            >
              <span className="text-neutral-300">{s}</span>
              <ChevronRight size={14} className="text-neutral-600 group-hover:text-orange-400 transition-colors" />
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* Voice */
  const toggleVoice = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice not supported in this browser."); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e: any) => { setInput(e.results[0][0].transcript); setListening(false); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec; rec.start(); setListening(true);
  }, [listening]);

  /* Send */
  const send = useCallback(async (text?: string, overrideMode?: Mode) => {
    const msg = (text ?? input).trim();
    const activeMode = overrideMode ?? mode;
    if (!msg && activeMode !== "summary") return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: activeMode === "summary" ? "📋 Session summary" : msg,
      mode: activeMode,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, message: msg, mode: activeMode }),
      });
      const data = await res.json();
      const responseText: string = data.text || data.error || "Something went wrong.";
      const diagram = activeMode === "play" ? extractDiagram(responseText) : null;

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "coach",
        content: responseText,
        mode: activeMode,
        diagram,
        timestamp: new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "coach",
        content: "Network error — check your connection and try again.",
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

  return (
    <div className="flex flex-col h-screen" style={{ background: "#0a0a0a" }}>

      {/* ── Header ── */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-5 py-3"
        style={{
          background: "#0a0a0a",
          borderBottom: "1px solid #161616",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center gap-3">
          <CoachAvatar size={38} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-[15px] tracking-wide text-white">Coach Carter</h1>
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                style={{ background: "#f9731618", color: "#f97316", border: "1px solid #f9731630" }}
              >
                AI
              </span>
            </div>
            <p className="text-[11px]" style={{ color: "#555" }}>Basketball Coaching Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: "#22c55e0f", border: "1px solid #22c55e22" }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono text-green-400">LIVE</span>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              title="Clear session"
              className="p-2 rounded-xl transition-colors"
              style={{ color: "#444" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f97316")}
              onMouseLeave={e => (e.currentTarget.style.color = "#444")}
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </header>

      {/* ── Mode tabs ── */}
      <div
        className="flex-shrink-0 flex gap-1 px-4 py-2.5 overflow-x-auto"
        style={{ borderBottom: "1px solid #141414", scrollbarWidth: "none" }}
      >
        {(Object.entries(MODE_META) as [Mode, typeof MODE_META[Mode]][]).map(([key, meta]) => {
          const Icon = meta.icon;
          const active = mode === key;
          return (
            <motion.button
              key={key}
              onClick={() => { setMode(key); if (key === "summary") send("", "summary"); }}
              className="flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: active ? meta.color + "18" : "transparent",
                border: `1px solid ${active ? meta.color + "50" : "transparent"}`,
                color: active ? meta.color : "#444",
              }}
              whileTap={{ scale: 0.95 }}
            >
              <Icon size={13} />
              {meta.label}
            </motion.button>
          );
        })}
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: "0" }}>
        <div className="flex flex-col gap-4 px-4 py-5">
          {isEmpty
            ? <EmptyState mode={mode} onSend={send} />
            : messages.map(msg => <Bubble key={msg.id} msg={msg} />)
          }
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Suggestion strip (while chatting) ── */}
      <AnimatePresence>
        {!isEmpty && !loading && SUGGESTIONS[mode].length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex-shrink-0 flex gap-2 px-4 py-2 overflow-x-auto"
            style={{ scrollbarWidth: "none", borderTop: "1px solid #111" }}
          >
            {SUGGESTIONS[mode].slice(0, 4).map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={{ background: "#111", border: "1px solid #1e1e1e", color: "#666", whiteSpace: "nowrap" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#f9731440";
                  (e.currentTarget as HTMLElement).style.color = "#f97316";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#1e1e1e";
                  (e.currentTarget as HTMLElement).style.color = "#666";
                }}
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input bar ── */}
      <div
        className="flex-shrink-0 px-4 py-3"
        style={{ borderTop: "1px solid #141414", background: "#0a0a0a" }}
      >
        <div
          className="flex gap-3 items-end px-4 py-3 rounded-2xl transition-all"
          style={{ background: "#111", border: "1px solid #1e1e1e" }}
          onFocus={() => {}}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKey}
            placeholder={
              mode === "drill" ? "Describe the skill to train…" :
              mode === "play"  ? "Name a play (e.g. Pick and Roll)…" :
              "Ask Coach Carter anything…"
            }
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed"
            style={{ color: "#e5e5e5", maxHeight: 120, caretColor: "#f97316" }}
          />

          {/* Mic */}
          <button
            onClick={toggleVoice}
            className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
            style={{ color: listening ? "#f97316" : "#333" }}
            title="Voice input"
          >
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          {/* Send */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => send()}
            disabled={loading || (!input.trim() && mode !== "summary")}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: (!input.trim() && mode !== "summary") || loading ? "#1e1e1e" : "linear-gradient(135deg, #f97316, #ea580c)",
              boxShadow: (!input.trim() && mode !== "summary") || loading ? "none" : "0 2px 12px #f9731640",
            }}
          >
            <Send size={15} className="text-white" style={{ opacity: (!input.trim() && mode !== "summary") ? 0.3 : 1 }} />
          </motion.button>
        </div>

        <p className="text-center mt-2.5 text-[10px] font-mono tracking-widest" style={{ color: "#252525" }}>
          POWERED BY GOOGLE GEMINI · COACH CARTER AI
        </p>
      </div>
    </div>
  );
}
