"use client";

import { Navbar } from "@/features/navigation/components/navbar";
import { usePathname } from "next/navigation";
import { Footer } from "../ui/footer";

const NO_LAYOUT_PATHS = ["/login", "/auth/callback", "/setup-passkey"];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const caseInProgress = /^\/case\/[^\/]+\/attempt(\/|$)/.test(pathname);
  const hideLayout = NO_LAYOUT_PATHS.includes(pathname ?? "");

  if (hideLayout) {
    return <main className="min-h-screen flex flex-col">{children}</main>;
  }

  return (
    <>
      {!caseInProgress ? <Navbar /> : null}
      <main className="flex-1">{children}</main>
      {!caseInProgress ? <Footer /> : null}
    </>
  );
}
