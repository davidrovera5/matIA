"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  /** Increment to launch a new bounce */
  trigger: number;
}

const SIZE     = 80;  // emoji px footprint
const DURATION = 4500; // ms

export default function MateBounce({ trigger }: Props) {
  const [active, setActive] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trigger) return;
    setActive(true);
  }, [trigger]);

  useEffect(() => {
    if (!active || !divRef.current) return;

    const el = divRef.current;

    let x  = window.innerWidth  / 2 - SIZE / 2;
    let y  = window.innerHeight / 2 - SIZE / 2;
    let vx = (Math.random() > 0.5 ? 1 : -1) * (4.5 + Math.random() * 3);
    let vy = (Math.random() > 0.5 ? 1 : -1) * (3.5 + Math.random() * 3);

    const start = performance.now();
    let raf: number;

    const step = (now: number) => {
      const elapsed = now - start;
      // Fade out in the last 600 ms
      const opacity = elapsed > DURATION - 600
        ? Math.max(0, (DURATION - elapsed) / 600)
        : 1;

      x += vx;
      y += vy;

      if (x <= 0)                          { x = 0;                          vx = Math.abs(vx); }
      if (x >= window.innerWidth  - SIZE)  { x = window.innerWidth  - SIZE;  vx = -Math.abs(vx); }
      if (y <= 0)                          { y = 0;                          vy = Math.abs(vy); }
      if (y >= window.innerHeight - SIZE)  { y = window.innerHeight - SIZE;  vy = -Math.abs(vy); }

      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.opacity   = String(opacity);

      if (elapsed < DURATION) {
        raf = requestAnimationFrame(step);
      } else {
        setActive(false);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={divRef}
      aria-hidden="true"
      style={{
        position:      "fixed",
        top:           0,
        left:          0,
        zIndex:        9999,
        pointerEvents: "none",
        fontSize:      SIZE,
        lineHeight:    1,
        userSelect:    "none",
        filter:        "drop-shadow(0 0 18px rgba(132,204,22,0.85))",
        willChange:    "transform, opacity",
      }}
    >
      🧉
    </div>
  );
}
