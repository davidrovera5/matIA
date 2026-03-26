"use client";
import { useEffect, useState } from "react";

const THRESHOLD = 8;   // RMS value 0-255 above which we consider speech
const COOLDOWN  = 500; // ms before marking as "not speaking" after silence

export function useVoiceActivity(stream: MediaStream | null): boolean {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!stream) { setIsSpeaking(false); return; }

    // Guard: SSR / no AudioContext
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;

    const ctx      = new Ctx() as AudioContext;
    const analyser = ctx.createAnalyser();
    analyser.fftSize                = 256;
    analyser.smoothingTimeConstant  = 0.5;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let raf: number;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);

      if (rms > THRESHOLD) {
        setIsSpeaking(true);
        if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
        silenceTimer = setTimeout(() => setIsSpeaking(false), COOLDOWN);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (silenceTimer) clearTimeout(silenceTimer);
      source.disconnect();
      analyser.disconnect();
      ctx.close().catch(() => {});
      setIsSpeaking(false);
    };
  }, [stream]);

  return isSpeaking;
}
