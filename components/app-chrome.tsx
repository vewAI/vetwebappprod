"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/features/navigation/components/navbar";
import { Footer } from "@/components/ui/footer";
import MobileSpeechControls from "@/features/speech/components/mobile-speech-controls";

const NO_CHROME_PATHS = ["/login", "/auth/callback", "/setup-passkey"];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = NO_CHROME_PATHS.includes(pathname ?? "");

  if (hideChrome) {
    return <div className="min-h-screen flex flex-col">{children}</div>;
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <MobileSpeechControls />
    </>
  );
}
