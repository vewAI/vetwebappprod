"use client";

/**
 * Adapted from TailAdmin React (MIT).
 * https://github.com/TailAdmin/free-react-tailwind-admin-dashboard
 */
import { useSidebar } from "@/features/navigation/context/SidebarContext";

export function Backdrop() {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();

  if (!isMobileOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-gray-900/50 xl:hidden"
      onClick={toggleMobileSidebar}
    />
  );
}
