import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Live Session — VetSim",
  description: "Voice-first veterinary clinical simulation",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {children}
    </div>
  );
}
