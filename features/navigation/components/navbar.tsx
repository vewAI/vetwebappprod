"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/features/auth/services/authService";
import { Button } from "@/components/ui/button";
import {
  Menu,
  X,
  LayoutDashboard,
  LogOut,
  History,
  GraduationCap,
  FileText,
  User,
} from "lucide-react";
import { ThemeToggle } from "@/features/navigation/components/theme-toggle";
import { FontSizeToggle } from "@/features/navigation/components/font-size-toggle";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

export function Navbar() {
  const { user, signOut, isAdmin, role, profileLoading } = useAuth();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const isProfessor = role === "professor" || isAdmin;
  const isStudent = role === "student";

  // do not render on login page
  if (pathname === "/login") {
    return null;
  }

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/favicon.ico"
                alt="VEWAI Logo"
                width={32}
                height={32}
                className="rounded-sm"
              />
              <span className="text-xl font-semibold text-primary">VEWAI</span>
            </Link>
          </div>

          <div className="hidden md:flex md:items-center md:space-x-4">
            {isStudent && (
              <Link
                href="/student"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <LayoutDashboard className="size-4" />
                <span>Dashboard</span>
              </Link>
            )}
            {isProfessor && (
              <Link
                href="/professor"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <GraduationCap className="size-4" />
                <span>Dashboard</span>
              </Link>
            )}
            <Link
              href="/cases"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              <FileText className="size-4" />
              <span>Cases</span>
            </Link>
            <Link
              href="/attempts"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              <History className="size-4" />
              <span>My Attempts</span>
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <LayoutDashboard className="size-4" />
                <span>Admin</span>
              </Link>
            )}
          </div>

          <div className="hidden md:flex md:items-center gap-3">
            <FontSizeToggle />
            <ThemeToggle />
            {user && (
              <Popover open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <User className="size-4" />
                    <span className="text-sm font-medium">
                      {user.email?.split("@")[0] || "User"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-1">
                  <div className="space-y-1">
                    {isStudent && (
                      <Link
                        href="/student"
                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <LayoutDashboard className="size-4" />
                        <span>Dashboard</span>
                      </Link>
                    )}

                    {isProfessor && (
                      <Link
                        href="/professor"
                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <GraduationCap className="size-4" />
                        <span>Dashboard</span>
                      </Link>
                    )}
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="size-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-accent hover:text-accent-foreground"
              aria-controls="mobile-menu"
              aria-expanded={isMenuOpen}
              onClick={toggleMenu}
            >
              <span className="sr-only">Open main menu</span>
              {isMenuOpen ? (
                <X className="block size-6" aria-hidden="true" />
              ) : (
                <Menu className="block size-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu, show/hide based on menu state */}
      {isMenuOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="space-y-1 px-2 pb-3 pt-2">
            {isStudent && (
              <Link
                href="/student"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <LayoutDashboard className="size-4" />
                <span>Dashboard</span>
              </Link>
            )}
            {isProfessor && (
              <Link
                href="/professor"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={() => setIsMenuOpen(false)}
              >
                <GraduationCap className="size-5" />
                <span>Dashboard</span>
              </Link>
            )}
            <Link
              href="/cases"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => setIsMenuOpen(false)}
            >
              <FileText className="size-5" />
              <span>Cases</span>
            </Link>
            <Link
              href="/attempts"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => setIsMenuOpen(false)}
            >
              <History className="size-5" />
              <span>My Attempts</span>
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={() => setIsMenuOpen(false)}
              >
                <LayoutDashboard className="size-5" />
                <span>Admin</span>
              </Link>
            )}
            <a
              onClick={() => {
                signOut();
              }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4" />
              <span>Logout</span>
            </a>
            <div className="flex items-center gap-2 rounded-md px-3 py-2">
              <FontSizeToggle />
              <span className="text-sm text-muted-foreground mr-4">
                Font Size
              </span>
              <ThemeToggle size="sm" className="h-8 w-8" />
              <span className="text-sm text-muted-foreground">Theme</span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
