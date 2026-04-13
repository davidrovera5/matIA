"use client";
import { useState } from "react";
import Logo from "./Logo";
import { AVATARS } from "@/lib/avatars";

interface Props {
  onCreate: (name: string, avatar: string) => void;
  onJoin:   (roomId: string, name: string, avatar: string) => void;
  error:    string;
}

function BgParticles() {
  const particles = [
    { left: "8%",  delay: 0,   duration: 14 },
    { left: "22%", delay: 3,   duration: 18 },
    { left: "41%", delay: 7,   duration: 12 },
    { left: "63%", delay: 1.5, duration: 16 },
    { left: "78%", delay: 5,   duration: 20 },
    { left: "91%", delay: 9,   duration: 15 },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute select-none"
          style={{
            left: p.left, top: "-40px", fontSize: "20px", opacity: 0.12,
            animation: `mate-fall ${p.duration}s ${p.delay}s linear infinite,
                        mate-sway ${p.duration * 0.7}s ${p.delay}s ease-in-out infinite`,
          }}
        >
          🧉
        </span>
      ))}
    </div>
  );
}

export default function Lobby({ onCreate, onJoin, error }: Props) {
  const [name,           setName]          = useState("");
  const [code,           setCode]          = useState("");
  const [mode,           setMode]          = useState<"home" | "join">("home");
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AVATARS[0].emoji);

  const canCreate = name.trim().length > 0;
  const canJoin   = name.trim().length > 0 && code.trim().length > 0;

  const currentDef = AVATARS.find((a) => a.emoji === selectedAvatar) ?? AVATARS[0];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 55%, #2c1a0e 0%, #1a120b 65%)" }}
    >
      <BgParticles />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 w-full max-w-md">

        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <div className="flex flex-col items-center gap-1">
            <p className="text-lg font-semibold tracking-wide" style={{ color: "#a89880" }}>
              Un mate a la vez
            </p>
            <p className="text-xs tracking-widest uppercase" style={{ color: "#4a3020" }}>
              Estudia en compañía
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-1">
            {["⏱ Pomodoro", "🎙 Audio", "💬 Chat", "🧉 Ronda de mate"].map((f) => (
              <span key={f} className="text-xs px-3 py-1 rounded-full font-medium"
                style={{ background: "rgba(132,204,22,0.07)", border: "1px solid rgba(132,204,22,0.18)", color: "#84cc16" }}>
                {f}
              </span>
            ))}
          </div>
        </div>

        <div
          className="w-full rounded-3xl p-7 flex flex-col gap-5 shadow-2xl"
          style={{ background: "rgba(26,18,11,0.88)", border: "1px solid rgba(132,204,22,0.15)", backdropFilter: "blur(24px)" }}
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: "#7a6050" }}>Tu nombre</label>
            <input
              className="input-mate text-base"
              placeholder="ej: María"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate && mode === "home")
                  onCreate(name.trim(), selectedAvatar);
              }}
            />
          </div>

          {/* ── Avatar grid ────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold" style={{ color: "#7a6050" }}>
              Tu avatar
            </label>
            <div
              className="grid gap-1.5 p-2 rounded-2xl overflow-y-auto"
              style={{
                gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                maxHeight: 180,
                background: "rgba(38,21,9,0.4)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {AVATARS.map((av) => {
                const selected = av.emoji === selectedAvatar;
                return (
                  <button
                    key={av.emoji}
                    onClick={() => setSelectedAvatar(av.emoji)}
                    title={av.label}
                    style={{
                      aspectRatio: "1 / 1",
                      borderRadius: 12,
                      border:     selected
                        ? "2px solid #84cc16"
                        : "2px solid transparent",
                      background: selected
                        ? "rgba(132,204,22,0.14)"
                        : "rgba(38,21,9,0.5)",
                      boxShadow:  selected
                        ? "0 0 12px rgba(132,204,22,0.35)"
                        : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s ease",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        fontSize:  22,
                        animation: selected ? `${av.anim} ${av.speed} ease-in-out infinite` : undefined,
                        display:   "block",
                        lineHeight: 1,
                      }}
                    >
                      {av.emoji}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-center text-xs" style={{ color: "#4a3020" }}>
              {currentDef.label}
            </p>
          </div>

          {mode === "home" && (
            <>
              <button
                onClick={() => canCreate && onCreate(name.trim(), selectedAvatar)}
                disabled={!canCreate}
                className="btn-yerba w-full text-center text-base py-3.5"
              >
                Iniciar Ronda 🧉
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                <span className="text-xs" style={{ color: "#3d2414" }}>o</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>

              <button
                onClick={() => setMode("join")}
                className="w-full py-3 rounded-2xl font-semibold text-sm transition-all"
                style={{ background: "rgba(38,21,9,0.6)", border: "1px solid rgba(255,255,255,0.08)", color: "#a89880" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f0ebe5")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#a89880")}
              >
                🔗 Unirme con código
              </button>
            </>
          )}

          {mode === "join" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: "#7a6050" }}>Código de sala</label>
                <input
                  className="input-mate uppercase tracking-[0.25em] text-center font-mono text-xl"
                  placeholder="XXXXXX"
                  value={code}
                  autoFocus
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canJoin) onJoin(code.trim(), name.trim(), selectedAvatar);
                  }}
                  maxLength={6}
                />
              </div>

              <button
                onClick={() => canJoin && onJoin(code.trim(), name.trim(), selectedAvatar)}
                disabled={!canJoin}
                className="btn-yerba w-full text-center text-base py-3.5"
              >
                Entrar a la sala
              </button>

              <button
                onClick={() => setMode("home")}
                className="text-sm transition-all text-center"
                style={{ color: "#6b5540" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#a89880")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#6b5540")}
              >
                ← Volver
              </button>
            </>
          )}

          {error && (
            <p className="text-sm text-center rounded-xl px-4 py-2"
              style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </p>
          )}
        </div>

        <p className="text-xs" style={{ color: "#2a1a0e" }}>v0.1 · Mate Night Edition</p>
      </div>
    </div>
  );
}
