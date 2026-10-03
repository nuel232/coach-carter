"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Zap, BookOpen, Layout, FileText, Mic, MicOff, X } from "lucide-react";
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

/* ── Quick suggestions ─────────────────────────────────────────────── */
const SUGGESTIONS: Record<Mode, string[]> = {
  chat: [
    "How do I improve my free throw %?",
    "Best drills for ball-handling",
    "How to defend pick and roll?",
    "Keys to winning close games",
    "Mental toughness tips",
  ],
  drill: [
    "Point guard ball handling",
    "Center post moves",
    "Perimeter shooting",
    "Defensive footwork",
    "Fast break finishing",
  ],
  play: [
    "Pick and Roll",
    "Horns set",
    "Flex offense",
    "Princeton offense",
    "Motion offense",
  ],
  summary: [],
};

const MODE_META = {
  chat:    { label: "Ask Carter",    icon: Zap,      color: "#f97316", desc: "Chat with your AI coach" },
  drill:   { label: "Drill Plan",    icon: BookOpen, color: "#3b82f6", desc: "Get a custom practice plan" },
  play:    { label: "Play Diagram",  icon: Layout,   color: "#22c55e", desc: "Visualise plays on court" },
  summary: { label: "Session Summary", icon: FileText, color: "#a855f7", desc: "Recap this session" },
};

/* ── Markdown-ish renderer ─────────────────────────────────────────── */
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
      if (line) out.push(`<p>${line}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}

/* ── Extract JSON diagram from text ───────────────────────────────── */
function extractDiagram(text: string) {
  try {
    const match = text.match(/\{[\s\S]*"positions"[\s\S]*"actions"[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return null;
}

function stripDiagramJson(text: string) {
  return text.replace(/```json[\s\S]*?```/g, "").replace(/\{[\s\S]*"positions"[\s\S]*"actions"[\s\S]*\}/, "").trim();
}

/* ── Message bubble ────────────────────────────────────────────────── */
function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const diagram = msg.diagram;
  const displayText = diagram ? stripDiagramJson(msg.content) : msg.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-lg">
          🏀
        </div>
      )}

      <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Role label */}
        <span className="text-[10px] font-mono tracking-widest text-neutral-500 px-1">
          {isUser ? "YOU" : "COACH CARTER"}
        </span>

        {/* Text bubble */}
        {displayText && (
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed msg-content ${
              isUser
                ? "bg-orange-500 text-white rounded-tr-sm"
                : "bg-[#1e1e1e] border border-[#2a2a2a] text-neutral-100 rounded-tl-sm"
            }`}
            dangerouslySetInnerHTML={{ __html: renderContent(displayText) }}
          />
        )}

        {/* Court diagram */}
        {diagram && (
          <div className="w-full max-w-[420px]">
            <CourtDiagram data={diagram} />
          </div>
        )}

        <span className="text-[9px] text-neutral-600 px-1">
          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
}

/* ── Typing indicator ──────────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <div className="w-9 h-9 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-lg">🏀</div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-mono tracking-widest text-neutral-500 px-1">COACH CARTER</span>
        <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[#1e1e1e] border border-[#2a2a2a] flex gap-1.5 items-center">
          {[0, 1, 2].map(i => (
            <div key={i} className="typing-dot w-2 h-2 rounded-full bg-orange-400" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────── */
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ── Voice input ── */
  const toggleVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Voice not supported in this browser."); return; }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      setInput(e.results[0][0].transcript);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening]);

  /* ── Send message ── */
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
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, message: msg, mode: activeMode }),
      });
      const data = await res.json();
      const text: string = data.text || data.error || "Something went wrong.";
      const diagram = activeMode === "play" ? extractDiagram(text) : null;

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "coach",
        content: text,
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
    <div className="flex flex-col h-screen max-h-screen bg-[#0f0f0f] text-white">

      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e] bg-[#0f0f0f]/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-xl">🏀</div>
          <div>
            <h1 className="font-bold text-sm tracking-wide">COACH CARTER AI</h1>
            <p className="text-[10px] text-neutral-500 font-mono">Basketball Coaching Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono text-green-400">LIVE</span>
          </div>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])}
              className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-white transition-colors"
              title="Clear session"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      {/* ── Mode tabs ── */}
      <div className="flex-shrink-0 flex gap-1 px-4 py-2 border-b border-[#1e1e1e] overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {(Object.entries(MODE_META) as [Mode, typeof MODE_META[Mode]][]).map(([key, meta]) => {
          const Icon = meta.icon;
          const active = mode === key;
          return (
            <button key={key}
              onClick={() => { setMode(key); if (key === "summary") send("", "summary"); }}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{
                background: active ? meta.color + "22" : "transparent",
                border: `1px solid ${active ? meta.color + "66" : "transparent"}`,
                color: active ? meta.color : "#737373",
              }}
            >
              <Icon size={12} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-5 min-h-0">
        {isEmpty && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full gap-6 text-center"
          >
            <div className="w-20 h-20 rounded-3xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-5xl">
              🏀
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">What's your question, Coach?</h2>
              <p className="text-sm text-neutral-500 max-w-xs">
                Ask anything — drills, plays, mindset, strategy. Carter has seen it all.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {SUGGESTIONS[mode].map(s => (
                <button key={s} onClick={() => send(s)}
                  className="px-3 py-2 rounded-xl text-xs border border-[#2a2a2a] hover:border-orange-500/40 hover:bg-orange-500/5 text-neutral-400 hover:text-white transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Suggestions strip (after first message) ── */}
      {!isEmpty && !loading && SUGGESTIONS[mode].length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {SUGGESTIONS[mode].slice(0, 4).map(s => (
            <button key={s} onClick={() => send(s)}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] border border-[#2a2a2a] hover:border-orange-500/40 hover:bg-orange-500/5 text-neutral-400 hover:text-white transition-all font-mono"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-[#1e1e1e]">
        <div className="flex gap-2 items-end">
          <div className="flex-1 flex items-end gap-2 px-4 py-2.5 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] focus-within:border-orange-500/40 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              onKeyDown={handleKey}
              placeholder={
                mode === "drill" ? "Describe the skill to train (e.g. 'Point guard finishing')…"
                : mode === "play" ? "Name a play (e.g. 'Pick and Roll', 'Horns set')…"
                : "Ask Coach Carter anything…"
              }
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none outline-none text-white placeholder-neutral-600 leading-relaxed"
              style={{ maxHeight: 120 }}
              disabled={loading}
            />
            <button onClick={toggleVoice}
              className={`flex-shrink-0 p-1 rounded-lg transition-colors ${listening ? "text-orange-400" : "text-neutral-600 hover:text-neutral-400"}`}
              title="Voice input"
            >
              {listening ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => send()}
            disabled={loading || (!input.trim() && mode !== "summary")}
            className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: loading ? "#333" : "#f97316" }}
          >
            <Send size={16} className="text-white" />
          </motion.button>
        </div>
        <p className="text-[10px] text-neutral-700 font-mono text-center mt-2">
          POWERED BY GOOGLE GEMINI · COACH CARTER AI
        </p>
      </div>
    </div>
  );
}
