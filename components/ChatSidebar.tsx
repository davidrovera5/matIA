"use client";
import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/types";

interface Props {
  messages: ChatMessage[];
  myId: string;
  onSend: (text: string) => void;
  onClose: () => void;
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg)(\?.*)?$/i;
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function MessageContent({ text }: { text: string }) {
  const parts = text.split(URL_REGEX);
  return (
    <span className="break-words whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (!URL_REGEX.test(part)) return <span key={i}>{part}</span>;
        URL_REGEX.lastIndex = 0;
        const isImage = IMAGE_EXT.test(part);
        return (
          <span key={i} className="flex flex-col gap-1 mt-1">
            <a href={part} target="_blank" rel="noopener noreferrer"
              className="text-yerba-400 underline underline-offset-2 hover:text-yerba-300 break-all">
              {part}
            </a>
            {isImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={part} alt="preview"
                className="max-w-[180px] max-h-[120px] rounded-lg object-cover mt-1"
                style={{ border: "1px solid rgba(132,204,22,0.2)" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatSidebar({ messages, myId, onSend, onClose }: Props) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
    inputRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        className="md:hidden fixed inset-0 z-40"
        style={{ background: "rgba(15,10,6,0.6)", backdropFilter: "blur(4px)" }}
        aria-hidden
      />
      <div className="glass-strong flex flex-col shadow-2xl shrink-0
                      fixed md:static inset-y-0 right-0 z-50
                      w-[88vw] max-w-sm md:w-80 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 pt-safe"
           style={{ borderBottom: "1px solid rgba(132,204,22,0.1)" }}>
        <h2 className="text-sm font-bold text-[#f0ebe5] tracking-wide">💬 Chat de sala</h2>
        <button onClick={onClose}
          className="text-xl leading-none transition-colors hover:text-yerba-400 w-8 h-8 flex items-center justify-center"
          style={{ color: "#7a6050" }}
          aria-label="Cerrar chat">✕</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-[11px] text-center mt-8" style={{ color: "#3d2414" }}>
            Nadie habló todavía.<br />¡Rompé el hielo! 🧉
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.userId === myId;
          return (
            <div key={msg.id} className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
              <div className="flex items-baseline gap-2">
                {!isMe && <span className="text-xs font-bold text-yerba-500">{msg.userName}</span>}
                <span className="text-[10px]" style={{ color: "#3d2414" }}>{formatTime(msg.timestamp)}</span>
              </div>
              <div
                className="max-w-[220px] px-3 py-2 rounded-2xl text-sm leading-relaxed"
                style={isMe
                  ? { background: "rgba(101,163,13,0.25)", border: "1px solid rgba(132,204,22,0.3)", color: "#f0ebe5", borderRadius: "1rem 0.25rem 1rem 1rem" }
                  : { background: "rgba(38,21,9,0.7)", border: "1px solid rgba(255,255,255,0.07)", color: "#c4b09a", borderRadius: "0.25rem 1rem 1rem 1rem" }
                }
              >
                <MessageContent text={msg.text} />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 shrink-0 pb-safe" style={{ borderTop: "1px solid rgba(132,204,22,0.1)" }}>
        <div className="flex items-end gap-2 rounded-xl px-3 py-2"
             style={{ background: "rgba(38,21,9,0.7)", border: "1px solid rgba(132,204,22,0.12)" }}>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Mandá un mensaje…"
            rows={1}
            maxLength={500}
            className="flex-1 bg-transparent text-base sm:text-sm resize-none outline-none max-h-28 leading-relaxed"
            style={{ color: "#f0ebe5" }}
          />
          <button onClick={submit} disabled={!draft.trim()}
            className="text-xl sm:text-lg pb-0.5 transition-colors w-8 h-8 flex items-center justify-center shrink-0"
            style={{ color: draft.trim() ? "#84cc16" : "#3d2414" }}
            aria-label="Enviar">➤</button>
        </div>
        <p className="hidden sm:block text-[10px] mt-1 text-right" style={{ color: "#3d2414" }}>Shift+Enter para nueva línea</p>
      </div>
      </div>
    </>
  );
}
