"use client";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { RoomState, ChatMessage, SessionSummary } from "@/types";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [myId, setMyId] = useState<string>("");
  const [error,           setError]           = useState<string>("");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? window.location.origin, {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      // ngrok free-tier shows an interstitial on first hit; this header
      // tells it to skip the warning page for programmatic polling requests.
      extraHeaders: { "ngrok-skip-browser-warning": "true" },
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      if (process.env.NODE_ENV !== "production")
        console.log("✅ Socket conectado con ID:", socket.id);
      setMyId(socket.id ?? "");
      setConnectionError(null);
    });
    socket.on("connect_error", (err) => {
      if (process.env.NODE_ENV !== "production")
        console.warn("[Socket] error de conexión:", err.message);
      setConnectionError("No se puede conectar al servidor. Reintentando…");
    });
    socket.on("disconnect", (reason) => {
      if (process.env.NODE_ENV !== "production")
        console.warn("[Socket] desconectado:", reason);
      if (reason !== "io client disconnect")
        setConnectionError("Conexión perdida. Reconectando…");
    });
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

  const createRoom = (userName: string, avatar: string) => {
    setMessages([]);
    socketRef.current?.emit("create-room", { userName, avatar }, ({ roomId, room }: any) => {
      setRoomId(roomId);
      setRoom(room);
    });
  };

  const joinRoom = (id: string, userName: string, avatar: string) => {
    socketRef.current?.emit("join-room", { roomId: id, userName, avatar }, ({ room, error, messages }: any) => {
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
    socketRef,
    room, roomId, myId, error, connectionError, messages, summary,
    createRoom, joinRoom, leaveRoom, endRoom,
    passMate, timerToggle, timerReset,
    updateActivity, sendMessage, updateTimerConfig,
    dismissSummary,
  };
}
