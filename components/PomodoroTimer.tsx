"use client";
import { useState } from "react";
import { TimerState, TimerConfig } from "@/types";

interface Props {
  timer: TimerState;
  timerConfig: TimerConfig;
  isHost: boolean;
  onToggle: () => void;
  onReset: () => void;
  onConfigChange: (workMinutes: number, breakMinutes: number) => void;
}

export default function PomodoroTimer({ timer, timerConfig, isHost, onToggle, onReset, onConfigChange }: Props) {
  const { phase, secondsLeft, isRunning } = timer;
  const [editing, setEditing] = useState(false);
  const [wm, setWm] = useState(String(timerConfig.workMinutes));
  const [bm, setBm] = useState(String(timerConfig.breakMinutes));

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  if (!editing && (wm !== String(timerConfig.workMinutes) || bm !== String(timerConfig.breakMinutes))) {
    setWm(String(timerConfig.workMinutes));
    setBm(String(timerConfig.breakMinutes));
  }

  const applyConfig = () => {
    const w = Math.max(1, Math.min(90, parseInt(wm) || 25));
    const b = Math.max(1, Math.min(30, parseInt(bm) || 5));
    onConfigChange(w, b);
    setWm(String(w)); setBm(String(b));
    setEditing(false);
  };

  const isWork = phase === "work";

  return (
    <div className="flex flex-col items-center justify-center gap-2 px-2">
      {/* Phase label */}
      <span className={`text-[11px] font-bold uppercase tracking-widest ${isWork ? "text-yerba-500" : "text-blue-400"}`}>
        {isWork ? "🧉 Estudiando" : "☕ Descanso"}
      </span>

      {/* Timer digits */}
      <div
        className="text-5xl font-black tabular-nums tracking-tight"
        style={{ color: isWork ? "#84cc16" : "#60a5fa", textShadow: isWork ? "0 0 20px rgba(132,204,22,0.4)" : "0 0 20px rgba(96,165,250,0.4)" }}
      >
        {minutes}:{seconds}
      </div>

      {/* Config editor (host, timer stopped) */}
      {isHost && !isRunning && editing ? (
        <div className="flex flex-col items-center gap-2 mt-1">
          <div className="flex gap-3 items-center text-xs" style={{ color: "#a89880" }}>
            <label className="flex items-center gap-1">
              🧠
              <input type="number" min={1} max={90} value={wm} onChange={(e) => setWm(e.target.value)}
                className="w-12 text-center rounded-lg px-1 py-0.5 outline-none border border-white/10 focus:border-yerba-500"
                style={{ background: "rgba(38,21,9,0.9)", color: "#f0ebe5" }}
              />
              min
            </label>
            <label className="flex items-center gap-1">
              ☕
              <input type="number" min={1} max={30} value={bm} onChange={(e) => setBm(e.target.value)}
                className="w-12 text-center rounded-lg px-1 py-0.5 outline-none border border-white/10 focus:border-blue-400"
                style={{ background: "rgba(38,21,9,0.9)", color: "#f0ebe5" }}
              />
              min
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={applyConfig} className="px-3 py-1 bg-yerba-600 hover:bg-yerba-500 text-white text-xs font-bold rounded-full transition-all">
              Aplicar
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1 text-xs rounded-full transition-all border border-white/10 hover:border-white/20" style={{ color: "#a89880" }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-1">
          {isHost ? (
            <>
              <button
                onClick={onToggle}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all text-white ${
                  isRunning ? "bg-red-600 hover:bg-red-500" : "bg-yerba-600 hover:bg-yerba-500 hover:shadow-glow-yerba"
                }`}
              >
                {isRunning ? "⏸" : "▶"}
              </button>
              <button onClick={onReset}
                className="px-3 py-1.5 rounded-full text-sm border border-white/10 hover:border-white/20 transition-all"
                style={{ color: "#a89880" }}
              >↺</button>
              {!isRunning && (
                <button onClick={() => setEditing(true)} title="Configurar duración"
                  className="px-3 py-1.5 rounded-full text-sm border border-white/10 hover:border-yerba-600/40 transition-all"
                  style={{ color: "#7a6050" }}
                >⚙️</button>
              )}
            </>
          ) : (
            <p className="text-[11px]" style={{ color: "#4a3020" }}>Solo el host controla el timer</p>
          )}
        </div>
      )}
    </div>
  );
}
