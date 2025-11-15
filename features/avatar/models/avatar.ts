export type AvatarEngine = "classic" | "realistic" | "disabled";

export type AvatarType = "svg" | "2d" | "3d" | "video";

export interface AvatarProfile {
  roleKey: string;
  displayName: string;
  avatarType: AvatarType;
  assetUrl?: string;
  idleAssetUrl?: string;
  voiceId?: string;
  primaryColor?: string;
  secondaryColor?: string;
  metadata?: Record<string, unknown>;
  fallback?: boolean;
}

export interface CaseAvatarRow {
  id: string;
  case_id: string;
  role_key: string;
  display_name: string | null;
  avatar_type: AvatarType | null;
  asset_url: string | null;
  idle_asset_url: string | null;
  voice_id: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  metadata: Record<string, unknown> | null;
  updated_at?: string | null;
}
