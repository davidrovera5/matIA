"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export type AmbientPreset = {
  id:    string;
  label: string;
  icon:  string;
  src:   string;
};

export const AMBIENT_PRESETS: AmbientPreset[] = [
  { id: "rain", label: "Lluvia",     icon: "🌧",  src: "/ambient/rain.mp3" },
  { id: "cafe", label: "Café",       icon: "☕",  src: "/ambient/cafe.mp3" },
  { id: "lofi", label: "Lo-fi",      icon: "🎧", src: "/ambient/lofi.mp3" },
  { id: "fire", label: "Chimenea",   icon: "🔥", src: "/ambient/fire.mp3" },
];

const STORAGE_KEY = "matia.ambient.v1";
const DUCK_FACTOR = 0.4; // cuando el usuario habla, la música baja a 40 %

type Persisted = Record<string, number>; // presetId → 0..1 (0 = off)

function readPersisted(): Persisted {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writePersisted(v: Persisted) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch {}
}

export function useAmbient(isUserSpeaking: boolean) {
  // volumes[presetId] → 0..1. 0 significa apagado.
  const [volumes, setVolumes] = useState<Record<string, number>>(() => readPersisted());
  const elementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Persist
  useEffect(() => { writePersisted(volumes); }, [volumes]);

  // Crear/destruir audio elements seg\u00fan si el preset est\u00e1 activo (vol > 0)
  useEffect(() => {
    AMBIENT_PRESETS.forEach((p) => {
      const vol    = volumes[p.id] ?? 0;
      const active = vol > 0;
      const el     = elementsRef.current.get(p.id);

      if (active && !el) {
        const a = new Audio(p.src);
        a.loop   = true;
        a.volume = vol * (isUserSpeaking ? DUCK_FACTOR : 1);
        a.play().catch(() => {
          // autoplay bloqueado: se resuelve en el siguiente click del usuario
        });
        elementsRef.current.set(p.id, a);
      } else if (!active && el) {
        el.pause();
        el.src = "";
        elementsRef.current.delete(p.id);
      }
    });
  }, [volumes, isUserSpeaking]);

  // Ajustar vol\u00famenes en vivo (con ducking)
  useEffect(() => {
    elementsRef.current.forEach((el, id) => {
      const v = volumes[id] ?? 0;
      el.volume = Math.max(0, Math.min(1, v * (isUserSpeaking ? DUCK_FACTOR : 1)));
    });
  }, [volumes, isUserSpeaking]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      elementsRef.current.forEach((el) => { el.pause(); el.src = ""; });
      elementsRef.current.clear();
    };
  }, []);

  const setVolume = useCallback((id: string, v: number) => {
    setVolumes((prev) => ({ ...prev, [id]: Math.max(0, Math.min(1, v)) }));
  }, []);

  const stopAll = useCallback(() => {
    setVolumes({});
  }, []);

  const anyActive = Object.values(volumes).some((v) => v > 0);

  return { volumes, setVolume, stopAll, anyActive };
}
