"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Lädt die Seite alle paar Sekunden neu, solange ein Lauf aktiv ist (Fortschritt und Protokoll). */
export function AutoRefresh({ active, seconds = 3 }: { active: boolean; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [active, seconds, router]);
  return null;
}
