"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { RefObject } from "react";
import type { Socket } from "socket.io-client";

type RemoteStreams = Map<string, MediaStream>;

const LOG = (...a: unknown[]) => console.log("[🎙 AudioChat]", ...a);

export function useAudioChat(
  socketRef: RefObject<Socket | null>,
  inRoom: boolean,
) {
  // ── Refs ─────────────────────────────────────────────────────────────────
  const peerRef        = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerToUser     = useRef<Map<string, string>>(new Map());
  const userToPeer     = useRef<Map<string, string>>(new Map());
  const activeCalls    = useRef<Map<string, any>>(new Map()); // userId → MediaConnection
  const peerOpenRef    = useRef(false);
  const unmountedRef   = useRef(false);

  // ── State ─────────────────────────────────────────────────────────────────
  const [localStream,   setLocalStream]   = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreams>(new Map());
  const [audioError,    setAudioError]    = useState<string | null>(null);
  const [isDeafened,    setIsDeafened]    = useState(false);

  const isAudioActive = !!localStream;

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      activeCalls.current.forEach((c) => { try { c.close(); } catch {} });
      activeCalls.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      peerRef.current?.destroy();
      peerRef.current = null;
      peerOpenRef.current = false;
    };
  }, []);

  // Create a silent audio track so peers can answer/call while mic is off.
  // We need *a track* for WebRTC to negotiate; MediaStream() without tracks
  // results in answer() failing or the stream being closed when replaced.
  const silentTrackRef = useRef<MediaStreamTrack | null>(null);
  const getSilentStream = useCallback((): MediaStream => {
    if (!silentTrackRef.current || silentTrackRef.current.readyState === "ended") {
      const ctx = new AudioContext();
      const dst = ctx.createMediaStreamDestination();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0; // silence
      osc.connect(gain).connect(dst);
      osc.start();
      silentTrackRef.current = dst.stream.getAudioTracks()[0];
      silentTrackRef.current.enabled = false;
    }
    return new MediaStream([silentTrackRef.current]);
  }, []);

  // Replace outgoing audio on every active call with a new track (or silence).
  // Uses RTCRtpSender.replaceTrack — keeps the connection open, no renegotiation.
  const replaceSentAudioTrack = useCallback((newTrack: MediaStreamTrack | null) => {
    activeCalls.current.forEach((call) => {
      const pc: RTCPeerConnection | undefined = call.peerConnection;
      if (!pc) return;
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === "audio") {
          sender.replaceTrack(newTrack).catch((e) =>
            LOG("replaceTrack failed:", e),
          );
        }
      });
    });
  }, []);

  // ── Call a peer (with current local stream, or silent one if mic off) ────
  const callPeer = useCallback((peerId: string, userId: string) => {
    const peer = peerRef.current;
    if (!peer || peer.destroyed || peer.disconnected) return;
    if (activeCalls.current.has(userId)) {
      LOG(`callPeer skip: already calling ${userId}`);
      return;
    }

    // PeerJS requires a stream with a track to negotiate. When mic is off,
    // send a silent track — keeps the connection alive for receiving audio.
    const stream = localStreamRef.current ?? getSilentStream();
    LOG(`calling ${userId} (${peerId}) with ${stream.getAudioTracks().length} track(s)`);

    let call: any;
    try {
      call = peer.call(peerId, stream);
    } catch (e) {
      LOG(`peer.call threw for ${userId}:`, e);
      return;
    }
    if (!call) return;
    activeCalls.current.set(userId, call);

    call.on("stream", (remote: MediaStream) => {
      LOG(`✅ remote stream from ${userId}`);
      if (!unmountedRef.current)
        setRemoteStreams((p) => new Map(p).set(userId, remote));
    });
    call.on("close", () => {
      activeCalls.current.delete(userId);
      setRemoteStreams((p) => { const m = new Map(p); m.delete(userId); return m; });
    });
    call.on("error", (e: Error) => {
      LOG(`call error with ${userId}:`, e);
      activeCalls.current.delete(userId);
    });
  }, [getSilentStream]);

  // ── Create the Peer once we're in a room (auto, no mic needed) ─────────
  useEffect(() => {
    if (!inRoom) return;
    const socket = socketRef.current;
    if (!socket) { LOG("socket not ready"); return; }

    let cancelled = false;

    (async () => {
      const { Peer } = await import("peerjs");
      if (cancelled || unmountedRef.current) return;

      const usePublicPeer = process.env.NEXT_PUBLIC_USE_PUBLIC_PEER === "true";
      const port = parseInt(window.location.port) || (window.location.protocol === "https:" ? 443 : 80);

      // ICE servers: STUN for NAT discovery + public TURN for relay fallback
      // when both peers are behind symmetric NATs. openrelay.metered.ca is a
      // free public TURN — fine for a low-traffic app, replace with your own
      // if you grow beyond their limits.
      const iceServers = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443?transport=tcp",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ];

      const peerConfig = usePublicPeer
        ? { host: "0.peerjs.com", port: 443, secure: true, debug: 0, config: { iceServers } }
        : {
            host:   window.location.hostname,
            port,
            path:   "/peerjs",
            secure: window.location.protocol === "https:",
            debug:  2,
            config: { iceServers },
          };

      LOG(`creating Peer → ${peerConfig.host}:${peerConfig.port}`);
      const peer = new Peer(peerConfig as any);
      peerRef.current = peer;

      peer.on("call", (call: any) => {
        const callerUserId = peerToUser.current.get(call.peer) ?? call.peer;
        LOG(`incoming call from ${callerUserId}`);
        // Answer with current stream (or silent if mic off — receive-only)
        const answerStream = localStreamRef.current ?? getSilentStream();
        call.answer(answerStream);
        activeCalls.current.set(callerUserId, call);
        call.on("stream", (remote: MediaStream) => {
          LOG(`✅ remote stream (answered) from ${callerUserId}`);
          if (!unmountedRef.current)
            setRemoteStreams((p) => new Map(p).set(callerUserId, remote));
        });
        call.on("close", () => {
          activeCalls.current.delete(callerUserId);
          setRemoteStreams((p) => { const m = new Map(p); m.delete(callerUserId); return m; });
        });
        call.on("error", (e: Error) => {
          LOG(`incoming call error from ${callerUserId}:`, e);
          activeCalls.current.delete(callerUserId);
        });
      });

      peer.on("error", (e: Error) => {
        LOG("Peer error:", e.toString());
        // Don't surface every transient error to the user
        if ((e as any).type === "peer-unavailable") return;
        setAudioError(`Error de conexión de audio: ${e.message ?? e}`);
      });

      peer.on("disconnected", () => {
        if (peer.destroyed || unmountedRef.current) return;
        LOG("Peer disconnected → reconnecting…");
        setTimeout(() => {
          if (!peer.destroyed && !unmountedRef.current) peer.reconnect();
        }, 1000);
      });

      peer.on("close", () => { peerOpenRef.current = false; LOG("Peer closed"); });

      peer.on("open", (myPeerId: string) => {
        peerOpenRef.current = true;
        LOG(`Peer open ✅ myPeerId=${myPeerId}`);
        const s = socketRef.current;
        if (!s || unmountedRef.current) return;

        s.once("existing-peers", (peers: { userId: string; peerId: string }[]) => {
          LOG(`existing-peers: ${peers.length}`);
          peers.forEach(({ userId, peerId }) => {
            peerToUser.current.set(peerId, userId);
            userToPeer.current.set(userId, peerId);
            callPeer(peerId, userId);
          });
        });
        s.emit("peer-announce", { peerId: myPeerId });
      });
    })();

    // ── Signaling handlers ───────────────────────────────────────────────
    const onPeerAnnounced = ({ userId, peerId }: { userId: string; peerId: string }) => {
      LOG(`peer-announced userId=${userId}`);
      peerToUser.current.set(peerId, userId);
      userToPeer.current.set(userId, peerId);
      // We initiate the call (the new peer hasn't seen us yet); add small delay
      // so their peer.on("call") handler is registered.
      setTimeout(() => callPeer(peerId, userId), 600);
    };

    const onPeerLeft = ({ userId }: { userId: string }) => {
      LOG(`peer-left userId=${userId}`);
      const peerId = userToPeer.current.get(userId);
      if (peerId) peerToUser.current.delete(peerId);
      userToPeer.current.delete(userId);
      const call = activeCalls.current.get(userId);
      if (call) { try { call.close(); } catch {} activeCalls.current.delete(userId); }
      setRemoteStreams((p) => { const m = new Map(p); m.delete(userId); return m; });
    };

    socket.on("peer-announced", onPeerAnnounced);
    socket.on("peer-left",      onPeerLeft);

    return () => {
      cancelled = true;
      socket.off("peer-announced", onPeerAnnounced);
      socket.off("peer-left",      onPeerLeft);
      // Destroy the Peer when leaving the room so next entry starts fresh
      activeCalls.current.forEach((c) => { try { c.close(); } catch {} });
      activeCalls.current.clear();
      peerRef.current?.destroy();
      peerRef.current = null;
      peerOpenRef.current = false;
      peerToUser.current.clear();
      userToPeer.current.clear();
      setRemoteStreams(new Map());
    };
  }, [socketRef, callPeer, inRoom]);

  // ── Enable / disable microphone (only manages the local track) ───────────
  const enableAudio = useCallback(async () => {
    if (localStreamRef.current) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      LOG("getUserMedia failed:", err);
      setAudioError("No se pudo acceder al micrófono. Verificá los permisos del navegador.");
      return;
    }
    if (unmountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    localStreamRef.current = stream;
    setLocalStream(stream);
    const micTrack = stream.getAudioTracks()[0] ?? null;
    LOG("mic on → swapping outgoing track to real mic");
    replaceSentAudioTrack(micTrack);
  }, [replaceSentAudioTrack]);

  const disableAudio = useCallback(() => {
    LOG("mic off → swapping outgoing track to silent");
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setAudioError(null);
    // Replace with silent track — keeps connections alive so we still *receive*
    const silent = getSilentStream().getAudioTracks()[0] ?? null;
    replaceSentAudioTrack(silent);
  }, [getSilentStream, replaceSentAudioTrack]);

  const toggleDeafen = useCallback(() => setIsDeafened((d) => !d), []);

  return {
    isAudioActive,
    isDeafened,
    localStream,
    remoteStreams,
    audioError,
    enableAudio,
    disableAudio,
    toggleDeafen,
  };
}
