export type AvatarProfile = {
  roleKey?: string | null;
  displayName?: string | null;
  assetUrl?: string | null;
  idleAssetUrl?: string | null;
  primaryColor?: string | null;
};

export function choosePreferredAvatar(profiles: AvatarProfile[], preferredName = "martin lambert"): AvatarProfile | undefined {
  if (!profiles || profiles.length === 0) return undefined;
  const prefLower = preferredName.toLowerCase();
  const byName = profiles.find((p) => (p.displayName || "").toLowerCase().includes(prefLower));
  if (byName) return byName;
  const byRole = profiles.find((p) => (p.roleKey || "").toLowerCase().includes("nurse"));
  if (byRole) return byRole;
  const assistant = profiles.find((p) => p.roleKey === "assistant");
  if (assistant) return assistant;
  return profiles[0];
}
