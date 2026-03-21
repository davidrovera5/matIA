const { createServer } = require("http");
const { Server } = require("socket.io");
const next = require("next");
const express = require("express");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// ── Room state ──────────────────────────────────────────────────────────────
const rooms = new Map();

function createRoom(hostId, hostName) {
  const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
  rooms.set(roomId, {
    users: [{ id: hostId, name: hostName, avatar: "🧉", color: "bg-green-500", activity: "" }],
    currentMateIndex: 0,
    hostId,
    timerConfig: { workMinutes: 25, breakMinutes: 5 },
    timer: { phase: "work", secondsLeft: 25 * 60, isRunning: false },
    metrics: { sessionStart: Date.now(), studySeconds: 0, breakSeconds: 0 },
    messages: [],
    interval: null,
  });
  return roomId;
}

function getPublicRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const { interval, ...pub } = room;
  return pub;
}

const COLORS = ["bg-green-500", "bg-blue-500", "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-teal-500"];
const AVATARS = ["🎸", "📚", "💻", "🎨", "🎮", "🔬"];

function addUser(roomId, userId, userName) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const idx = room.users.length;
  room.users.push({
    id: userId,
    name: userName,
    avatar: AVATARS[idx % AVATARS.length],
    color: COLORS[idx % COLORS.length],
    activity: "",
  });
  return getPublicRoom(roomId);
}

function removeUser(roomId, userId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const wasHolder = room.users[room.currentMateIndex]?.id === userId;
  room.users = room.users.filter((u) => u.id !== userId);
  if (room.users.length === 0) {
    clearInterval(room.interval);
    rooms.delete(roomId);
    return;
  }
  if (room.hostId === userId) room.hostId = room.users[0].id;
  if (wasHolder || room.currentMateIndex >= room.users.length) {
    room.currentMateIndex = room.currentMateIndex % room.users.length;
  }
}

function buildSummary(room) {
  return {
    totalSeconds: Math.floor((Date.now() - room.metrics.sessionStart) / 1000),
    studySeconds: room.metrics.studySeconds,
    breakSeconds: room.metrics.breakSeconds,
  };
}

function startTimer(io, roomId) {
  const room = rooms.get(roomId);
  if (!room || room.timer.isRunning) return;
  room.timer.isRunning = true;
  room.interval = setInterval(() => {
    const r = rooms.get(roomId);
    if (!r) return clearInterval(room.interval);

    // Accumulate metrics
    if (r.timer.phase === "work") r.metrics.studySeconds++;
    else r.metrics.breakSeconds++;

    r.timer.secondsLeft -= 1;
    if (r.timer.secondsLeft <= 0) {
      r.timer.phase = r.timer.phase === "work" ? "break" : "work";
      r.timer.secondsLeft =
        r.timer.phase === "work"
          ? r.timerConfig.workMinutes * 60
          : r.timerConfig.breakMinutes * 60;
      r.timer.isRunning = false;
      clearInterval(r.interval);
      r.interval = null;
    }
    io.to(roomId).emit("timer-tick", { ...r.timer });
  }, 1000);
}

function stopTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.timer.isRunning = false;
  clearInterval(room.interval);
  room.interval = null;
}

// ── Server boot ──────────────────────────────────────────────────────────────
app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    console.log("connected:", socket.id);

    socket.on("create-room", ({ userName }, cb) => {
      const roomId = createRoom(socket.id, userName || "Host");
      socket.join(roomId);
      socket.data.roomId = roomId;
      cb({ roomId, room: getPublicRoom(roomId) });
    });

    socket.on("join-room", ({ roomId, userName }, cb) => {
      if (!rooms.has(roomId)) return cb({ error: "Sala no encontrada" });
      const room = addUser(roomId, socket.id, userName || "Invitado");
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.to(roomId).emit("room-updated", room);
      cb({ room, messages: rooms.get(roomId)?.messages ?? [] });
    });

    socket.on("leave-room", () => {
      const { roomId } = socket.data;
      if (!roomId) return;
      removeUser(roomId, socket.id);
      socket.leave(roomId);
      socket.data.roomId = null;
      const room = getPublicRoom(roomId);
      if (room) socket.to(roomId).emit("room-updated", room);
    });

    socket.on("end-room", () => {
      const { roomId } = socket.data;
      const room = rooms.get(roomId);
      if (!room || room.hostId !== socket.id) return;
      // Stop and clear the interval before anything else
      clearInterval(room.interval);
      room.interval = null;
      const summary = buildSummary(room);
      // Wipe all room data immediately so no stale state leaks
      room.users = [];
      room.messages = [];
      rooms.delete(roomId);
      // Notify all clients AFTER deletion so no further events can re-create state
      io.to(roomId).emit("room-ended", summary);
      // Remove all sockets from the Socket.io room
      io.in(roomId).socketsLeave(roomId);
    });

    socket.on("update-timer-config", ({ workMinutes, breakMinutes }) => {
      const { roomId } = socket.data;
      const room = rooms.get(roomId);
      if (!room || room.hostId !== socket.id || room.timer.isRunning) return;
      const wm = Math.max(1, Math.min(90, parseInt(workMinutes) || 25));
      const bm = Math.max(1, Math.min(30, parseInt(breakMinutes) || 5));
      room.timerConfig = { workMinutes: wm, breakMinutes: bm };
      room.timer = { phase: "work", secondsLeft: wm * 60, isRunning: false };
      io.to(roomId).emit("room-updated", getPublicRoom(roomId));
      io.to(roomId).emit("timer-tick", { ...room.timer });
    });

    socket.on("pass-mate", () => {
      const { roomId } = socket.data;
      const room = rooms.get(roomId);
      if (!room) return;
      if (room.users[room.currentMateIndex]?.id !== socket.id) return;
      room.currentMateIndex = (room.currentMateIndex + 1) % room.users.length;
      io.to(roomId).emit("room-updated", getPublicRoom(roomId));
    });

    socket.on("timer-toggle", () => {
      const { roomId } = socket.data;
      const room = rooms.get(roomId);
      if (!room || room.hostId !== socket.id) return;
      if (room.timer.isRunning) {
        stopTimer(roomId);
        io.to(roomId).emit("timer-tick", { ...room.timer });
      } else {
        startTimer(io, roomId);
        io.to(roomId).emit("timer-tick", { ...room.timer });
      }
    });

    socket.on("timer-reset", () => {
      const { roomId } = socket.data;
      const room = rooms.get(roomId);
      if (!room || room.hostId !== socket.id) return;
      stopTimer(roomId);
      room.timer = { phase: "work", secondsLeft: room.timerConfig.workMinutes * 60, isRunning: false };
      io.to(roomId).emit("timer-tick", { ...room.timer });
    });

    socket.on("send-message", ({ text }) => {
      const { roomId } = socket.data;
      const room = rooms.get(roomId);
      if (!room) return;
      const user = room.users.find((u) => u.id === socket.id);
      if (!user) return;
      const msg = {
        id: `${Date.now()}-${socket.id}`,
        userId: socket.id,
        userName: user.name,
        text: String(text ?? "").trim().slice(0, 500),
        timestamp: Date.now(),
      };
      if (!msg.text) return;
      room.messages.push(msg);
      if (room.messages.length > 200) room.messages.shift();
      io.to(roomId).emit("new-message", msg);
    });

    socket.on("update-activity", ({ activity }) => {
      const { roomId } = socket.data;
      const room = rooms.get(roomId);
      if (!room) return;
      const user = room.users.find((u) => u.id === socket.id);
      if (!user) return;
      user.activity = String(activity ?? "").slice(0, 60);
      io.to(roomId).emit("room-updated", getPublicRoom(roomId));
    });

    socket.on("disconnect", () => {
      const { roomId } = socket.data;
      if (!roomId) return;
      removeUser(roomId, socket.id);
      const room = getPublicRoom(roomId);
      if (room) socket.to(roomId).emit("room-updated", room);
    });
  });

  expressApp.all("/{*path}", (req, res) => handle(req, res));

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`> matIA ready on http://localhost:${PORT}`);
  });
});
