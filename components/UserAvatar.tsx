"use client";
import { useState, useRef, useEffect } from "react";
import { User } from "@/types";
import { useVoiceActivity } from "@/hooks/useVoiceActivity";

interface Props {
  user: User;
  hasMate: boolean;
  isCurrentUser: boolean;
  stream?: MediaStream | null;
  onActivityChange?: (activity: string) => void;
  volume?: number;
  onVolumeChange?: (v: number) => void;
}

export default function UserAvatar({
  user, hasMate, isCurrentUser, stream, onActivityChange,
  volume, onVolumeChange,
}: Props) {
  const [editing,   setEditing]   = useState(false);
  const [draft,     setDraft]     = useState(user.activity ?? "");
  const [volumeOpen, setVolumeOpen] = useState(false);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const popoverRef                = useRef<HTMLDivElement>(null);

  const canControlVolume = !isCurrentUser && !!stream && !!onVolumeChange;

  useEffect(() => {
    if (!volumeOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setVolumeOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setVolumeOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown",   onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown",   onEsc);
    };
  }, [volumeOpen]);

  if (!editing && draft !== user.activity) setDraft(user.activity);

  const isSpeaking = useVoiceActivity(stream ?? null);

  const commit = () => {
    setEditing(false);
    if (draft !== user.activity) onActivityChange?.(draft);
  };

  const label = user.activity ? `${user.name} · ${user.activity}` : user.name;

  return (
    <div className="flex flex-col items-center gap-1.5">

      {/* ── Card (click = abrir control de volumen si es peer remoto) ─────── */}
      <div className="relative" ref={popoverRef}>
      <div
        onClick={canControlVolume ? () => setVolumeOpen((v) => !v) : undefined}
        title={canControlVolume ? `Ajustar volumen de ${user.name}` : undefined}
        style={{
          width:        "clamp(64px, 18vw, 96px)",
          height:       "clamp(74px, 21vw, 112px)",
          borderRadius: 22,
          cursor:       canControlVolume ? "pointer" : "default",
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
        <span style={{ fontSize: "clamp(26px, 8vw, 40px)", lineHeight: 1 }}>{user.avatar}</span>

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

        {/* ── Badge de volumen atenuado (solo si peer remoto con vol < 1) ── */}
        {canControlVolume && (volume ?? 1) < 1 && (
          <span
            style={{
              position: "absolute", top: 5, left: 6,
              fontSize: 11, lineHeight: 1,
              background: "rgba(26,18,11,0.9)",
              borderRadius: 999,
              padding: "2px 4px",
              border: "1px solid rgba(132,204,22,0.25)",
            }}
            title={`Volumen al ${Math.round((volume ?? 1) * 100)}%`}
          >
            {(volume ?? 1) === 0 ? "🔇" : "🔉"}
          </span>
        )}
      </div>

      {/* ── Popover de volumen ── */}
      {volumeOpen && canControlVolume && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 rounded-xl shadow-xl z-40"
          style={{
            width:          170,
            padding:        "10px 12px",
            background:     "rgba(26,18,11,0.97)",
            border:         "1px solid rgba(132,204,22,0.18)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "#7a6050" }}>
              Volumen
            </span>
            <span className="text-[10px] font-mono" style={{ color: "#84cc16" }}>
              {Math.round((volume ?? 1) * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onVolumeChange!((volume ?? 1) === 0 ? 1 : 0)}
              className="shrink-0 text-xs transition-all hover:scale-110"
              style={{ color: (volume ?? 1) === 0 ? "#ef4444" : "#7a6050" }}
              title={(volume ?? 1) === 0 ? "Activar" : "Silenciar"}
            >
              {(volume ?? 1) === 0 ? "🔇" : "🔊"}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume ?? 1}
              onChange={(e) => onVolumeChange!(parseFloat(e.target.value))}
              className="flex-1 accent-yerba-500"
              style={{ height: 3, cursor: "pointer" }}
              aria-label={`Volumen de ${user.name}`}
            />
          </div>
        </div>
      )}
      </div>

      {/* ── Name ── */}
      <span className="text-xs font-semibold whitespace-nowrap"
        style={{ color: hasMate ? "#84cc16" : "#c4b09a" }}>
        {label}
      </span>

      {/* ── Activity ── */}
      <div className="flex justify-center" style={{ width: "clamp(64px, 18vw, 96px)" }}>
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
