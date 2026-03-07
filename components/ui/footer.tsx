"use client";

import React from "react";
import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground dark:text-white mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo and Project Info */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-semibold dark:text-white">
                VEWAI
              </span>
            </Link>
            <p className="text-sm text-primary-foreground/80 dark:text-white/80">
              Veterinary Education Web Application with AI. An interactive
              learning platform for veterinary students to practice clinical
              case management.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider dark:text-white">
              Links
            </h3>
            <nav className="flex flex-col space-y-2">
              <Link
                href="/"
                className="text-sm text-primary-foreground/80 dark:text-white/80 hover:text-primary-foreground dark:hover:text-white transition-colors"
              >
                Home
              </Link>
              <Link
                href="/cases"
                className="text-sm text-primary-foreground/80 dark:text-white/80 hover:text-primary-foreground dark:hover:text-white transition-colors"
              >
                Cases
              </Link>
              <Link
                href="/attempts"
                className="text-sm text-primary-foreground/80 dark:text-white/80 hover:text-primary-foreground dark:hover:text-white transition-colors"
              >
                My Attempts
              </Link>
              <Link
                href="/professor"
                className="text-sm text-primary-foreground/80 dark:text-white/80 hover:text-primary-foreground dark:hover:text-white transition-colors"
              >
                Professor Dashboard
              </Link>
            </nav>
          </div>

          {/* Additional Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider dark:text-white">
              About
            </h3>
            <div className="space-y-2 text-sm text-primary-foreground/80 dark:text-white/80">
              <p>
                Practice real-world veterinary case scenarios with AI-powered
                patient interactions and feedback.
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-primary-foreground/20 dark:border-white/20 mt-8 pt-8">
          <p className="text-center text-sm text-primary-foreground/60 dark:text-white/60">
            © {currentYear} VEWAI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
