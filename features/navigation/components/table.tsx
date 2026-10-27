/**
 * Adapted from TailAdmin React (MIT).
 * https://github.com/TailAdmin/free-react-tailwind-admin-dashboard
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn("min-w-full", className)}>{children}</table>;
}

export function TableHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <thead className={className}>{children}</thead>;
}

export function TableBody({ children, className }: { children: ReactNode; className?: string }) {
  return <tbody className={className}>{children}</tbody>;
}

export function TableRow({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={className}>{children}</tr>;
}

export function TableCell({
  children,
  isHeader = false,
  className,
  colSpan,
}: {
  children?: ReactNode;
  isHeader?: boolean;
  className?: string;
  colSpan?: number;
}) {
  const CellTag = isHeader ? "th" : "td";
  return (
    <CellTag className={className} colSpan={colSpan}>
      {children}
    </CellTag>
  );
}
