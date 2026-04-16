"use client";

import { Badge } from "@/components/ui/badge";
import { useNotifications } from "../hooks/useNotifications";

export function NotificationBadge() {
  const { newCount, markAsRead } = useNotifications();

  if (newCount === 0) return null;

  return (
    <Badge
      variant="destructive"
      className="cursor-pointer text-xs"
      onClick={markAsRead}
      title="New reviews pending. Click to dismiss."
    >
      {newCount} new
    </Badge>
  );
}
