"use client";
import { useMemo } from "react";

const PARTICLES = [
  { emoji: "🧉", size: 22 },
  { emoji: "🌿", size: 18 },
  { emoji: "🍃", size: 16 },
  { emoji: "🧉", size: 14 },
  { emoji: "✨", size: 14 },
  { emoji: "🌿", size: 20 },
  { emoji: "🧉", size: 18 },
  { emoji: "🍃", size: 22 },
  { emoji: "✨", size: 12 },
  { emoji: "🌿", size: 16 },
  { emoji: "🧉", size: 20 },
  { emoji: "🍃", size: 18 },
  { emoji: "🌿", size: 14 },
  { emoji: "✨", size: 16 },
  { emoji: "🧉", size: 16 },
];

// Seeded pseudo-random so values are stable between renders
function seededRand(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export default function MateRain() {
  const particles = useMemo(() =>
    PARTICLES.map((p, i) => ({
      ...p,
      left:     `${seededRand(i * 3 + 0) * 100}%`,
      duration: `${5 + seededRand(i * 3 + 1) * 7}s`,
      delay:    `${-seededRand(i * 3 + 2) * 10}s`,  // negative = already mid-fall on mount
      swayDur:  `${3 + seededRand(i * 3 + 0) * 3}s`,
    })),
  []);

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none z-0"
      aria-hidden="true"
    >
      {particles.map((p, i) => (
        <span
          key={i}
          className="mate-particle"
          style={{
            left: p.left,
            fontSize: p.size,
            animationDuration: `${p.duration}, ${p.swayDur}`,
            animationDelay: `${p.delay}, ${p.delay}`,
            opacity: 0,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
