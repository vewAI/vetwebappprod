"use client";

/**
 * Adapted from TailAdmin React (MIT).
 * https://github.com/TailAdmin/free-react-tailwind-admin-dashboard
 */
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Dropdown({ isOpen, onClose, children, className = "" }: DropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest(".dropdown-toggle")
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className={cn(
        "absolute inset-e-0 z-40 mt-2 rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark",
        className,
      )}
    >
      {children}
    </div>
  );
}
