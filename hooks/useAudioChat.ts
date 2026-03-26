"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { RefObject } from "react";
import type { Socket } from "socket.io-client";

type RemoteStreams = Map<string, MediaStream>;

// Only log in development; silent in production
const LOG = process.env.NODE_ENV !== "production"
  ? (...a: unknown[]) => console.log("[🎙 AudioChat]", ...a)
  : () => {};

export function useAudioChat(socketRef: RefObject<Socket | null>) {
  // ── Refs ─────────────────────────────────────────────────────────────────
  const peerRef         = useRef<any>(null);
  const localStreamRef  = useRef<MediaStream | null>(null);
  const peerToUser      = useRef<Map<string, string>>(new Map());
  const calledPeers     = useRef<Set<string>>(new Set());
  const peerCreating    = useRef(false);
  const unmountedRef    = useRef(false);

  // ── State ─────────────────────────────────────────────────────────────────
  const [localStream,   setLocalStream]  = useState<MediaStream | null>(null);
  const [remoteStreams,  setRemoteStreams] = useState<RemoteStreams>(new Map());
  const [audioError,    setAudioError]   = useState<string | null>(null);

  const isAudioActive = !!localStream;

  // Cleanup on unmount — reset all refs so next mount starts clean
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
      if (!peer || peer.destroyed) {
        LOG(`[callPeer] ABORT: peer destroyed → ${userId}`);
        calledPeers.current.delete(peerId);
        return;
      }
      if (peer.disconnected) {
        LOG(`[callPeer] WARN: peer disconnected, reconnecting → ${userId}`);
        calledPeers.current.delete(peerId);
        peer.reconnect();
        peer.once("open", () => callPeer(peerId, userId, peer, 0));
        return;
      }

      // Always read live stream at call time — never use stale closure
      const stream = localStreamRef.current;
      if (!stream) {
        LOG(`[callPeer] ABORT: no local stream for ${userId}`);
        calledPeers.current.delete(peerId);
        return;
      }
      const liveTracks = stream.getTracks().filter((t) => t.readyState === "live");
      if (liveTracks.length === 0) {
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
          LOG(`[callPeer] ✅ audio stream from ${userId}`);
          if (!unmountedRef.current)
            setRemoteStreams((p) => new Map(p).set(userId, remote));
        });
        call.on("close", () => {
          setRemoteStreams((p) => { const m = new Map(p); m.delete(userId); return m; });
        });
        call.on("error", (e: Error) => {
          LOG(`[callPeer] error with ${userId}:`, e);
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
    LOG("registering signaling handlers");

    const onPeerAnnounced = ({ userId, peerId }: { userId: string; peerId: string }) => {
      LOG(`[signal] peer-announced userId=${userId} peerId=${peerId}`);
      peerToUser.current.set(peerId, userId);
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

  // ── Enable audio ──────────────────────────────────────────────────────────
  const enableAudio = useCallback(async () => {
    if (localStreamRef.current || peerCreating.current) {
      LOG("enableAudio: already active or creating, skip");
      return;
    }
    peerCreating.current = true;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      LOG("getUserMedia: audio ✅");
    } catch (err) {
      LOG("getUserMedia failed:", err);
      setAudioError("No se pudo acceder al micrófono. Verificá los permisos del navegador.");
      peerCreating.current = false;
      return;
    }

    if (unmountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      peerCreating.current = false;
      return;
    }

    localStreamRef.current = stream;
    setLocalStream(stream);

    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.destroy();
    }
    peerRef.current = null;

    const { Peer } = await import("peerjs");
    const usePublicPeer = process.env.NEXT_PUBLIC_USE_PUBLIC_PEER === "true";
    const port = parseInt(window.location.port) || (window.location.protocol === "https:" ? 443 : 80);

    const peerConfig = usePublicPeer
      ? { host: "0.peerjs.com", port: 443, secure: true, debug: 0 }
      : {
          host:   window.location.hostname,
          port,
          path:   "/peerjs",
          secure: window.location.protocol === "https:",
          debug:  0,
        };

    LOG(`creating Peer → ${peerConfig.host}:${peerConfig.port}${"path" in peerConfig ? peerConfig.path : ""}`);
    const peer = new Peer(peerConfig as any);
    peerRef.current = peer;

    // Answer incoming calls
    peer.on("call", (call: any) => {
      const callerUserId = peerToUser.current.get(call.peer) ?? call.peer;
      LOG(`[peer.on:call] incoming from ${callerUserId}`);
      const ls = localStreamRef.current;
      if (!ls) { LOG("[peer.on:call] no local stream — cannot answer"); return; }
      const liveTracks = ls.getTracks().filter((t) => t.readyState === "live");
      if (liveTracks.length === 0) { LOG("[peer.on:call] all tracks ended — cannot answer"); return; }
      call.answer(ls);
      call.on("stream", (remote: MediaStream) => {
        LOG(`[peer.on:call] ✅ audio from ${callerUserId}`);
        if (!unmountedRef.current)
          setRemoteStreams((p) => new Map(p).set(callerUserId, remote));
      });
      call.on("close", () => {
        setRemoteStreams((p) => { const m = new Map(p); m.delete(callerUserId); return m; });
      });
      call.on("error", (e: Error) => LOG(`[peer.on:call] error from ${callerUserId}:`, e));
    });

    // Single reconnect attempt
    let reconnectAttempted = false;
    peer.on("disconnected", () => {
      if (peer.destroyed || unmountedRef.current) return;
      if (reconnectAttempted) {
        LOG("disconnected again — giving up. Re-enable mic to retry.");
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

    peer.on("error", (e: Error) => {
      LOG("Peer error:", e.toString());
      setAudioError(`Error de conexión de audio: ${e.message ?? e}`);
    });
    peer.on("close", ()        => LOG("Peer permanently closed"));

    peer.on("open", (myPeerId: string) => {
      LOG(`Peer open ✅  myPeerId=${myPeerId}`);
      peerCreating.current = false;
      const socket = socketRef.current;
      if (!socket || unmountedRef.current) return;
      socket.once("existing-peers", (peers: { userId: string; peerId: string }[]) => {
        LOG(`existing-peers: ${peers.length} peer(s)`);
        peers.forEach(({ userId, peerId }) => {
          peerToUser.current.set(peerId, userId);
          callPeer(peerId, userId, peer, 500);
        });
      });
      socket.emit("peer-announce", { peerId: myPeerId });
      LOG(`peer-announce emitted  peerId=${myPeerId}`);
    });
  }, [callPeer]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Disable audio ─────────────────────────────────────────────────────────
  const disableAudio = useCallback(() => {
    LOG("disableAudio called");
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setAudioError(null);
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

  return { isAudioActive, localStream, remoteStreams, audioError, enableAudio, disableAudio };
}
