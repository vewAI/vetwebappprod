"use client";

/**
 * Adapted from TailAdmin React (MIT).
 * https://github.com/TailAdmin/free-react-tailwind-admin-dashboard
 */
import { SidebarProvider, useSidebar } from "@/features/navigation/context/SidebarContext";
import { AppHeader } from "@/features/navigation/components/app-header";
import { AppSidebar } from "@/features/navigation/components/app-sidebar";
import { Backdrop } from "@/features/navigation/components/backdrop";
import { cn } from "@/lib/utils";

function ShellFrame({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered } = useSidebar();

  return (
    <div className="min-h-screen w-full shrink-0 bg-gray-50 xl:flex dark:bg-gray-900">
      <AppSidebar />
      <Backdrop />
      <div
        className={cn(
          "min-h-screen flex-1 transition-[margin] duration-300 ease-in-out",
          isExpanded || isHovered ? "xl:ms-72.5" : "xl:ms-22.5",
        )}
      >
        <AppHeader />
        <main className="mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ShellFrame>{children}</ShellFrame>
    </SidebarProvider>
  );
}
