import type { Metadata } from "next";
import { GeistSans, GeistMono } from "geist/font";
import "./globals.css";
import { AuthProvider } from "@/features/auth/services/authService";
import { ProtectedRoute } from "@/features/auth/components/protected-route";
import { SpeechDeviceProvider } from "@/features/speech/context/audio-device-context";
import { FontSizeProvider } from "@/features/navigation/context/FontSizeContext";
import MobileSpeechControls from "@/features/speech/components/mobile-speech-controls";
import MainLayout from "@/components/layout/main-layout";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "VEWAI — Veterinary Communication & Clinical Reasoning Platform",
  description:
    "AI-powered clinical communication and reasoning simulation platform for veterinary students and educators, authored by board-certified veterinary specialists.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "48x48" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth scroll-pt-20">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased h-full flex flex-col`}>
        <AuthProvider>
          <FontSizeProvider>
            <SpeechDeviceProvider>
              {process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_AUTH_PROTECTION === "true" ? (
                <ProtectedRoute>
                  <MainLayout>{children}</MainLayout>
                  <MobileSpeechControls />
                </ProtectedRoute>
              ) : (
                <MainLayout>{children}</MainLayout>
              )}
            </SpeechDeviceProvider>
          </FontSizeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
