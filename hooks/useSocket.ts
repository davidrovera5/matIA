"use client";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { RoomState, ChatMessage, SessionSummary } from "@/types";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [myId, setMyId] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  useEffect(() => {
    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;
    socket.on("connect", () => setMyId(socket.id ?? ""));
    socket.on("room-updated", (r: RoomState) => setRoom(r));
    socket.on("timer-tick", (timer) =>
      setRoom((prev) => prev ? { ...prev, timer } : prev)
    );
    socket.on("new-message", (msg: ChatMessage) =>
      setMessages((prev) => [...prev, msg])
    );
    socket.on("room-ended", (s: SessionSummary) => {
      setSummary(s);
      setRoom(null);
      setRoomId(null);
      setMessages([]);
    });
    return () => { socket.disconnect(); };
  }, []);

  const createRoom = (userName: string) => {
    setMessages([]);
    socketRef.current?.emit("create-room", { userName }, ({ roomId, room }: any) => {
      setRoomId(roomId);
      setRoom(room);
    });
  };

  const joinRoom = (id: string, userName: string) => {
    socketRef.current?.emit("join-room", { roomId: id, userName }, ({ room, error, messages }: any) => {
      if (error) { setError(error); return; }
      setRoomId(id);
      setRoom(room);
      if (messages) setMessages(messages);
    });
  };

  const leaveRoom = () => {
    socketRef.current?.emit("leave-room");
    setRoom((prev) => {
      if (prev) {
        const elapsed = Math.floor((Date.now() - prev.metrics.sessionStart) / 1000);
        setSummary({ totalSeconds: elapsed, studySeconds: prev.metrics.studySeconds, breakSeconds: prev.metrics.breakSeconds });
      }
      return null;
    });
    setRoomId(null);
    setMessages([]);
  };

  const endRoom = () => socketRef.current?.emit("end-room");

  const passMate = () => socketRef.current?.emit("pass-mate");
  const timerToggle = () => socketRef.current?.emit("timer-toggle");
  const timerReset = () => socketRef.current?.emit("timer-reset");
  const updateActivity = (activity: string) => socketRef.current?.emit("update-activity", { activity });
  const sendMessage = (text: string) => socketRef.current?.emit("send-message", { text });
  const updateTimerConfig = (workMinutes: number, breakMinutes: number) =>
    socketRef.current?.emit("update-timer-config", { workMinutes, breakMinutes });

  const dismissSummary = () => setSummary(null);

  return {
    room, roomId, myId, error, messages, summary,
    createRoom, joinRoom, leaveRoom, endRoom,
    passMate, timerToggle, timerReset,
    updateActivity, sendMessage, updateTimerConfig,
    dismissSummary,
  };
}
