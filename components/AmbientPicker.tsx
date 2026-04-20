"use client";
import { useEffect, useRef } from "react";
import { AMBIENT_PRESETS } from "@/hooks/useAmbient";

interface Props {
  open:      boolean;
  volumes:   Record<string, number>;
  onVolume:  (id: string, v: number) => void;
  onStopAll: () => void;
  onClose:   () => void;
}

export default function AmbientPicker({ open, volumes, onVolume, onStopAll, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al clickear fuera
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown",   onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown",   onEsc);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 rounded-2xl p-3 shadow-xl z-30"
      style={{
        width:        260,
        background:   "rgba(26,18,11,0.97)",
        border:       "1px solid rgba(132,204,22,0.18)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold tracking-wider uppercase" style={{ color: "#84cc16" }}>
          🌧 Ambiente
        </span>
        <button
          onClick={onStopAll}
          className="text-[10px] px-2 py-0.5 rounded-full transition-all hover:scale-105"
          style={{ color: "#7a6050", border: "1px solid rgba(132,204,22,0.15)" }}
          title="Apagar todos"
        >
          Apagar todo
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {AMBIENT_PRESETS.map((p) => {
          const v      = volumes[p.id] ?? 0;
          const active = v > 0;
          return (
            <div key={p.id} className="flex items-center gap-2">
              <button
                onClick={() => onVolume(p.id, active ? 0 : 0.5)}
                className="shrink-0 rounded-lg transition-all hover:scale-105"
                style={{
                  width:      36,
                  height:     36,
                  background: active ? "linear-gradient(135deg, #4d7c0f, #84cc16)" : "rgba(38,21,9,0.8)",
                  border:     active ? "1px solid rgba(132,204,22,0.5)" : "1px solid rgba(132,204,22,0.15)",
                  boxShadow:  active ? "0 0 10px rgba(132,204,22,0.3)" : "none",
                  fontSize:   18,
                }}
                title={active ? `Apagar ${p.label}` : `Activar ${p.label}`}
              >
                {p.icon}
              </button>
              <div className="flex-1 flex flex-col gap-0.5">
                <span className="text-[11px]" style={{ color: active ? "#c4b09a" : "#4a3020" }}>
                  {p.label}
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={v}
                  onChange={(e) => onVolume(p.id, parseFloat(e.target.value))}
                  className="w-full accent-yerba-500"
                  style={{ height: 3, cursor: "pointer" }}
                  aria-label={`Volumen de ${p.label}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] mt-2 text-center" style={{ color: "#3d2414" }}>
        Solo vos lo escuchás · baja automáticamente cuando hablás
      </p>
    </div>
  );
}
