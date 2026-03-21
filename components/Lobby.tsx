"use client";
import { useState } from "react";
import Logo from "./Logo";

interface Props {
  onCreate: (name: string) => void;
  onJoin: (roomId: string, name: string) => void;
  error: string;
}

export default function Lobby({ onCreate, onJoin, error }: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"choose" | "join">("choose");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-8"
         style={{ background: "radial-gradient(ellipse at 50% 60%, #2c1a0e 0%, #1a120b 70%)" }}>

      {/* Brand */}
      <div className="text-center flex flex-col items-center gap-2">
        <Logo size="lg" />
        <p className="text-[#a89880] text-sm mt-1 tracking-wide">
          Estudiá con amigos en la ronda de mate
        </p>
      </div>

      {/* Card */}
      <div className="glass-strong w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
        <input
          className="input-mate"
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onCreate(name.trim())}
        />

        {mode === "choose" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => name.trim() && onCreate(name.trim())}
              disabled={!name.trim()}
              className="btn-yerba w-full text-center"
            >
              Crear sala
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full py-3 rounded-xl text-[#a89880] hover:text-[#f0ebe5] font-semibold transition-all border border-white/10 hover:border-white/20"
              style={{ background: "rgba(38,21,9,0.5)" }}
            >
              🔗 Unirme con código
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="flex flex-col gap-3">
            <input
              className="input-mate uppercase tracking-widest text-center font-mono text-lg"
              placeholder="CÓDIGO DE SALA"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <button
              onClick={() => name.trim() && code.trim() && onJoin(code.trim(), name.trim())}
              disabled={!name.trim() || !code.trim()}
              className="btn-yerba w-full text-center"
            >
              Entrar a la sala
            </button>
            <button
              onClick={() => setMode("choose")}
              className="text-[#6b5540] text-sm hover:text-[#a89880] transition-all text-center"
            >
              ← Volver
            </button>
          </div>
        )}

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>

      <p className="text-[#3d2414] text-xs">v0.1 · Mate Night Edition</p>
    </div>
  );
}
