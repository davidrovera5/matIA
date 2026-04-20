"use client";
import { useEffect, useRef } from "react";

function AudioPlayer({ stream, muted, volume }: { stream: MediaStream; muted: boolean; volume: number }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    const el = ref.current;
    if (el) el.muted = muted;
  }, [muted]);

  useEffect(() => {
    const el = ref.current;
    if (el) el.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <audio ref={ref} autoPlay playsInline style={{ display: "none" }} />;
}

export default function RemoteAudio({
  remoteStreams,
  deafened = false,
  volumes,
}: {
  remoteStreams: Map<string, MediaStream>;
  deafened?: boolean;
  volumes?: Map<string, number>;
}) {
  return (
    <>
      {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
        <AudioPlayer
          key={userId}
          stream={stream}
          muted={deafened}
          volume={volumes?.get(userId) ?? 1}
        />
      ))}
    </>
  );
}
