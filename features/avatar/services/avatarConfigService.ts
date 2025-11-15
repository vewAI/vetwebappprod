import type {
  AvatarEngine,
  AvatarProfile,
  CaseAvatarRow,
} from "../models/avatar";
import { supabase } from "@/lib/supabase";

const cache = new Map<string, AvatarProfile[]>();

export function getAvatarEngine(): AvatarEngine {
  const raw = process.env.NEXT_PUBLIC_AVATAR_ENGINE?.trim().toLowerCase();
  if (raw === "realistic") return "realistic";
  if (raw === "disabled") return "disabled";
  return "classic";
}

export async function fetchAvatarProfiles(
  caseId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<AvatarProfile[]> {
  if (!caseId) {
    return createFallbackProfiles();
  }

  if (!options.forceRefresh && cache.has(caseId)) {
    return cache.get(caseId)!;
  }

  if (getAvatarEngine() === "classic") {
    const fallback = createFallbackProfiles(caseId);
    cache.set(caseId, fallback);
    return fallback;
  }

  try {
    const { data, error } = await supabase
      .from<CaseAvatarRow>("case_avatars")
      .select("*")
      .eq("case_id", caseId)
      .order("display_name", { ascending: true });

    if (error) {
      console.warn("Avatar config fetch failed, using fallback", error);
      const fallback = createFallbackProfiles(caseId);
      cache.set(caseId, fallback);
      return fallback;
    }

    const mapped = mapRowsToProfiles(data ?? [], caseId);
    if (mapped.length === 0) {
      const fallback = createFallbackProfiles(caseId);
      cache.set(caseId, fallback);
      return fallback;
    }

    cache.set(caseId, mapped);
    return mapped;
  } catch (err) {
    console.warn("Avatar config fetch threw, using fallback", err);
    const fallback = createFallbackProfiles(caseId);
    cache.set(caseId, fallback);
    return fallback;
  }
}

export function clearAvatarProfileCache(caseId?: string) {
  if (caseId) {
    cache.delete(caseId);
    return;
  }
  cache.clear();
}

function mapRowsToProfiles(
  data: CaseAvatarRow[],
  caseId: string
): AvatarProfile[] {
  return data.map((row) => ({
    roleKey: row.role_key || "assistant",
    displayName: row.display_name || humanizeRole(row.role_key),
    avatarType: row.avatar_type ?? "svg",
    assetUrl: row.asset_url ?? undefined,
    idleAssetUrl: row.idle_asset_url ?? undefined,
    voiceId: row.voice_id ?? undefined,
    primaryColor: row.primary_color ?? undefined,
    secondaryColor: row.secondary_color ?? undefined,
    metadata: row.metadata ?? undefined,
    fallback: false,
  }));
}

function createFallbackProfiles(caseId?: string): AvatarProfile[] {
  const seed = caseId ? hashCode(caseId) : Date.now();
  return [
    {
      roleKey: "assistant",
      displayName: "Virtual Assistant",
      avatarType: "svg",
      primaryColor: pickColor(seed),
      fallback: true,
    },
    {
      roleKey: "owner",
      displayName: "Pet Owner",
      avatarType: "svg",
      primaryColor: pickColor(seed + 1),
      fallback: true,
    },
    {
      roleKey: "lab-tech",
      displayName: "Lab Technician",
      avatarType: "svg",
      primaryColor: pickColor(seed + 2),
      fallback: true,
    },
  ];
}

export function getFallbackAvatarProfiles(caseId?: string) {
  return createFallbackProfiles(caseId);
}

function humanizeRole(roleKey?: string | null): string {
  if (!roleKey) return "Virtual Assistant";
  return roleKey.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickColor(seed: number): string {
  const hue = Math.abs(seed % 360);
  return `hsl(${hue} 70% 60%)`;
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
