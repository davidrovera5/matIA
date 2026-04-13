"use client";
import type { TimerState } from "@/types";

interface Props {
  timer:             TimerState;
  currentHolderName: string;
  iHolder:           boolean;
  isAudioActive:     boolean;
  isDeafened:        boolean;
  onPassMate:        () => void;
  onToggleMic:       () => void;
  onToggleDeafen:    () => void;
}

function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

/**
 * Minimal self-contained UI rendered inside the Document PiP window.
 * Uses only inline styles — no Tailwind classes, no external deps.
 */
export default function PipMiniView({
  timer, currentHolderName, iHolder, isAudioActive, isDeafened,
  onPassMate, onToggleMic, onToggleDeafen,
}: Props) {
  const timerColor = timer.phase === "work" ? "#84cc16" : "#60a5fa";

  return (
    <div style={{
      fontFamily:     "system-ui,-apple-system,sans-serif",
      background:     "#1a120b",
      color:          "#f0ebe5",
      height:         "100dvh",
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      gap:            14,
      padding:        "0 16px",
      boxSizing:      "border-box",
    }}>

      {/* ── Timer ─────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", lineHeight: 1 }}>
        <div style={{
          fontSize:         40,
          fontWeight:       900,
          fontVariantNumeric: "tabular-nums",
          letterSpacing:    "0.04em",
          color:            timerColor,
        }}>
          {fmt(timer.secondsLeft)}
        </div>
        <div style={{ marginTop: 4, fontSize: 10, color: "#7a6050", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {timer.phase === "work" ? "Trabajo" : "Descanso"}
          &nbsp;·&nbsp;
          {timer.isRunning ? "▶" : "⏸"}
        </div>
      </div>

      {/* ── Current holder ────────────────────────────────────────────────── */}
      <div style={{ fontSize: 11, color: "#7a6050" }}>
        Ceba:&nbsp;
        <span style={{ color: "#84cc16", fontWeight: 700 }}>{currentHolderName}</span>
      </div>

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onPassMate}
          disabled={!iHolder}
          style={{
            padding:      "7px 14px",
            borderRadius: 20,
            border:       "none",
            background:   iHolder
              ? "linear-gradient(135deg,#4d7c0f,#84cc16)"
              : "rgba(255,255,255,0.06)",
            color:        iHolder ? "#fff" : "#4a3020",
            fontWeight:   700,
            fontSize:     12,
            cursor:       iHolder ? "pointer" : "not-allowed",
            transition:   "opacity 0.2s",
          }}
        >
          Pasar 🧉
        </button>

        <button
          onClick={onToggleMic}
          style={{
            padding:      "7px 12px",
            borderRadius: 20,
            border:       `1px solid ${isAudioActive ? "rgba(132,204,22,0.4)" : "rgba(255,255,255,0.1)"}`,
            background:   isAudioActive ? "rgba(20,83,45,0.8)" : "rgba(38,21,9,0.8)",
            color:        isAudioActive ? "#86efac" : "#7a6050",
            fontSize:     12,
            cursor:       "pointer",
          }}
        >
          {isAudioActive ? "🎙 ON" : "🎙 OFF"}
        </button>

        <button
          onClick={onToggleDeafen}
          style={{
            padding:      "7px 12px",
            borderRadius: 20,
            border:       `1px solid ${isDeafened ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"}`,
            background:   isDeafened ? "rgba(127,29,29,0.8)" : "rgba(38,21,9,0.8)",
            color:        isDeafened ? "#fecaca" : "#7a6050",
            fontSize:     12,
            cursor:       "pointer",
          }}
        >
          {isDeafened ? "🔇" : "🔊"}
        </button>
      </div>
    </div>
  );
}
