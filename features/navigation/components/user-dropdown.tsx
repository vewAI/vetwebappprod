"use client";

import { useState } from "react";
import { LayoutDashboard, LogOut, User } from "lucide-react";
import { useAuth } from "@/features/auth/services/authService";
import { ChevronDownIcon } from "@/features/navigation/icons";
import { Dropdown } from "@/features/navigation/components/dropdown";
import { DropdownItem } from "@/features/navigation/components/dropdown-item";

function dashboardHref(role: string | null) {
  if (role === "student") return "/student";
  if (role === "professor" || role === "admin") return "/professor";
  return "/dashboard";
}

function roleLabel(role: string | null) {
  if (role === "admin") return "Admin";
  if (role === "professor") return "Professor";
  if (role === "student") return "Student";
  return null;
}

export function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut, role, yearGroupName } = useAuth();
  const email = user?.email ?? "";
  const label = email.split("@")[0] || "User";
  const initial = label.slice(0, 1).toUpperCase();
  const roleText = roleLabel(role);

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

      <Dropdown isOpen={isOpen} onClose={() => setIsOpen(false)} className="end-1 w-64 p-2">
        <div className="flex flex-col items-center border-b border-gray-200 px-3 py-4 text-center dark:border-gray-800">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/12 dark:text-brand-400">
            <User className="size-7" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-medium text-gray-800 dark:text-white/90">{label}</p>
          {email ? <p className="mt-0.5 w-full truncate text-theme-xs text-gray-500 dark:text-gray-400">{email}</p> : null}
          {roleText ? <p className="mt-2 text-theme-xs font-medium text-gray-600 dark:text-gray-300">{roleText}</p> : null}
          {role === "student" ? (
            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
              {yearGroupName ?? "Year group not assigned"}
            </p>
          ) : null}
        </div>
        <DropdownItem href={dashboardHref(role)} className="mt-1 text-gray-700" onClick={() => setIsOpen(false)}>
          <LayoutDashboard className="size-4" />
          <span>Dashboard</span>
        </DropdownItem>
        <DropdownItem
          className="text-gray-700"
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
