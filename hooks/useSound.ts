"use client";

export function useMateSound() {
  const play = () => {
    try {
      // ruidoMate.m4a copied to public/sounds/mate.m4a
      const audio = new Audio("/sounds/mate.m4a");
      audio.volume = 0.85;
      audio.play().catch(() => {});
    } catch {
      // SSR guard
    }
  };

  return { play };
}

export function useChimeSound() {
  const play = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [0, 0.28].forEach((offset, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "triangle";
        osc.frequency.value = i === 0 ? 880 : 660;
        gain.gain.setValueAtTime(0.2, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.7);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.75);
      });
      setTimeout(() => ctx.close(), 2500);
    } catch { /* noop */ }
  };
  return { play };
}
