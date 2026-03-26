"use client";
import { useEffect, useState } from "react";

interface Props {
  /** Increment this to trigger the animation */
  trigger: number;
}

// Floating mate toast — appears when you receive the mate, auto-dismisses after 3 s
export default function MateToast({ trigger }: Props) {
  const [visible, setVisible] = useState(false);
  const [key, setKey]         = useState(0);

  useEffect(() => {
    if (!trigger) return;
    setKey((k) => k + 1);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!visible) return null;

  return (
    <div
      key={key}
      aria-hidden="true"
      style={{
        position:      "fixed",
        bottom:        140,
        left:          "50%",
        zIndex:        999,
        pointerEvents: "none",
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           10,
        animation:     "mateToastIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards, mateToastOut 0.4s ease 2.8s forwards",
      }}
    >
      <span
        style={{
          fontSize: 72,
          filter:   "drop-shadow(0 0 24px rgba(132,204,22,0.9))",
          display:  "block",
        }}
      >
        🧉
      </span>
      <span
        style={{
          fontSize:     15,
          fontWeight:   800,
          color:        "#84cc16",
          textShadow:   "0 0 14px rgba(132,204,22,0.7)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        ¡Te llegó el mate!
      </span>
    </div>
  );
}
