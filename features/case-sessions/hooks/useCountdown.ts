import { useEffect, useState } from "react";

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hms = [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
  if (days > 0) return `${days}d ${hms}`;
  return hms;
}

export function useCountdown(targetIso: string) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [targetIso]);

  const remainingMs = new Date(targetIso).getTime() - now;
  return {
    remainingMs,
    expired: remainingMs <= 0,
    label: formatCountdown(remainingMs),
  };
}
