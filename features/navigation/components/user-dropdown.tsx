"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/features/auth/services/authService";
import { ChevronDownIcon } from "@/features/navigation/icons";
import { Dropdown } from "@/features/navigation/components/dropdown";
import { DropdownItem } from "@/features/navigation/components/dropdown-item";

export function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const email = user?.email ?? "";
  const label = email.split("@")[0] || "User";
  const initial = label.slice(0, 1).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="dropdown-toggle flex items-center text-gray-700 dark:text-gray-400"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span className="me-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {initial}
        </span>
        <span className="me-1 hidden text-theme-sm font-medium sm:block">{label}</span>
        <ChevronDownIcon className={`stroke-gray-500 transition-transform dark:stroke-gray-400 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <Dropdown isOpen={isOpen} onClose={() => setIsOpen(false)} className="w-64 p-2">
        <div className="border-b border-gray-200 px-3 py-3 dark:border-gray-800">
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">{label}</p>
          {email ? <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">{email}</p> : null}
        </div>
        <DropdownItem
          className="mt-1 text-gray-700"
          onClick={() => {
            setIsOpen(false);
            void signOut();
          }}
        >
          <LogOut className="size-4" />
          <span>Sign out</span>
        </DropdownItem>
      </Dropdown>
    </div>
  );
}
