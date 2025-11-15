"use client";

import { useEffect, useMemo, useState } from "react";

import { useTtsAnalyser } from "@/features/speech/hooks/useTtsAnalyser";
import { useAvatarPresence } from "@/features/avatar/context/avatar-presence";
import type { AvatarProfile } from "@/features/avatar/models/avatar";
import {
  fetchAvatarProfiles,
  getFallbackAvatarProfiles,
} from "@/features/avatar/services/avatarConfigService";
import { normalizeRoleKey } from "@/features/avatar/utils/role-utils";

export default function TalkingAvatar() {
  const { amplitude } = useTtsAnalyser();
  const {
    activeDisplayName,
    activeCaseId,
    activeRoleKey,
    isSpeaking,
    lastSpokenAt,
  } = useAvatarPresence();
  const [isVisible, setIsVisible] = useState(false);
  const [colorSeed, setColorSeed] = useState(() => Date.now());
  const [profiles, setProfiles] = useState<AvatarProfile[]>(() =>
    getFallbackAvatarProfiles()
  );

  useEffect(() => {
    let cancelled = false;

    if (!activeCaseId) {
      setProfiles(getFallbackAvatarProfiles());
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const list = await fetchAvatarProfiles(activeCaseId);
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          setProfiles(list);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("Falling back to default avatars", err);
          setProfiles(getFallbackAvatarProfiles(activeCaseId));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCaseId]);

  useEffect(() => {
    if (isSpeaking) {
      setIsVisible(true);
      setColorSeed(Date.now());
      return;
    }

    if (!lastSpokenAt) {
      setIsVisible(false);
      return;
    }

    const elapsed = Date.now() - lastSpokenAt;
    const remaining = Math.max(120, 480 - elapsed);
    const timeout = window.setTimeout(() => {
      setIsVisible(false);
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [isSpeaking, lastSpokenAt]);

  const activeProfile = useMemo(() => {
    if (!profiles.length) return undefined;
    if (activeRoleKey) {
      const normalized = normalizeRoleKey(activeRoleKey);
      const match = profiles.find(
        (profile) => normalizeRoleKey(profile.roleKey) === normalized
      );
      if (match) return match;
    }
    return profiles[0];
  }, [profiles, activeRoleKey]);

  const speakerLabel = useMemo(() => {
    return (
      activeDisplayName ?? activeProfile?.displayName ?? "Virtual Assistant"
    );
  }, [activeDisplayName, activeProfile?.displayName]);

  const mouthOpen = useMemo(() => {
    const clamped = Math.max(0, Math.min(1, amplitude * 1.4));
    return 0.25 + clamped * 1.1;
  }, [amplitude]);

  const avatarColor = useMemo(() => {
    if (activeProfile?.primaryColor && activeProfile?.secondaryColor) {
      return `linear-gradient(180deg, ${activeProfile.primaryColor} 0%, ${activeProfile.secondaryColor} 100%)`;
    }
    if (activeProfile?.primaryColor) {
      return activeProfile.primaryColor;
    }
    const hue = Math.abs(colorSeed % 360);
    return `linear-gradient(180deg, hsl(${hue} 80% 70%) 0%, hsl(${
      (hue + 30) % 360
    } 65% 55%) 100%)`;
  }, [activeProfile?.primaryColor, activeProfile?.secondaryColor, colorSeed]);

  if (!isVisible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed bottom-6 right-6 z-50"
      style={{ width: 128, height: 128 }}
    >
      <div
        className="relative flex h-full w-full items-center justify-center rounded-full shadow-2xl"
        style={{
          background: avatarColor,
          transition: "transform 240ms ease",
          transform: `rotate(${(colorSeed % 10) - 5}deg)`,
        }}
      >
        <svg width="78" height="78" viewBox="0 0 78 78" aria-hidden>
          <circle cx="39" cy="34" r="26" fill="#fff" opacity={0.95} />
          <circle cx="27" cy="30" r="4" fill="#0f172a" />
          <circle cx="51" cy="30" r="4" fill="#0f172a" />
          <g transform="translate(39 46)">
            <rect
              x={-16}
              y={-7}
              width={32}
              height={14}
              rx={9}
              fill="#0f172a"
              style={{
                transformOrigin: "center",
                transform: `scaleY(${mouthOpen.toFixed(2)})`,
                transition: "transform 80ms linear",
              }}
            />
          </g>
        </svg>
        {speakerLabel && (
          <div className="absolute -bottom-7 rounded-lg bg-white/90 px-3 py-1 text-xs font-medium text-slate-700">
            {speakerLabel}
            {activeProfile?.fallback && (
              <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                beta
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
