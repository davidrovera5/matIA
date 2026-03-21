"use client";
import { useState, useRef } from "react";
import { User } from "@/types";

interface Props {
  user: User;
  hasMate: boolean;
  isCurrentUser: boolean;
  angle: number;
  radius: number;
  radiusY?: number;   // if set, creates elliptical positioning (rx=radius, ry=radiusY)
  onActivityChange?: (activity: string) => void;
}

// Map Tailwind bg classes → actual hex for inline border/glow (Tailwind can't do this dynamically)
const COLOR_MAP: Record<string, string> = {
  "bg-green-500":  "#22c55e",
  "bg-blue-500":   "#3b82f6",
  "bg-purple-500": "#a855f7",
  "bg-orange-500": "#f97316",
  "bg-pink-500":   "#ec4899",
  "bg-teal-500":   "#14b8a6",
};

export default function UserAvatar({ user, hasMate, isCurrentUser, angle, radius, radiusY, onActivityChange }: Props) {
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * (radiusY ?? radius);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(user.activity);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!editing && draft !== user.activity) setDraft(user.activity);

  const commit = () => {
    setEditing(false);
    if (draft !== user.activity) onActivityChange?.(draft);
  };

  const userColor = COLOR_MAP[user.color] ?? "#84cc16";

  return (
    <div
      className="absolute flex flex-col items-center gap-1 transition-all duration-500"
      style={{
        // Start from the geometric center of the container (top:50% left:50%),
        // move to the ellipse point, then pull back exactly half the avatar circle
        // (32px = w-16/2) so the circle sits centered on the ellipse line.
        top: "50%",
        left: "50%",
        zIndex: 10,
        transform: `translate(${x}px, ${y}px) translate(-32px, -32px)`,
      }}
    >
      {/* Avatar circle */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all duration-300"
        style={{
          background: userColor,
          border: hasMate ? "3px solid #84cc16" : "3px solid rgba(255,255,255,0.08)",
          boxShadow: hasMate
            ? "0 0 0 3px rgba(132,204,22,0.18), 0 0 18px rgba(132,204,22,0.45)"
            : isCurrentUser
            ? "0 0 0 2px rgba(240,235,229,0.2)"
            : "none",
          transform: hasMate ? "scale(1.08)" : "scale(1)",
        }}
      >
        {user.avatar}
      </div>

      {/* Name */}
      <span
        className="text-xs font-semibold whitespace-nowrap"
        style={{ color: hasMate ? "#84cc16" : "#c4b09a" }}
      >
        {user.name}{hasMate && " 🧉"}
      </span>

      {/* Activity */}
      <div className="w-28 flex justify-center">
        {isCurrentUser && editing ? (
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(user.activity); setEditing(false); }
            }}
            className="w-full text-center text-xs rounded-full px-2 py-0.5 outline-none border border-yerba-600/50 focus:border-yerba-500"
            style={{ background: "rgba(38,21,9,0.85)", color: "#f0ebe5" }}
            placeholder="¿Qué estudiás?"
          />
        ) : (
          <button
            onClick={() => isCurrentUser && setEditing(true)}
            className={`text-xs rounded-full px-2 py-0.5 max-w-full truncate transition-all ${
              isCurrentUser
                ? "hover:text-yerba-400 cursor-text"
                : "cursor-default"
            }`}
            style={{ color: isCurrentUser ? "#7a6050" : "#4a3020" }}
            title={isCurrentUser ? "Clic para editar" : user.activity}
          >
            {user.activity || (isCurrentUser
              ? <span style={{ color: "#3d2414", fontStyle: "italic" }}>+ actividad</span>
              : null)}
          </button>
        )}
      </div>
    </div>
  );
}
