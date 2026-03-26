"use client";
import { useEffect, useRef, useState } from "react";

/** True if the Document Picture-in-Picture API is available (Chrome 116+). */
export function isPipSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "documentPictureInPicture" in window
  );
}

interface UsePipReturn {
  isSupported: boolean;
  isOpen:      boolean;
  pipWindow:   Window | null;
  openPip:     (opts?: { width?: number; height?: number }) => Promise<void>;
  closePip:    () => void;
}

export function usePip(): UsePipReturn {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipRef     = useRef<Window | null>(null);
  const isSupported = isPipSupported();

  const openPip = async ({ width = 300, height = 220 }: { width?: number; height?: number } = {}) => {
    if (!isSupported || pipRef.current) return;
    try {
      const pip: Window = await (window as any).documentPictureInPicture.requestWindow({ width, height });
      pipRef.current = pip;

      // ── Copy all <style> and <link rel="stylesheet"> from the parent ──────
      [...document.querySelectorAll("style")].forEach((el) => {
        pip.document.head.appendChild(el.cloneNode(true));
      });
      [...document.querySelectorAll('link[rel="stylesheet"]')].forEach((el) => {
        pip.document.head.appendChild(el.cloneNode(false));
      });

      // ── Base document styles ──────────────────────────────────────────────
      pip.document.documentElement.style.cssText =
        "background:#1a120b;color:#f0ebe5;margin:0;padding:0;overflow:hidden;height:100%;";
      pip.document.body.style.cssText = "margin:0;padding:0;height:100%;";

      // ── Close hook (user closes the PiP window natively) ─────────────────
      pip.addEventListener("pagehide", () => {
        pipRef.current = null;
        setPipWindow(null);
      });

      setPipWindow(pip);
    } catch (e) {
      console.warn("[PiP] Could not open window:", e);
    }
  };

  const closePip = () => {
    pipRef.current?.close();
    pipRef.current = null;
    setPipWindow(null);
  };

  // Close PiP if the component using this hook unmounts
  useEffect(() => () => { pipRef.current?.close(); }, []);

  return { isSupported, isOpen: !!pipWindow, pipWindow, openPip, closePip };
}
