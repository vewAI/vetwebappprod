import Image from "next/image";
import { LoginForm } from "@/features/login/components/login-form";
import "./login.css";
const logoSrc =
  process.env.NEXT_PUBLIC_BRAND_LOGO_URL ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/img/logo_transparent.png`
    : "/placeholder.svg");

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/70 to-primary/80 flex flex-col items-center justify-center p-4">
      {/* Logo and Company Name */}
      <div className="mb-4 flex flex-row items-center gap-2 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-top-4">
        <div className="relative h-20 w-20">
          <Image src={logoSrc} alt="VewAI Logo" width={80} height={80} className="h-full w-full object-contain " priority />
        </div>
        <h2 className="text-4xl text-primary tracking-tight">
          Vew<span className="text-white font-bold">Ai</span>
        </h2>
      </div>

      {/* Header */}
      <div className="mb-8 text-center motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-top-4">
        <h1 className="text-4xl font-bold text-white  mb-3 tracking-tight">Veterinary OSCE Simulator</h1>
        <p className=" text-lg text-white typewriter-text overflow-hidden">AI-powered educational simulator for veterinary students</p>
      </div>

      <LoginForm />
    </div>
  );
}
