"use client";
import { useEffect, useRef } from "react";

// Plays a single remote audio stream via an <audio> element
function AudioPlayer({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  }, [stream]);

  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <audio ref={ref} autoPlay playsInline style={{ display: "none" }} />;
}

// Mount one AudioPlayer per remote peer — renders no visible DOM
export default function RemoteAudio({
  remoteStreams,
}: {
  remoteStreams: Map<string, MediaStream>;
}) {
  return (
    <>
      {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
        <AudioPlayer key={userId} stream={stream} />
      ))}
    </>
  );
}
