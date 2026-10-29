"use client";

import { AppShell } from "@/features/navigation/components/app-shell";
import { ClientErrorReporter } from "@/components/dev/client-error-reporter";
import { usePathname } from "next/navigation";

const NO_SHELL_PATHS = ["/", "/login", "/auth/callback", "/setup-passkey"];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const caseInProgress =
    /^\/start\/case\/[^/]+\/attempt(\/|$)/.test(pathname) ||
    /^\/case\/[^/]+\/attempt(\/|$)/.test(pathname);
  const liveSessionInProgress = /^\/live\/[^/]+(\/|$)/.test(pathname);
  const hideShell = NO_SHELL_PATHS.includes(pathname);

  if (hideShell) {
    return <main className="min-h-screen flex flex-col">{children}</main>;
  }

  if (caseInProgress || liveSessionInProgress) {
    return (
      <>
        <ClientErrorReporter />
        <main className={liveSessionInProgress ? "min-h-0 flex-1 overflow-hidden" : "flex-1"}>{children}</main>
      </>
    );
  }

  return (
    <>
      <ClientErrorReporter />
      <AppShell>{children}</AppShell>
    </>
  );
}
