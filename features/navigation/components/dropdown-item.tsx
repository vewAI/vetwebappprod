"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";

interface DropdownItemProps {
  href?: string;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

export function DropdownItem({ href, onClick, className, children }: DropdownItemProps) {
  const classes = cn(
    "flex w-full items-center gap-2 px-4 py-2 text-start text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-gray-100",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
