"use client";
import { useEffect, useRef } from "react";

export function useNotifications() {
  const permissionRef = useRef<NotificationPermission>("default");

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    permissionRef.current = Notification.permission;
    if (Notification.permission === "default") {
      Notification.requestPermission().then((p) => {
        permissionRef.current = p;
      });
    }
  }, []);

  const notify = (title: string, body?: string) => {
    if (typeof Notification === "undefined") return;
    if (permissionRef.current !== "granted") return;
    new Notification(title, { body, icon: "/favicon.ico" });
  };

  return { notify };
}
