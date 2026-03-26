"use client";
import { useState, useEffect, useRef } from "react";
import { RoomState, ChatMessage, User } from "@/types";
import PomodoroTimer from "./PomodoroTimer";
import UserAvatar from "./UserAvatar";
import ChatSidebar from "./ChatSidebar";
import Logo from "./Logo";
import MateRain from "./MateRain";
import MateBounce from "./MateBounce";
import RemoteAudio from "./RemoteAudio";
import PipPortal from "./PipPortal";
import PipMiniView from "./PipMiniView";
import { usePip, isPipSupported } from "@/hooks/usePip";
import { useMateSound } from "@/hooks/useSound";
import { useNotifications } from "@/hooks/useNotifications";

interface Props {
  room: RoomState;
  roomId: string;
  myId: string;
  messages: ChatMessage[];
  isAudioActive: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  onPassMate: () => void;
  onTimerToggle: () => void;
  onTimerReset: () => void;
  onUpdateActivity: (activity: string) => void;
  onSendMessage: (text: string) => void;
  onUpdateTimerConfig: (w: number, b: number) => void;
  onEnableAudio: () => Promise<void>;
  onDisableAudio: () => void;
  onLeave: () => void;
  onEnd: () => void;
}

type Seat = { user: User; idx: number };

function distributeUsers(users: User[]): { top: Seat[]; right: Seat[]; bottom: Seat[]; left: Seat[] } {
  const top: Seat[] = [], right: Seat[] = [], bottom: Seat[] = [], left: Seat[] = [];
  const sides = [bottom, right, top, left];
  users.forEach((user, i) => sides[i % 4].push({ user, idx: i }));
  return { top, right, bottom, left };
}

type SeatProps = {
  seats: Seat[];
  currentMateIndex: number;
  myId: string;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  onActivityChange: (a: string) => void;
};

function SeatRow({ seats, currentMateIndex, myId, localStream, remoteStreams, onActivityChange }: SeatProps) {
  if (!seats.length) return null;
  return (
    <div className="flex items-end justify-center gap-5 flex-wrap">
      {seats.map(({ user, idx }) => (
        <UserAvatar
          key={user.id}
          user={user}
          hasMate={idx === currentMateIndex}
          isCurrentUser={user.id === myId}
          stream={user.id === myId ? localStream : (remoteStreams.get(user.id) ?? null)}
          onActivityChange={onActivityChange}
        />
      ))}
    </div>
  );
}

function SeatCol({ seats, currentMateIndex, myId, localStream, remoteStreams, onActivityChange }: SeatProps) {
  if (!seats.length) return null;
  return (
    <div className="flex flex-col items-center justify-center gap-5">
      {seats.map(({ user, idx }) => (
        <UserAvatar
          key={user.id}
          user={user}
          hasMate={idx === currentMateIndex}
          isCurrentUser={user.id === myId}
          stream={user.id === myId ? localStream : (remoteStreams.get(user.id) ?? null)}
          onActivityChange={onActivityChange}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const MATE_REMINDER_MS = 5 * 60 * 1000;

export default function StudyRoom({
  room, roomId, myId, messages,
  isAudioActive, localStream, remoteStreams,
  onPassMate, onTimerToggle, onTimerReset,
  onUpdateActivity, onSendMessage, onUpdateTimerConfig,
  onEnableAudio, onDisableAudio,
  onLeave, onEnd,
}: Props) {
  const { users, currentMateIndex, hostId, timer, timerConfig } = room;
  const [chatOpen,      setChatOpen]      = useState(false);
  const [confirmEnd,    setConfirmEnd]    = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const [bounceTrigger, setBounceTrigger] = useState(0);

  const currentHolder = users[currentMateIndex];
  const iHolder       = currentHolder?.id === myId;
  const isHost        = hostId === myId;
  const unread        = chatOpen ? 0 : messages.length - lastSeenCount;

  const { play: playMate } = useMateSound();
  const { notify }         = useNotifications();
  const { isOpen: pipOpen, pipWindow, openPip, closePip } = usePip();

  // ── Mate received: sound + bounce + desktop notification ─────────────────
  const prevHolderIdRef = useRef<string | undefined>(currentHolder?.id);
  useEffect(() => {
    const prev = prevHolderIdRef.current;
    const curr = currentHolder?.id;
    if (curr !== prev) {
      prevHolderIdRef.current = curr;
      if (curr === myId) {
        playMate();
        setBounceTrigger((n) => n + 1);
        notify("¡Te llegó el mate! 🧉", `${users[currentMateIndex - 1]?.name ?? "Alguien"} te cedió el mate`);
      }
    }
  }, [currentMateIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 5-minute reminder ────────────────────────────────────────────────────
  useEffect(() => {
    if (!iHolder) return;
    const t = setTimeout(() => {
      notify("¡No te olvides de cebar el mate crack! 🧉", "Ya van 5 minutos con el mate");
    }, MATE_REMINDER_MS);
    return () => clearTimeout(t);
  }, [iHolder]); // eslint-disable-line react-hooks/exhaustive-deps

  const openChat  = () => { setChatOpen(true);  setLastSeenCount(messages.length); };
  const closeChat = () => { setChatOpen(false); setLastSeenCount(messages.length); };
  const toggleMic = () => isAudioActive ? onDisableAudio() : onEnableAudio();
  const togglePip = () => pipOpen ? closePip() : openPip({ width: 300, height: 220 });

  const { top, right, bottom, left } = distributeUsers(users);
  const seatProps = { currentMateIndex, myId, localStream, remoteStreams, onActivityChange: onUpdateActivity };

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{ background: "radial-gradient(ellipse at 50% 40%, #2c1a0e 0%, #1a120b 65%)" }}
    >
      {iHolder && <MateRain />}
      <MateBounce trigger={bounceTrigger} />
      <RemoteAudio remoteStreams={remoteStreams} />

      {/* ── Document PiP portal ── renders into the floating window ───────── */}
      <PipPortal pipWindow={pipWindow}>
        <PipMiniView
          timer={timer}
          currentHolderName={currentHolder?.name ?? "..."}
          iHolder={iHolder}
          isAudioActive={isAudioActive}
          onPassMate={onPassMate}
          onToggleMic={toggleMic}
        />
      </PipPortal>

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── HEADER ── */}
        <header className="relative shrink-0 flex items-center px-6 py-3 z-20">
          <div className="absolute inset-x-0 flex flex-col justify-center items-center gap-0.5 pointer-events-none">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              <span
                className="font-mono text-xs px-3 py-1 rounded-full tracking-widest pointer-events-auto"
                style={{ background: "rgba(38,21,9,0.7)", border: "1px solid rgba(132,204,22,0.15)", color: "#7a6050" }}
              >
                {roomId}
              </span>
            </div>
            <span className="text-[9px] tracking-[0.18em] uppercase" style={{ color: "#3d2414" }}>
              Un mate a la vez
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {isPipSupported() && (
              <button
                onClick={togglePip}
                className="btn-ghost"
                title={pipOpen ? "Cerrar modo mini" : "Abrir ventana flotante"}
              >
                {pipOpen ? "⊠ Mini" : "⊡ Mini"}
              </button>
            )}

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
                <div
                  className="flex items-center gap-2 rounded-full px-3 py-1.5"
                  style={{ background: "rgba(38,21,9,0.8)", border: "1px solid rgba(239,68,68,0.4)" }}
                >
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

        {/* ── TABLE AREA ── */}
        <main className="relative flex-1 min-h-0 overflow-hidden">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ zIndex: 10 }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 280, height: 175, borderRadius: 36,
                background: "radial-gradient(ellipse at center, rgba(44,26,14,0.95) 50%, rgba(26,18,11,0.8) 100%)",
                border: "1px solid rgba(132,204,22,0.14)",
                boxShadow: "0 0 70px rgba(132,204,22,0.06), inset 0 0 40px rgba(132,204,22,0.04)",
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
          </div>

          <div
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: "1fr 300px 1fr", gridTemplateRows: "1fr 170px 1fr", padding: "16px" }}
          >
            <div className="col-span-3 flex items-end justify-center gap-5 pb-3" style={{ gridColumn: "1 / 4", gridRow: 1 }}>
              <SeatRow seats={top} {...seatProps} />
            </div>
            <div className="flex items-center justify-end pr-5" style={{ gridColumn: 1, gridRow: 2 }}>
              <SeatCol seats={left} {...seatProps} />
            </div>
            <div style={{ gridColumn: 2, gridRow: 2 }} />
            <div className="flex items-center justify-start pl-5" style={{ gridColumn: 3, gridRow: 2 }}>
              <SeatCol seats={right} {...seatProps} />
            </div>
            <div className="col-span-3 flex items-start justify-center gap-5 pt-3" style={{ gridColumn: "1 / 4", gridRow: 3 }}>
              <SeatRow seats={bottom} {...seatProps} />
            </div>
          </div>
        </main>

        {/* ── FOOTER ── */}
        <footer className="shrink-0 flex flex-col items-center gap-2 pb-5 pt-2">
          <p className="text-sm" style={{ color: "#7a6050" }}>
            Ahora ceba:{" "}
            <span className="font-bold text-yerba-500">{currentHolder?.name ?? "..."}</span>
            {isHost && !iHolder && (
              <span className="ml-2 text-xs" style={{ color: "#4a3020" }}>(vos sos el host)</span>
            )}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={onPassMate}
              disabled={!iHolder}
              className="px-8 py-3 font-black rounded-full text-lg transition-all text-white
                         disabled:opacity-25 disabled:cursor-not-allowed
                         hover:scale-105 active:scale-95"
              style={{
                background: iHolder ? "linear-gradient(135deg, #4d7c0f, #84cc16)" : "#3b2012",
                boxShadow:  iHolder ? "0 0 22px rgba(132,204,22,0.4)" : "none",
              }}
            >
              Pasar el mate 🧉➡️
            </button>

            <button
              onClick={toggleMic}
              className="px-5 py-3 font-semibold rounded-full text-sm transition-all hover:scale-105 active:scale-95"
              style={{
                background: isAudioActive ? "linear-gradient(135deg, #14532d, #16a34a)" : "rgba(38,21,9,0.8)",
                border:     isAudioActive ? "1px solid rgba(132,204,22,0.5)"            : "1px solid rgba(132,204,22,0.15)",
                color:      isAudioActive ? "#86efac"                                   : "#7a6050",
                boxShadow:  isAudioActive ? "0 0 14px rgba(132,204,22,0.3)"             : "none",
              }}
            >
              {isAudioActive ? "🎙 Micrófono activo" : "🎙 Activar Micrófono"}
            </button>
          </div>

          {!iHolder && (
            <p className="text-xs" style={{ color: "#3d2414" }}>
              Solo quien tiene el mate puede pasarlo
            </p>
          )}
        </footer>
      </div>

      {chatOpen && (
        <ChatSidebar messages={messages} myId={myId} onSend={onSendMessage} onClose={closeChat} />
      )}
    </div>
  );
}
