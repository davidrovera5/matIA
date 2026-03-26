"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { RefObject } from "react";
import type { Socket } from "socket.io-client";

type RemoteStreams = Map<string, MediaStream>;

const LOG = (...a: unknown[]) => console.log("[🎥 PeerCamera]", ...a);

export function usePeerCamera(socketRef: RefObject<Socket | null>) {
  // ── Refs ─────────────────────────────────────────────────────────────────
  const peerRef         = useRef<any>(null);
  const localStreamRef  = useRef<MediaStream | null>(null);
  const peerToUser      = useRef<Map<string, string>>(new Map()); // peerId → userId
  const calledPeers     = useRef<Set<string>>(new Set());         // peerId → called
  const peerCreating    = useRef(false);                          // guard double-create
  const unmountedRef    = useRef(false);                          // true only on real unmount

  // ── State ─────────────────────────────────────────────────────────────────
  const [localStream,   setLocalStream]  = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreams>(new Map());

  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // Cleanup on unmount (also runs in React Strict Mode's simulated unmount).
  // Reset ALL refs so the next mount starts from a clean slate — otherwise
  // localStreamRef.current being truthy would block enableCamera's guard.
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      peerRef.current?.destroy();
      peerRef.current = null;
      peerCreating.current = false;
      calledPeers.current.clear();
    };
  }, []);

  // ── Core call helper ──────────────────────────────────────────────────────
  const callPeer = useCallback((
    peerId:  string,
    userId:  string,
    peer:    any,
    delay = 0,
  ) => {
    if (calledPeers.current.has(peerId)) {
      LOG(`[callPeer] skip duplicate → ${userId}`);
      return;
    }
    calledPeers.current.add(peerId);

    const doCall = () => {
      // ── Ready state guard ──────────────────────────────────────────────
      if (!peer || peer.destroyed) {
        LOG(`[callPeer] ABORT: peer destroyed → ${userId}`);
        calledPeers.current.delete(peerId); // allow retry with fresh peer
        return;
      }
      if (peer.disconnected) {
        LOG(`[callPeer] WARN: peer disconnected, reconnecting first → ${userId}`);
        calledPeers.current.delete(peerId);
        // Reconnect then re-try this call once open
        peer.reconnect();
        peer.once("open", () => callPeer(peerId, userId, peer, 0));
        return;
      }

      // ── Always read the live stream at call time (never stale closure) ─
      const stream = localStreamRef.current;
      if (!stream) {
        LOG(`[callPeer] ABORT: no local stream for ${userId}`);
        calledPeers.current.delete(peerId);
        return;
      }
      const activeTracks = stream.getTracks().filter((t) => t.readyState === "live");
      if (activeTracks.length === 0) {
        LOG(`[callPeer] ABORT: all tracks ended for ${userId}`);
        calledPeers.current.delete(peerId);
        return;
      }

      LOG(`[callPeer] calling ${userId} (${peerId})…`);
      try {
        const call = peer.call(peerId, stream);
        if (!call) {
          LOG(`[callPeer] peer.call returned null for ${userId}`);
          calledPeers.current.delete(peerId);
          return;
        }
        call.on("stream", (remote: MediaStream) => {
          LOG(`[callPeer] ✅ stream from ${userId}`);
          if (!unmountedRef.current)
            setRemoteStreams((p) => new Map(p).set(userId, remote));
        });
        call.on("close", () => {
          LOG(`[callPeer] call closed with ${userId}`);
          setRemoteStreams((p) => { const m = new Map(p); m.delete(userId); return m; });
        });
        call.on("error", (e: Error) => {
          LOG(`[callPeer] call error with ${userId}:`, e);
          calledPeers.current.delete(peerId);
        });
      } catch (e) {
        LOG(`[callPeer] peer.call() threw for ${userId}:`, e);
        calledPeers.current.delete(peerId);
      }
    };

    if (delay > 0) setTimeout(doCall, delay);
    else doCall();
  }, []);

  // ── Socket signaling ──────────────────────────────────────────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) { LOG("socket not ready at mount"); return; }
    LOG("registering signaling handlers on socket", socket.id);

    const onPeerAnnounced = ({ userId, peerId }: { userId: string; peerId: string }) => {
      LOG(`[signal] peer-announced userId=${userId} peerId=${peerId}`);
      peerToUser.current.set(peerId, userId);

      // Belt+suspenders: if we already have a live peer+stream, call the new joiner
      const peer = peerRef.current;
      if (peer && !peer.destroyed && !peer.disconnected && localStreamRef.current) {
        LOG(`[signal] we have stream → calling new peer ${userId} in 600ms`);
        callPeer(peerId, userId, peer, 600);
      }
    };

    const onPeerLeft = ({ userId }: { userId: string }) => {
      LOG(`[signal] peer-left userId=${userId}`);
      setRemoteStreams((p) => { const m = new Map(p); m.delete(userId); return m; });
    };

    socket.on("peer-announced", onPeerAnnounced);
    socket.on("peer-left",      onPeerLeft);

    return () => {
      socket.off("peer-announced", onPeerAnnounced);
      socket.off("peer-left",      onPeerLeft);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Enable camera ─────────────────────────────────────────────────────────
  const enableCamera = useCallback(async () => {
    // Prevent double-creation (two rapid clicks, StrictMode, etc.)
    if (localStreamRef.current || peerCreating.current) {
      LOG("enableCamera: already active or creating, skip");
      return;
    }
    peerCreating.current = true;

    // Try video+audio, fallback to video-only
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      LOG("getUserMedia: video+audio ✅");
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        LOG("getUserMedia: video-only ✅");
      } catch (err) {
        LOG("getUserMedia failed:", err);
        peerCreating.current = false;
        return;
      }
    }

    if (unmountedRef.current) { stream.getTracks().forEach((t) => t.stop()); peerCreating.current = false; return; }

    setLocalStream(stream);
    localStreamRef.current = stream;

    // Destroy any stale peer before creating new one
    if (peerRef.current && !peerRef.current.destroyed) {
      LOG("destroying stale peer before creating new one");
      peerRef.current.destroy();
    }
    peerRef.current = null;

    const { Peer } = await import("peerjs");

    // ── Peer server selection ──────────────────────────────────────────────
    // Set NEXT_PUBLIC_USE_PUBLIC_PEER=true in .env.local to bypass our own
    // PeerJS server and use 0.peerjs.com instead — useful to rule out
    // WebSocket-upgrade routing bugs on localhost.
    // In production / tunnel access, window.location already points at the
    // right host+port, so no special detection is needed for ngrok/localtunnel.
    const usePublicPeer = process.env.NEXT_PUBLIC_USE_PUBLIC_PEER === "true";
    const port = parseInt(window.location.port) || (window.location.protocol === "https:" ? 443 : 80);

    const peerConfig = usePublicPeer
      ? { host: "0.peerjs.com", port: 443, secure: true, debug: 3 }
      : {
          host:   window.location.hostname,
          port,
          path:   "/peerjs",
          secure: window.location.protocol === "https:",
          debug:  3,
        };

    LOG(`creating Peer → ${peerConfig.host}:${peerConfig.port}${"path" in peerConfig ? peerConfig.path : ""}`);

    const peer = new Peer(peerConfig as any);

    peerRef.current = peer;

    // ── Answer incoming calls ──────────────────────────────────────────────
    peer.on("call", (call: any) => {
      const callerUserId = peerToUser.current.get(call.peer) ?? call.peer;
      LOG(`[peer.on:call] incoming from ${callerUserId} (${call.peer})`);

      const ls = localStreamRef.current;
      if (!ls) { LOG("[peer.on:call] no local stream — cannot answer"); return; }
      const liveTracks = ls.getTracks().filter((t) => t.readyState === "live");
      if (liveTracks.length === 0) { LOG("[peer.on:call] all tracks ended — cannot answer"); return; }

      call.answer(ls);

      call.on("stream", (remote: MediaStream) => {
        LOG(`[peer.on:call] ✅ stream received from ${callerUserId}`);
        if (!unmountedRef.current)
          setRemoteStreams((p) => new Map(p).set(callerUserId, remote));
      });
      call.on("close", () => {
        LOG(`[peer.on:call] call closed from ${callerUserId}`);
        setRemoteStreams((p) => { const m = new Map(p); m.delete(callerUserId); return m; });
      });
      call.on("error", (e: Error) => LOG(`[peer.on:call] error from ${callerUserId}:`, e));
    });

    // ── Auto-reconnect on signaling disconnect (once, with delay) ────────────
    // A tight reconnect loop can cause ID_TAKEN races on the server: the old
    // client entry may still exist when the reconnect arrives, causing the
    // server to reject the new connection → 1006 → loop.  One delayed retry
    // is enough; if it fails again the user can re-enable the camera.
    let reconnectAttempted = false;
    peer.on("disconnected", () => {
      if (peer.destroyed || unmountedRef.current) return;
      if (reconnectAttempted) {
        LOG("Peer disconnected again after retry — giving up. Re-enable camera to try.");
        peer.destroy();
        peerRef.current = null;
        peerCreating.current = false;
        return;
      }
      reconnectAttempted = true;
      LOG("Peer disconnected → reconnecting in 1 s…");
      setTimeout(() => {
        if (!peer.destroyed && !unmountedRef.current) peer.reconnect();
      }, 1000);
    });

    peer.on("error",  (e: Error) => LOG("Peer error:", e.toString()));
    peer.on("close",  ()         => LOG("Peer permanently closed"));

    // ── Announce to room once open ─────────────────────────────────────────
    peer.on("open", (myPeerId: string) => {
      LOG(`Peer open ✅  myPeerId=${myPeerId}`);
      peerCreating.current = false;

      const socket = socketRef.current;
      if (!socket || unmountedRef.current) return;

      // Register existing-peers handler BEFORE emitting (no race possible after this)
      socket.once("existing-peers", (peers: { userId: string; peerId: string }[]) => {
        LOG(`existing-peers received: ${peers.length} peer(s)`, peers);
        peers.forEach(({ userId, peerId }) => {
          peerToUser.current.set(peerId, userId);
          callPeer(peerId, userId, peer, 500);
        });
      });

      socket.emit("peer-announce", { peerId: myPeerId });
      LOG(`peer-announce emitted  peerId=${myPeerId}`);
    });
  }, [callPeer]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Disable camera ─────────────────────────────────────────────────────────
  const disableCamera = useCallback(() => {
    LOG("disableCamera called");
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    localStreamRef.current = null;

    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.destroy();
    }
    peerRef.current = null;
    peerCreating.current = false;

    socketRef.current?.emit("peer-leave");
    setRemoteStreams(new Map());
    peerToUser.current.clear();
    calledPeers.current.clear();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { localStream, remoteStreams, enableCamera, disableCamera };
}
