"use client";

import { Navbar } from "@/features/navigation/components/navbar";
import { usePathname } from "next/navigation";
import { Footer } from "../ui/footer";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const caseInProgress = /^\/case\/[^\/]+\/attempt(\/|$)/.test(pathname);

  return (
    <>
      {!caseInProgress ? <Navbar /> : null}
      <main className="flex-1">{children}</main>
      {!caseInProgress ? <Footer /> : null}
    </>
  );
}
