"use client";
import { useSocket } from "@/hooks/useSocket";
import Lobby from "@/components/Lobby";
import StudyRoom from "@/components/StudyRoom";
import SessionSummary from "@/components/SessionSummary";

export default function Home() {
  const {
    room, roomId, myId, error, messages, summary,
    createRoom, joinRoom, leaveRoom, endRoom,
    passMate, timerToggle, timerReset,
    updateActivity, sendMessage, updateTimerConfig,
    dismissSummary,
  } = useSocket();

  if (summary) {
    return <SessionSummary summary={summary} onDismiss={dismissSummary} />;
  }

  if (!room || !roomId) {
    return <Lobby onCreate={createRoom} onJoin={joinRoom} error={error} />;
  }

  return (
    <StudyRoom
      room={room}
      roomId={roomId}
      myId={myId}
      messages={messages}
      onPassMate={passMate}
      onTimerToggle={timerToggle}
      onTimerReset={timerReset}
      onUpdateActivity={updateActivity}
      onSendMessage={sendMessage}
      onUpdateTimerConfig={updateTimerConfig}
      onLeave={leaveRoom}
      onEnd={endRoom}
    />
  );
}
