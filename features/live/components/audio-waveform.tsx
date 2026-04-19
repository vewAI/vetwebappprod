"use client";

import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

type AudioWaveformProps = {
  isActive: boolean;
  mode: "speaking" | "listening" | "idle";
  className?: string;
};

export function AudioWaveform({ isActive, mode, className }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const phaseRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);
    phaseRef.current += 0.03;

    if (mode === "idle") {
      // Gentle breathing ring
      const breathScale = 0.8 + 0.2 * Math.sin(phaseRef.current * 0.5);
      const radius = Math.min(cx, cy) * 0.35 * breathScale;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
      ctx.fill();
    } else if (mode === "listening") {
      // Pulsing outward rings
      const rings = 3;
      for (let i = 0; i < rings; i++) {
        const ringPhase = phaseRef.current + i * 0.8;
        const scale = 0.3 + 0.7 * ((ringPhase % 2) / 2);
        const alpha = 1 - ((ringPhase % 2) / 2);
        const radius = Math.min(cx, cy) * 0.2 * scale;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(59, 130, 246, ${alpha * 0.6})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Center mic icon circle
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(59, 130, 246, 0.8)";
      ctx.fill();
    } else if (mode === "speaking") {
      // Animated waveform bars
      const bars = 32;
      const barWidth = (w * 0.7) / bars;
      const gap = barWidth * 0.3;
      const startX = w * 0.15;

      for (let i = 0; i < bars; i++) {
        const x = startX + i * (barWidth + gap);
        const wave = Math.sin(phaseRef.current * 2 + i * 0.3);
        const wave2 = Math.sin(phaseRef.current * 1.5 + i * 0.5);
        const combined = (wave + wave2) / 2;
        const barHeight = Math.abs(combined) * h * 0.6 + 4;

        const gradient = ctx.createLinearGradient(x, cy - barHeight / 2, x, cy + barHeight / 2);
        gradient.addColorStop(0, "rgba(16, 185, 129, 0.8)");
        gradient.addColorStop(0.5, "rgba(59, 130, 246, 0.9)");
        gradient.addColorStop(1, "rgba(16, 185, 129, 0.8)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, cy - barHeight / 2, barWidth, barHeight, 2);
        ctx.fill();
      }
    }

    animationRef.current = requestAnimationFrame(draw);
  }, [mode]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationRef.current);
  }, [draw]);

  return (
    <div className={cn("relative w-full", className)}>
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ imageRendering: "auto" }}
      />
    </div>
  );
}
