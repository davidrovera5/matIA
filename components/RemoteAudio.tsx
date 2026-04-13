"use client";
import { useEffect, useRef } from "react";

function AudioPlayer({ stream, muted }: { stream: MediaStream; muted: boolean }) {
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

  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <audio ref={ref} autoPlay playsInline style={{ display: "none" }} />;
}

export default function RemoteAudio({
  remoteStreams,
  deafened = false,
}: {
  remoteStreams: Map<string, MediaStream>;
  deafened?: boolean;
}) {
  return (
    <>
      {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
        <AudioPlayer key={userId} stream={stream} muted={deafened} />
      ))}
    </>
  );
}
