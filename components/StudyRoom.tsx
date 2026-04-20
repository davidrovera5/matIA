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
  isDeafened: boolean;
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
  onToggleDeafen: () => void;
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
  volumes: Map<string, number>;
  onVolumeChange: (userId: string, v: number) => void;
};

function SeatRow({ seats, currentMateIndex, myId, localStream, remoteStreams, onActivityChange, volumes, onVolumeChange }: SeatProps) {
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
          volume={volumes.get(user.id) ?? 1}
          onVolumeChange={(v) => onVolumeChange(user.id, v)}
        />
      ))}
    </div>
  );
}

function SeatCol({ seats, currentMateIndex, myId, localStream, remoteStreams, onActivityChange, volumes, onVolumeChange }: SeatProps) {
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
          volume={volumes.get(user.id) ?? 1}
          onVolumeChange={(v) => onVolumeChange(user.id, v)}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const MATE_REMINDER_MS = 5 * 60 * 1000;

export default function StudyRoom({
  room, roomId, myId, messages,
  isAudioActive, isDeafened, localStream, remoteStreams,
  onPassMate, onTimerToggle, onTimerReset,
  onUpdateActivity, onSendMessage, onUpdateTimerConfig,
  onEnableAudio, onDisableAudio, onToggleDeafen,
  onLeave, onEnd,
}: Props) {
  const { users, currentMateIndex, hostId, timer, timerConfig } = room;
  const [chatOpen,      setChatOpen]      = useState(false);
  const [confirmEnd,    setConfirmEnd]    = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const [bounceTrigger, setBounceTrigger] = useState(0);
  const [volumes,       setVolumes]       = useState<Map<string, number>>(new Map());

  const handleVolumeChange = (userId: string, v: number) => {
    setVolumes((prev) => {
      const next = new Map(prev);
      next.set(userId, v);
      return next;
    });
  };

  // Limpia entradas de usuarios que ya no est\u00e1n en la sala
  useEffect(() => {
    setVolumes((prev) => {
      const ids = new Set(users.map((u) => u.id));
      let changed = false;
      const next = new Map(prev);
      for (const k of next.keys()) if (!ids.has(k)) { next.delete(k); changed = true; }
      return changed ? next : prev;
    });
  }, [users]);

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
  const seatProps = {
    currentMateIndex, myId, localStream, remoteStreams,
    onActivityChange: onUpdateActivity,
    volumes, onVolumeChange: handleVolumeChange,
  };

  return (
    <div
      className="flex h-dscreen overflow-hidden relative px-safe"
      style={{ background: "radial-gradient(ellipse at 50% 40%, #2c1a0e 0%, #1a120b 65%)" }}
    >
      {iHolder && <MateRain />}
      <MateBounce trigger={bounceTrigger} />
      <RemoteAudio remoteStreams={remoteStreams} deafened={isDeafened} volumes={volumes} />

      {/* ── Document PiP portal ── renders into the floating window ───────── */}
      <PipPortal pipWindow={pipWindow}>
        <PipMiniView
          timer={timer}
          currentHolderName={currentHolder?.name ?? "..."}
          iHolder={iHolder}
          isAudioActive={isAudioActive}
          isDeafened={isDeafened}
          onPassMate={onPassMate}
          onToggleMic={toggleMic}
          onToggleDeafen={onToggleDeafen}
        />
      </PipPortal>

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── HEADER ── */}
        <header className="relative shrink-0 flex items-center px-3 sm:px-6 py-2 sm:py-3 z-20 pt-safe gap-2">
          <div className="flex items-center gap-2 sm:absolute sm:inset-x-0 sm:flex-col sm:justify-center sm:gap-0.5 sm:pointer-events-none">
            <div className="flex items-center gap-2 sm:gap-3">
              <Logo size="sm" />
              <span
                className="font-mono text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1 rounded-full tracking-widest pointer-events-auto"
                style={{ background: "rgba(38,21,9,0.7)", border: "1px solid rgba(132,204,22,0.15)", color: "#7a6050" }}
              >
                {roomId}
              </span>
            </div>
            <span className="hidden sm:inline text-[9px] tracking-[0.18em] uppercase" style={{ color: "#3d2414" }}>
              Un mate a la vez
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {isPipSupported() && (
              <button
                onClick={togglePip}
                className="btn-ghost !px-2.5 sm:!px-4"
                title={pipOpen ? "Cerrar modo mini" : "Abrir ventana flotante"}
              >
                <span className="sm:hidden">{pipOpen ? "⊠" : "⊡"}</span>
                <span className="hidden sm:inline">{pipOpen ? "⊠ Mini" : "⊡ Mini"}</span>
              </button>
            )}

            <button onClick={chatOpen ? closeChat : openChat} className="btn-ghost flex items-center gap-1.5 sm:gap-2 !px-2.5 sm:!px-4">
              💬<span className="hidden sm:inline"> Chat</span>
              {unread > 0 && (
                <span className="bg-yerba-600 text-white text-[10px] sm:text-xs font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>

            {isHost ? (
              confirmEnd ? (
                <div
                  className="flex items-center gap-1.5 sm:gap-2 rounded-full px-2 sm:px-3 py-1 sm:py-1.5"
                  style={{ background: "rgba(38,21,9,0.8)", border: "1px solid rgba(239,68,68,0.4)" }}
                >
                  <span className="hidden sm:inline text-xs" style={{ color: "#c4b09a" }}>¿Finalizar para todos?</span>
                  <button onClick={onEnd}
                    className="px-2 sm:px-3 py-0.5 sm:py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-full transition-all">
                    Sí
                  </button>
                  <button onClick={() => setConfirmEnd(false)}
                    className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs rounded-full border border-white/10 transition-all"
                    style={{ color: "#7a6050" }}>
                    ✕
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmEnd(true)}
                  className="btn-ghost hover:!border-red-700/50 hover:!text-red-400 !px-2.5 sm:!px-4">
                  🔴<span className="hidden sm:inline"> Finalizar</span>
                </button>
              )
            ) : (
              <button onClick={onLeave} className="btn-ghost !px-2.5 sm:!px-4">
                🚪<span className="hidden sm:inline"> Salir</span>
              </button>
            )}
          </div>
        </header>

        {/* ── TABLE AREA (desktop) ── */}
        <main className="hidden md:block relative flex-1 min-h-0 overflow-hidden">
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

        {/* ── TABLE AREA (mobile: stacked) ── */}
        <main className="md:hidden flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-4 px-3 pt-2 pb-4">
          <div
            className="w-full max-w-xs flex items-center justify-center shrink-0"
            style={{
              padding: "14px 10px",
              borderRadius: 28,
              background: "radial-gradient(ellipse at center, rgba(44,26,14,0.95) 50%, rgba(26,18,11,0.8) 100%)",
              border: "1px solid rgba(132,204,22,0.14)",
              boxShadow: "0 0 40px rgba(132,204,22,0.06), inset 0 0 24px rgba(132,204,22,0.04)",
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

          <div
            className="grid gap-3 justify-items-center w-full"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(72px, 1fr))" }}
          >
            {users.map((user, idx) => (
              <UserAvatar
                key={user.id}
                user={user}
                hasMate={idx === currentMateIndex}
                isCurrentUser={user.id === myId}
                stream={user.id === myId ? localStream : (remoteStreams.get(user.id) ?? null)}
                onActivityChange={onUpdateActivity}
                volume={volumes.get(user.id) ?? 1}
                onVolumeChange={(v) => handleVolumeChange(user.id, v)}
              />
            ))}
          </div>
        </main>

        {/* ── FOOTER ── */}
        <footer className="shrink-0 flex flex-col items-center gap-2 pb-3 sm:pb-5 pt-2 pb-safe px-3">
          <p className="text-xs sm:text-sm text-center" style={{ color: "#7a6050" }}>
            Ahora ceba:{" "}
            <span className="font-bold text-yerba-500">{currentHolder?.name ?? "..."}</span>
            {isHost && !iHolder && (
              <span className="ml-2 text-xs hidden sm:inline" style={{ color: "#4a3020" }}>(vos sos el host)</span>
            )}
          </p>

          <div className="flex items-center flex-wrap justify-center gap-2 sm:gap-3 w-full">
            <button
              onClick={onPassMate}
              disabled={!iHolder}
              className="px-5 sm:px-8 py-2.5 sm:py-3 font-black rounded-full text-sm sm:text-lg transition-all text-white
                         disabled:opacity-25 disabled:cursor-not-allowed
                         hover:scale-105 active:scale-95 order-1"
              style={{
                background: iHolder ? "linear-gradient(135deg, #4d7c0f, #84cc16)" : "#3b2012",
                boxShadow:  iHolder ? "0 0 22px rgba(132,204,22,0.4)" : "none",
              }}
            >
              Pasar el mate 🧉➡️
            </button>

            <button
              onClick={toggleMic}
              className="px-3 sm:px-5 py-2.5 sm:py-3 font-semibold rounded-full text-xs sm:text-sm transition-all hover:scale-105 active:scale-95 order-2"
              style={{
                background: isAudioActive ? "linear-gradient(135deg, #14532d, #16a34a)" : "rgba(38,21,9,0.8)",
                border:     isAudioActive ? "1px solid rgba(132,204,22,0.5)"            : "1px solid rgba(132,204,22,0.15)",
                color:      isAudioActive ? "#86efac"                                   : "#7a6050",
                boxShadow:  isAudioActive ? "0 0 14px rgba(132,204,22,0.3)"             : "none",
              }}
            >
              <span className="sm:hidden">🎙 {isAudioActive ? "On" : "Off"}</span>
              <span className="hidden sm:inline">{isAudioActive ? "🎙 Micrófono activo" : "🎙 Activar Micrófono"}</span>
            </button>

            <button
              onClick={onToggleDeafen}
              className="px-3 sm:px-5 py-2.5 sm:py-3 font-semibold rounded-full text-xs sm:text-sm transition-all hover:scale-105 active:scale-95 order-3"
              title={isDeafened ? "Volver a escuchar" : "Ensordecer (no escuchar a nadie)"}
              style={{
                background: isDeafened ? "linear-gradient(135deg, #7f1d1d, #dc2626)" : "rgba(38,21,9,0.8)",
                border:     isDeafened ? "1px solid rgba(239,68,68,0.5)"             : "1px solid rgba(132,204,22,0.15)",
                color:      isDeafened ? "#fecaca"                                   : "#7a6050",
                boxShadow:  isDeafened ? "0 0 14px rgba(239,68,68,0.3)"              : "none",
              }}
            >
              <span className="sm:hidden">{isDeafened ? "🔇" : "🔊"}</span>
              <span className="hidden sm:inline">{isDeafened ? "🔇 Ensordecido" : "🔊 Escuchando"}</span>
            </button>
          </div>

          {!iHolder && (
            <p className="text-[10px] sm:text-xs text-center" style={{ color: "#3d2414" }}>
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
