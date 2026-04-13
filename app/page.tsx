"use client";
import { useSocket } from "@/hooks/useSocket";
import { useAudioChat } from "@/hooks/useAudioChat";
import Lobby from "@/components/Lobby";
import StudyRoom from "@/components/StudyRoom";
import SessionSummary from "@/components/SessionSummary";

/** Discrete top banner for transient connection / permission errors. */
function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        position:   "fixed",
        top:        0,
        left:       0,
        right:      0,
        zIndex:     9998,
        padding:    "8px 16px",
        background: "rgba(26,8,8,0.92)",
        borderBottom: "1px solid rgba(239,68,68,0.3)",
        color:      "#fca5a5",
        fontSize:   12,
        textAlign:  "center",
        backdropFilter: "blur(8px)",
      }}
    >
      ⚠️ {message}
    </div>
  );
}

export default function Home() {
  const {
    socketRef,
    room, roomId, myId, error, connectionError, messages, summary,
    createRoom, joinRoom, leaveRoom, endRoom,
    passMate, timerToggle, timerReset,
    updateActivity, sendMessage, updateTimerConfig,
    dismissSummary,
  } = useSocket();

  const {
    isAudioActive, isDeafened, localStream, remoteStreams, audioError,
    enableAudio, disableAudio, toggleDeafen,
  } = useAudioChat(socketRef);

  const topError = connectionError ?? audioError;

  if (summary) {
    return (
      <>
        {topError && <ErrorBanner message={topError} />}
        <SessionSummary summary={summary} onDismiss={dismissSummary} />
      </>
    );
  }

  if (!room || !roomId) {
    return (
      <>
        {topError && <ErrorBanner message={topError} />}
        <Lobby
          onCreate={(name, avatar) => createRoom(name, avatar)}
          onJoin={(id, name, avatar) => joinRoom(id, name, avatar)}
          error={error}
        />
      </>
    );
  }

  return (
    <>
      {topError && <ErrorBanner message={topError} />}
      <StudyRoom
        room={room}
        roomId={roomId}
        myId={myId}
        messages={messages}
        isAudioActive={isAudioActive}
        isDeafened={isDeafened}
        localStream={localStream}
        remoteStreams={remoteStreams}
        onPassMate={passMate}
        onTimerToggle={timerToggle}
        onTimerReset={timerReset}
        onUpdateActivity={updateActivity}
        onSendMessage={sendMessage}
        onUpdateTimerConfig={updateTimerConfig}
        onEnableAudio={enableAudio}
        onDisableAudio={disableAudio}
        onToggleDeafen={toggleDeafen}
        onLeave={leaveRoom}
        onEnd={endRoom}
      />
    </>
  );
}
