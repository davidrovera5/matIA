"use client";
import { useState, useRef } from "react";
import { User } from "@/types";
import { useVoiceActivity } from "@/hooks/useVoiceActivity";

interface Props {
  user: User;
  hasMate: boolean;
  isCurrentUser: boolean;
  stream?: MediaStream | null;
  onActivityChange?: (activity: string) => void;
}

export default function UserAvatar({
  user, hasMate, isCurrentUser, stream, onActivityChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(user.activity ?? "");
  const inputRef              = useRef<HTMLInputElement>(null);

  if (!editing && draft !== user.activity) setDraft(user.activity);

  const isSpeaking = useVoiceActivity(stream ?? null);

  const commit = () => {
    setEditing(false);
    if (draft !== user.activity) onActivityChange?.(draft);
  };

  const label = user.activity ? `${user.name} · ${user.activity}` : user.name;

  return (
    <div className="flex flex-col items-center gap-1.5">

      {/* ── Card ─────────────────────────────────────────────────────────────── */}
      <div
        style={{
          width:        96,
          height:       112,
          borderRadius: 22,
          border:       isSpeaking
            ? "2px solid #84cc16"
            : hasMate
            ? "2px solid #84cc16"
            : "2px solid rgba(255,255,255,0.07)",
          boxShadow:    isSpeaking
            ? undefined
            : hasMate
            ? "0 0 0 3px rgba(132,204,22,0.18), 0 0 28px rgba(132,204,22,0.55)"
            : isCurrentUser
            ? "0 0 0 2px rgba(240,235,229,0.12)"
            : "none",
          animation:    isSpeaking ? "voice-glow 0.6s ease-in-out infinite" : undefined,
          overflow:     "hidden",
          position:     "relative",
          transform:    hasMate ? "scale(1.06)" : "scale(1)",
          transition:   "transform 0.35s ease",
          flexShrink:   0,
          background:   "linear-gradient(145deg, rgba(57,88,10,0.55) 0%, rgba(20,40,5,0.88) 100%)",
          display:      "flex",
          flexDirection: "column",
          alignItems:   "center",
          justifyContent: "center",
          gap:          4,
        }}
      >
        {/* ── Static avatar emoji ── */}
        <span style={{ fontSize: 40, lineHeight: 1 }}>{user.avatar}</span>

        {/* ── Mate badge ── */}
        {hasMate && (
          <span style={{ position: "absolute", top: 5, right: 6, fontSize: 12, lineHeight: 1,
            filter: "drop-shadow(0 0 4px rgba(132,204,22,0.8))" }}>
            🧉
          </span>
        )}

        {/* ── Speaking dot ── */}
        {isSpeaking && (
          <span style={{
            position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)",
            width: 7, height: 7, borderRadius: "50%",
            background: "#84cc16", boxShadow: "0 0 6px #84cc16",
          }} />
        )}
      </div>

      {/* ── Name ── */}
      <span className="text-xs font-semibold whitespace-nowrap"
        style={{ color: hasMate ? "#84cc16" : "#c4b09a" }}>
        {label}
      </span>

      {/* ── Activity ── */}
      <div className="w-24 flex justify-center">
        {isCurrentUser && editing ? (
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter")  commit();
              if (e.key === "Escape") { setDraft(user.activity); setEditing(false); }
            }}
            className="w-full text-center text-xs rounded-full px-2 py-0.5 outline-none border border-yerba-600/50 focus:border-yerba-500"
            style={{ background: "rgba(38,21,9,0.85)", color: "#f0ebe5" }}
            placeholder="¿Qué estudiás?"
          />
        ) : (
          <button
            onClick={() => isCurrentUser && setEditing(true)}
            className={`text-xs rounded-full px-2 py-0.5 max-w-full truncate transition-all ${
              isCurrentUser ? "hover:text-yerba-400 cursor-text" : "cursor-default"
            }`}
            style={{ color: isCurrentUser ? "#7a6050" : "#4a3020" }}
            title={isCurrentUser ? "Clic para editar" : user.activity}
          >
            {user.activity
              ? user.activity
              : isCurrentUser
              ? <span style={{ color: "#3d2414", fontStyle: "italic" }}>+ actividad</span>
              : null}
          </button>
        )}
      </div>
    </div>
  );
}
