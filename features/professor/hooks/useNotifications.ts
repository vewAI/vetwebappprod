"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/services/authService";
import axios from "axios";

export function useNotifications() {
  const { session } = useAuth();
  const [newCount, setNewCount] = useState(0);
  const [currentTotal, setCurrentTotal] = useState(0);

  useEffect(() => {
    if (!session?.access_token) return;
    (async () => {
      try {
        const resp = await axios.get("/api/professor/pending-reviews", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const total = resp.data.count as number;
        setCurrentTotal(total);

        const stored = localStorage.getItem(`professor-notifications-${session.user.id}`);
        const lastSeen = stored ? parseInt(stored, 10) : 0;
        setNewCount(Math.max(0, total - lastSeen));
      } catch {
        // silent
      }
    })();
  }, [session?.access_token]);

  const markAsRead = () => {
    if (!session?.user.id) return;
    localStorage.setItem(`professor-notifications-${session.user.id}`, String(currentTotal));
    setNewCount(0);
  };

  return { newCount, markAsRead };
}
