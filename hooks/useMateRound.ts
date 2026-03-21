import { useState } from "react";
import { User, RoomState } from "@/types";

const INITIAL_USERS: User[] = [
  { id: "1", name: "Vos", avatar: "🧉", color: "bg-green-500" },
  { id: "2", name: "Santi", avatar: "🎸", color: "bg-blue-500" },
  { id: "3", name: "Lu", avatar: "📚", color: "bg-purple-500" },
  { id: "4", name: "Nico", avatar: "💻", color: "bg-orange-500" },
];

export function useMateRound() {
  const [state, setState] = useState<RoomState>({
    users: INITIAL_USERS,
    currentMateIndex: 0,
    hostId: "1",
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
