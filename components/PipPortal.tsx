"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

interface Props {
  pipWindow: Window | null;
  children:  ReactNode;
}

/**
 * Renders `children` into a Document PiP window using a dedicated React root.
 * Re-renders the PiP content automatically whenever the parent component
 * re-renders (no dep array on the update effect — intentional).
 */
export default function PipPortal({ pipWindow, children }: Props) {
  const rootRef = useRef<Root | null>(null);

  // Create / destroy the React root when the PiP window opens/closes
  useEffect(() => {
    if (!pipWindow) {
      rootRef.current?.unmount();
      rootRef.current = null;
      return;
    }
    rootRef.current = createRoot(pipWindow.document.body);
    return () => {
      rootRef.current?.unmount();
      rootRef.current = null;
    };
  }, [pipWindow]);

  // Keep PiP content in sync with parent state — runs after every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { rootRef.current?.render(children); });

  return null;
}
