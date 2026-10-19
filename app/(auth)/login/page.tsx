import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "@/features/login/components/login-form";
import "./login.css";

export default function LoginPage() {
  const logoSrc =
    process.env.NEXT_PUBLIC_BRAND_LOGO_URL ||
    "/images/logo-v.png";

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-primary/70 to-primary/80 flex flex-col items-center justify-center p-4">
      {/* Top Navigation - Back to Home */}
      <div className="w-full max-w-md flex justify-start mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-3.5 py-1.5 rounded-full backdrop-blur-sm border border-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Logo and Company Name (clickable to home) */}
      <Link
        href="/"
        className="group flex flex-row items-center gap-2 mb-2 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-top-4 hover:opacity-90 transition-opacity"
        title="Return to Home"
      >
        <div className="relative h-20 w-20 transition-transform group-hover:scale-105">
          <Image src={logoSrc} alt="VewAI Logo" width={80} height={80} className="h-full w-full object-contain" priority />
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl text-primary tracking-tight">
          Vew<span className="text-white font-bold">Ai</span>
        </h2>
      </Link>

      {/* Header */}
      <div className="mb-6 text-center motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-top-4">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">Communication Skills Training Platform</h1>
        <p className="text-sm sm:text-base md:text-lg text-white typewriter-text">AI-powered educational simulator for veterinary students</p>
      </div>

      <LoginForm />

      {/* Footer link to landing page */}
      <div className="mt-4 text-center">
        <Link href="/" className="text-xs text-white/70 hover:text-white underline underline-offset-4 transition-colors">
          ← Return to Presentation & Overview
        </Link>
      </div>
    </div>
  );
}
