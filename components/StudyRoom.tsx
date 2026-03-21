"use client";
import { useState, useEffect, useRef } from "react";
import { RoomState, ChatMessage } from "@/types";
import PomodoroTimer from "./PomodoroTimer";
import UserAvatar from "./UserAvatar";
import ChatSidebar from "./ChatSidebar";
import Logo from "./Logo";
import MateRain from "./MateRain";
import { useMateSound } from "@/hooks/useSound";
import { useNotifications } from "@/hooks/useNotifications";

interface Props {
  room: RoomState;
  roomId: string;
  myId: string;
  messages: ChatMessage[];
  onPassMate: () => void;
  onTimerToggle: () => void;
  onTimerReset: () => void;
  onUpdateActivity: (activity: string) => void;
  onSendMessage: (text: string) => void;
  onUpdateTimerConfig: (w: number, b: number) => void;
  onLeave: () => void;
  onEnd: () => void;
}

// Responsive ellipse dimensions derived from the container element
function useEllipseAxes(ref: React.RefObject<HTMLDivElement | null>) {
  const [axes, setAxes] = useState({ rx: 340, ry: 155 });

  useEffect(() => {
    const update = () => {
      if (!ref.current) return;
      const { width, height } = ref.current.getBoundingClientRect();
      // Leave ~90px margin each side for avatar labels + glow
      setAxes({
        rx: Math.min(width  / 2 - 90, 460),
        ry: Math.min(height / 2 - 90, 180),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);

  return axes;
}

export default function StudyRoom({
  room, roomId, myId, messages,
  onPassMate, onTimerToggle, onTimerReset,
  onUpdateActivity, onSendMessage, onUpdateTimerConfig,
  onLeave, onEnd,
}: Props) {
  const { users, currentMateIndex, hostId, timer, timerConfig } = room;
  const [chatOpen, setChatOpen]     = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(0);

  const ellipseRef = useRef<HTMLDivElement>(null);
  const { rx, ry } = useEllipseAxes(ellipseRef);

  const n             = Math.max(users.length, 1);
  const angleStep     = 360 / n;
  // Start at 90° (6 o'clock) so the first user lands at the bottom,
  // then the rest distribute clockwise — sides fill first, top comes last.
  const START_ANGLE   = 90;

  const currentHolder = users[currentMateIndex];
  const iHolder       = currentHolder?.id === myId;
  const isHost        = hostId === myId;
  const unread        = chatOpen ? 0 : messages.length - lastSeenCount;

  const { play: playMate } = useMateSound();
  const { notify }         = useNotifications();

  const prevHolderIdRef = useRef<string | undefined>(currentHolder?.id);
  useEffect(() => {
    const prev = prevHolderIdRef.current;
    const curr = currentHolder?.id;
    if (curr !== prev) {
      prevHolderIdRef.current = curr;
      if (curr === myId) {
        playMate();
        notify("¡Es tu turno! 🧉", "¡Disfruta de tu mate!");
      }
    }
  }, [currentMateIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const openChat  = () => { setChatOpen(true);  setLastSeenCount(messages.length); };
  const closeChat = () => { setChatOpen(false); setLastSeenCount(messages.length); };

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{ background: "radial-gradient(ellipse at 50% 40%, #2c1a0e 0%, #1a120b 65%)" }}
    >
      {iHolder && <MateRain />}

      {/* ── Main column ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* BAND 1 — Header */}
        <header className="shrink-0 flex items-center justify-between px-6 py-3 z-20">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span
              className="font-mono text-xs px-3 py-1 rounded-full tracking-widest"
              style={{ background: "rgba(38,21,9,0.7)", border: "1px solid rgba(132,204,22,0.15)", color: "#7a6050" }}
            >
              {roomId}
            </span>
          </div>

          {/* Action buttons live in the header — no more absolute overlap */}
          <div className="flex items-center gap-2">
            <button onClick={chatOpen ? closeChat : openChat} className="btn-ghost flex items-center gap-2">
              💬 Chat
              {unread > 0 && (
                <span className="bg-yerba-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>

            {isHost ? (
              confirmEnd ? (
                <div className="flex items-center gap-2 rounded-full px-3 py-1.5"
                     style={{ background: "rgba(38,21,9,0.8)", border: "1px solid rgba(239,68,68,0.4)" }}>
                  <span className="text-xs" style={{ color: "#c4b09a" }}>¿Finalizar para todos?</span>
                  <button onClick={onEnd}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-full transition-all">
                    Sí
                  </button>
                  <button onClick={() => setConfirmEnd(false)}
                    className="px-3 py-1 text-xs rounded-full border border-white/10 transition-all"
                    style={{ color: "#7a6050" }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmEnd(true)}
                  className="btn-ghost hover:!border-red-700/50 hover:!text-red-400">
                  🔴 Finalizar
                </button>
              )
            ) : (
              <button onClick={onLeave} className="btn-ghost">🚪 Salir</button>
            )}
          </div>
        </header>

        {/* BAND 2 — Ellipse arena (flex-1, measured) */}
        <main
          ref={ellipseRef}
          className="flex-1 relative flex items-center justify-center min-h-0"
        >
          {/* Ellipse orbit ring — centered via top/left 50% + translate(-50%,-50%) */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: "50%", left: "50%",
              width:  rx * 2,
              height: ry * 2,
              borderRadius: "50%",
              border: "1px dashed rgba(132,204,22,0.22)",
              transform: "translate(-50%, -50%)",
              zIndex: 1,
            }}
          />

          {/* Pomodoro center — same centering pattern */}
          <div
            className="absolute flex items-center justify-center rounded-full glass"
            style={{
              top: "50%", left: "50%",
              width: 256, height: 256,
              transform: "translate(-50%, -50%)",
              zIndex: 20,
              boxShadow: "0 0 48px rgba(132,204,22,0.07), inset 0 0 30px rgba(132,204,22,0.04)",
            }}
          >
            <PomodoroTimer
              timer={timer}
              timerConfig={timerConfig}
              isHost={isHost}
              onToggle={onTimerToggle}
              onReset={onTimerReset}
              onConfigChange={onUpdateTimerConfig}
            />
          </div>

          {/* Avatars on the ellipse */}
          {users.map((user, i) => (
            <UserAvatar
              key={user.id}
              user={user}
              hasMate={i === currentMateIndex}
              isCurrentUser={user.id === myId}
              angle={START_ANGLE + angleStep * i}
              radius={rx}
              radiusY={ry}
              onActivityChange={onUpdateActivity}
            />
          ))}
        </main>

        {/* BAND 3 — Footer controls */}
        <footer className="shrink-0 flex flex-col items-center gap-2 pb-5 pt-2">
          <p className="text-sm" style={{ color: "#7a6050" }}>
            Ahora ceba:{" "}
            <span className="font-bold text-yerba-500">{currentHolder?.name ?? "..."}</span>
            {isHost && !iHolder && (
              <span className="ml-2 text-xs" style={{ color: "#4a3020" }}>(vos sos el host)</span>
            )}
          </p>
          <button
            onClick={onPassMate}
            disabled={!iHolder}
            className="px-8 py-3 font-black rounded-full text-lg transition-all text-white
                       disabled:opacity-25 disabled:cursor-not-allowed
                       hover:scale-105 active:scale-95"
            style={{
              background:  iHolder ? "linear-gradient(135deg, #4d7c0f, #84cc16)" : "#3b2012",
              boxShadow:   iHolder ? "0 0 22px rgba(132,204,22,0.4)"            : "none",
            }}
          >
            Pasar el mate 🧉➡️
          </button>
          {!iHolder && (
            <p className="text-xs" style={{ color: "#3d2414" }}>
              Solo quien tiene el mate puede pasarlo
            </p>
          )}
        </footer>
      </div>

      {/* Chat sidebar */}
      {chatOpen && (
        <ChatSidebar messages={messages} myId={myId} onSend={onSendMessage} onClose={closeChat} />
      )}
    </div>
  );
}
