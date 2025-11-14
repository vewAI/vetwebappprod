import React from "react";
import { cn } from "@/lib/utils";

type AvatarProps = {
  name?: string;
  role?: string;
  size?: number;
  isSpeaking?: boolean;
  amplitude?: number;
};

function initialsFromName(s?: string) {
  if (!s) return "?";
  const parts = s
    .replace(/\(.*\)/, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  role,
  size = 40,
  isSpeaking = false,
  amplitude = 0,
}) => {
  const initials = initialsFromName(name ?? role ?? "?");
  const bg = "bg-gradient-to-br from-indigo-400 to-pink-400";

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-full text-white",
        bg
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div className="text-sm font-semibold select-none">{initials}</div>
      {/* simple mouth overlay that animates when speaking */}
      <div
        className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-2 rounded-full bg-black/75"
        style={{
          marginBottom: size * 0.06,
          transformOrigin: "center",
          // Map amplitude (0..1) to a scaleY range (0.35..1.0)
          transform: `scaleY(${Math.max(0.35, 1 - (amplitude || 0) * 0.8)})`,
          transition: "transform 80ms linear",
        }}
      />
    </div>
  );
};

export default Avatar;
