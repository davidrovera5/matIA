const { createServer } = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");
const { WebSocketServer } = require("ws");
const next = require("next");
const express = require("express");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// ── Room state ──────────────────────────────────────────────────────────────
const rooms = new Map();

function createRoom(hostId, hostName, hostAvatar) {
  const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
  rooms.set(roomId, {
    users: [{ id: hostId, name: hostName, avatar: hostAvatar || "🧉", color: "bg-green-500", activity: "" }],
    currentMateIndex: 0,
    hostId,
    timerConfig: { workMinutes: 25, breakMinutes: 5 },
    timer: { phase: "work", secondsLeft: 25 * 60, isRunning: false },
    metrics: { sessionStart: Date.now(), studySeconds: 0, breakSeconds: 0 },
    messages: [],
    peers: {},   // socketId → peerId
    interval: null,
  });
  return roomId;
}

function getPublicRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const { interval, peers, messages, ...pub } = room;
  return pub;
}

const COLORS = ["bg-green-500", "bg-blue-500", "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-teal-500"];
const AVATARS = ["🎸", "📚", "💻", "🎨", "🎮", "🔬"];

function addUser(roomId, userId, userName, userAvatar) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const idx = room.users.length;
  room.users.push({
    id: userId,
    name: userName,
    avatar: userAvatar || AVATARS[idx % AVATARS.length],
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
  if (room.peers) delete room.peers[userId];
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

  // Trust the X-Forwarded-Proto / X-Forwarded-For headers that ngrok (and
  // other reverse-proxies) inject, so req.protocol === "https" and
  // req.ip are correct behind the tunnel.
  expressApp.set("trust proxy", 1);

  const httpServer = createServer(expressApp);

  // Node.js default keepAliveTimeout is 5 000 ms.  After ws writes the 101
  // Switching Protocols directly to the socket (bypassing ServerResponse), the
  // HTTP server still tracks that socket as an idle keep-alive connection and
  // calls socket.destroy() after 5 s → 1006.  Setting 0 disables the timer.
  httpServer.keepAliveTimeout = 0;

  // ── Socket.IO — auto-attach to httpServer (handles polling HTTP + upgrade) ─
  // polling + websocket: client starts with HTTP polling, then upgrades.
  // destroyUpgrade:false → engine.io won't destroy /_next/webpack-hmr upgrades.
  const io = new Server(httpServer, {
    cors: { origin: "*" },
    transports: ["polling", "websocket"],
    destroyUpgrade: false,
  });

  // Log when a socket upgrades from polling → websocket
  io.engine.on("connection", (rawSocket) => {
    rawSocket.once("upgrade", () => {
      console.log(`⬆️  Socket upgraded → websocket  id=${rawSocket.id}`);
    });
  });

  // ── CORS — allow tunnel / external origins on all HTTP routes ───────────────
  expressApp.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin",  "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.sendStatus(200); return; }
    next();
  });

  // ── PeerJS — ws.Server with noServer:true, upgrades routed manually ────────
  // createWebSocketServer lets peer use our pre-built wss instead of creating
  // its own (which would auto-attach to a server and fight for upgrades).
  // noServer:true means NO path-matching — we call handleUpgrade() directly,
  // so there is no shouldHandle() check that could call socket.destroy().
  // path:"/" → ExpressPeerServer mounts its HTTP routes at "/:key/id" etc.,
  // which after Express strips "/peerjs" correctly resolve to /peerjs/:key/id.
  let peerWss = null;
  const peerServer = ExpressPeerServer(createServer(), {
    debug: false,
    path: "/",
    createWebSocketServer: (opts) => {
      peerWss = new WebSocketServer({ noServer: true });
      console.log(`[PeerJS] ws.Server ready (noServer, path: ${opts.path})`);

      // WebSocket-level ping every 5 s keeps the TCP connection alive and
      // detects dead sockets before PeerJS's 90 s alive_timeout fires.
      const pingTimer = setInterval(() => {
        peerWss.clients.forEach((ws) => {
          if (ws.isAlive === false) { ws.terminate(); return; }
          ws.isAlive = false;
          ws.ping();
        });
      }, 5000);
      peerWss.on("close", () => clearInterval(pingTimer));
      peerWss.on("connection", (ws) => {
        ws.isAlive = true;
        ws.on("pong", () => { ws.isAlive = true; });
      });

      return peerWss;
    },
  });
  expressApp.use("/peerjs", peerServer);

  // ── Single WebSocket upgrade router ──────────────────────────────────────
  // Socket.IO (destroyUpgrade:false) handles /socket.io via its own listener.
  // We explicitly handle /peerjs with handleUpgrade() — no path matching, no
  // risk of abortHandshake.  Everything else flows to Next.js if available.
  const nextUpgrade =
    typeof app.getUpgradeHandler === "function" ? app.getUpgradeHandler() : null;

  httpServer.on("upgrade", (req, socket, head) => {
    const url = req.url ?? "";
    if (url.startsWith("/peerjs")) {
      if (!peerWss) { socket.destroy(); return; }
      peerWss.handleUpgrade(req, socket, head, (ws) => {
        peerWss.emit("connection", ws, req);
      });
    } else if (!url.startsWith("/socket.io") && nextUpgrade) {
      nextUpgrade(req, socket, head);
    }
    // /socket.io → Socket.IO's own listener (registered by new Server(httpServer,...))
    // /_next/webpack-hmr → nextUpgrade or browser retries
  });

  io.on("connection", (socket) => {
    console.log(`✅ Socket conectado  id=${socket.id}  transport=${socket.conn.transport.name}`);

    socket.on("create-room", ({ userName, avatar }, cb) => {
      const roomId = createRoom(socket.id, userName || "Host", avatar);
      socket.join(roomId);
      socket.data.roomId = roomId;
      cb({ roomId, room: getPublicRoom(roomId) });
    });

    socket.on("join-room", ({ roomId, userName, avatar }, cb) => {
      if (!rooms.has(roomId)) return cb({ error: "Sala no encontrada" });
      const room = addUser(roomId, socket.id, userName || "Invitado", avatar);
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.to(roomId).emit("room-updated", room);
      cb({ room, messages: rooms.get(roomId)?.messages ?? [] });
    });

    socket.on("leave-room", () => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (room?.peers?.[socket.id]) {
        delete room.peers[socket.id];
        socket.to(roomId).emit("peer-left", { userId: socket.id });
      }
      removeUser(roomId, socket.id);
      socket.leave(roomId);
      socket.data.roomId = null;
      const pub = getPublicRoom(roomId);
      if (pub) socket.to(roomId).emit("room-updated", pub);
    });

    socket.on("end-room", () => {
      const { roomId } = socket.data;
      const room = rooms.get(roomId);
      if (!room || room.hostId !== socket.id) return;
      clearInterval(room.interval);
      room.interval = null;
      const summary = buildSummary(room);
      room.users = [];
      room.messages = [];
      room.peers = {};
      rooms.delete(roomId);
      io.to(roomId).emit("room-ended", summary);
      io.in(roomId).socketsLeave(roomId);
    });

    // ── Peer camera signaling ──────────────────────────────────────────────
    socket.on("peer-announce", ({ peerId }) => {
      const { roomId } = socket.data;
      const room = rooms.get(roomId);
      if (!room) { console.log("[peer-announce] room not found for", socket.id); return; }

      room.peers[socket.id] = peerId;

      // Tell the new peer about all currently streaming peers
      const existingPeers = Object.entries(room.peers)
        .filter(([uid]) => uid !== socket.id)
        .map(([userId, pId]) => ({ userId, peerId: pId }));

      console.log(
        `[peer-announce] socketId=${socket.id}  peerId=${peerId}  room=${roomId}  ` +
        `existingPeers=${existingPeers.length}  broadcastTo=${Object.keys(room.peers).length - 1}`,
      );

      socket.emit("existing-peers", existingPeers);
      socket.to(roomId).emit("peer-announced", { userId: socket.id, peerId });
    });

    socket.on("peer-leave", () => {
      const { roomId } = socket.data;
      const room = rooms.get(roomId);
      if (!room) return;
      console.log(`[peer-leave] socketId=${socket.id}  room=${roomId}`);
      delete room.peers[socket.id];
      socket.to(roomId).emit("peer-left", { userId: socket.id });
    });
    // ─────────────────────────────────────────────────────────────────────

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
      const room = rooms.get(roomId);
      if (room?.peers?.[socket.id]) {
        delete room.peers[socket.id];
        socket.to(roomId).emit("peer-left", { userId: socket.id });
      }
      removeUser(roomId, socket.id);
      const pub = getPublicRoom(roomId);
      if (pub) socket.to(roomId).emit("room-updated", pub);
    });
  });

  expressApp.all("/{*path}", (req, res) => handle(req, res));

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`> matIA ready on http://localhost:${PORT}`);
  });
});
