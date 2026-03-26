import { useState } from "react";
import { User, RoomState } from "@/types";

const INITIAL_USERS: User[] = [
  { id: "1", name: "Vos",   avatar: "🧉", color: "bg-green-500", activity: "" },
  { id: "2", name: "Santi", avatar: "🎸", color: "bg-blue-500",  activity: "" },
  { id: "3", name: "Lu",    avatar: "📚", color: "bg-purple-500", activity: "" },
  { id: "4", name: "Nico",  avatar: "💻", color: "bg-orange-500", activity: "" },
];

export function useMateRound() {
  const [state, setState] = useState<RoomState>({
    users: INITIAL_USERS,
    currentMateIndex: 0,
    hostId: "1",
    timer:      { phase: "work", secondsLeft: 25 * 60, isRunning: false },
    timerConfig: { workMinutes: 25, breakMinutes: 5 },
    metrics:    { sessionStart: Date.now(), studySeconds: 0, breakSeconds: 0 },
  });

  const passMate = () => {
    setState((prev) => ({
      ...prev,
      currentMateIndex: (prev.currentMateIndex + 1) % prev.users.length,
    }));
  };

  const currentHolder = state.users[state.currentMateIndex];

  return { state, passMate, currentHolder };
}
