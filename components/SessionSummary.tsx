"use client";
import { SessionSummary as Summary } from "@/types";
import Logo from "./Logo";

interface Props {
  summary: Summary;
  onDismiss: () => void;
}

function fmt(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function SessionSummary({ summary, onDismiss }: Props) {
  const { totalSeconds, studySeconds, breakSeconds } = summary;
  const studyPct = totalSeconds > 0 ? Math.round((studySeconds / totalSeconds) * 100) : 0;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
         style={{ background: "rgba(15,10,6,0.85)", backdropFilter: "blur(8px)" }}>
      <div className="glass-strong rounded-3xl shadow-2xl w-full max-w-md p-8 flex flex-col gap-6"
           style={{ boxShadow: "0 0 60px rgba(132,204,22,0.12)" }}>

        {/* Header */}
        <div className="text-center flex flex-col items-center gap-3">
          <Logo size="md" />
          <div>
            <h2 className="text-2xl font-black text-[#f0ebe5]">¡Sesión finalizada!</h2>
            <p className="text-sm mt-1" style={{ color: "#7a6050" }}>Resumen de la ronda de mate</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total" value={fmt(totalSeconds)} icon="⏱️" color="#f0ebe5" />
          <StatCard label="Estudiando" value={fmt(studySeconds)} icon="🧠" color="#84cc16" />
          <StatCard label="Descanso" value={fmt(breakSeconds)} icon="☕" color="#60a5fa" />
        </div>

        {/* Focus bar */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-xs" style={{ color: "#7a6050" }}>
            <span>Foco</span>
            <span className="text-yerba-500 font-bold">{studyPct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(38,21,9,0.8)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${studyPct}%`,
                background: "linear-gradient(90deg, #4d7c0f, #84cc16)",
                boxShadow: "0 0 8px rgba(132,204,22,0.5)",
              }}
            />
          </div>
        </div>

        {/* Motivation */}
        <p className="text-center text-sm italic" style={{ color: "#7a6050" }}>
          {studyPct >= 70
            ? "¡Excelente sesión! Estuviste muy concentrado. 🔥"
            : studyPct >= 40
            ? "Buen trabajo, el mate ayuda a mantener el ritmo. 🧉"
            : "Toda sesión cuenta. ¡La próxima va con más energía! 💪"}
        </p>

        <button onClick={onDismiss} className="btn-yerba w-full text-center">
          Volver al inicio
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="rounded-2xl p-3 flex flex-col items-center gap-1"
         style={{ background: "rgba(38,21,9,0.7)", border: "1px solid rgba(132,204,22,0.1)" }}>
      <span className="text-xl">{icon}</span>
      <span className="text-lg font-black" style={{ color }}>{value}</span>
      <span className="text-xs text-center" style={{ color: "#4a3020" }}>{label}</span>
    </div>
  );
}
