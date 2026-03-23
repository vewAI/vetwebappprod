import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

type ChallengeRow = {
  id: string;
  user_id: string | null;
  value: string;
  created_at: string;
};

type CredentialRow = {
  id: string;
  user_id: string;
  credential_id: string;
  friendly_name: string | null;
  credential_type: string;
  public_key: string;
  aaguid: string;
  sign_count: number;
  transports: string[];
  user_verification_status: string;
  device_type: string;
  backup_state: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

function getAdmin(): SupabaseClient | null {
  return getSupabaseAdminClient();
}

export async function saveChallenge(userId: string | null, value: string): Promise<ChallengeRow | null> {
  const admin = getAdmin();
  if (!admin) return null;

  const { data, error } = await admin
    .from("webauthn_challenges")
    .insert({
      user_id: userId,
      value,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to save WebAuthn challenge:", error);
    return null;
  }
  console.log("Saved challenge:", data);
  return data as ChallengeRow;
}

export async function getChallengeByUserId(userId: string): Promise<ChallengeRow | null> {
  const admin = getAdmin();
  if (!admin) return null;

  const { data, error } = await admin
    .from("webauthn_challenges")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as ChallengeRow;
}

export async function getChallengeByValue(value: string): Promise<ChallengeRow | null> {
  const admin = getAdmin();
  if (!admin) return null;

  const { data, error } = await admin
    .from("webauthn_challenges")
    .select("*")
    .eq("value", value)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as ChallengeRow;
}

export async function getCredentialByCredentialId(credentialId: string): Promise<(CredentialRow & { credential_id: string }) | null> {
  const admin = getAdmin();
  if (!admin) return null;

  const { data, error } = await admin.from("webauthn_credentials").select("*").eq("credential_id", credentialId).maybeSingle();

  if (error || !data) return null;
  return data as CredentialRow & { credential_id: string };
}

export async function updateCredentialCounter(credentialId: string, newCounter: number): Promise<boolean> {
  const admin = getAdmin();
  if (!admin) return false;

  const { error } = await admin
    .from("webauthn_credentials")
    .update({
      sign_count: newCounter,
      updated_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    })
    .eq("credential_id", credentialId);

  return !error;
}

export async function deleteChallenge(id: string): Promise<boolean> {
  const admin = getAdmin();
  if (!admin) return false;

  const { error } = await admin.from("webauthn_challenges").delete().eq("id", id);

  return !error;
}

export async function listCredentialsForUser(
  userId: string,
): Promise<Array<{ credential_id: string; credential_type: string; transports: string[] }>> {
  const admin = getAdmin();
  if (!admin) return [];

  const { data, error } = await admin.from("webauthn_credentials").select("credential_id, credential_type, transports").eq("user_id", userId);

  if (error || !data) return [];
  return data as Array<{ credential_id: string; credential_type: string; transports: string[] }>;
}

export async function countCredentialsForUser(userId: string): Promise<number> {
  const admin = getAdmin();
  if (!admin) return 0;

  const { count, error } = await admin.from("webauthn_credentials").select("id", { count: "exact", head: true }).eq("user_id", userId);

  if (error) return 0;
  return count ?? 0;
}

export type SaveCredentialInput = {
  user_id: string;
  credential_id: string;
  friendly_name: string | null;
  credential_type: string;
  public_key: Uint8Array;
  aaguid: string;
  sign_count: number;
  transports: string[];
  user_verification_status: "verified" | "unverified";
  device_type: "single_device" | "multi_device";
  backup_state: "backed_up" | "not_backed_up";
};

export async function saveCredential(input: SaveCredentialInput): Promise<CredentialRow | null> {
  const admin = getAdmin();
  if (!admin) return null;

  const publicKeyBase64 = isoBase64URL.fromBuffer(new Uint8Array(input.public_key));
  const { data, error } = await admin
    .from("webauthn_credentials")
    .insert({
      user_id: input.user_id,
      credential_id: input.credential_id,
      friendly_name: input.friendly_name,
      credential_type: input.credential_type,
      public_key: publicKeyBase64,
      aaguid: input.aaguid,
      sign_count: input.sign_count,
      transports: input.transports,
      user_verification_status: input.user_verification_status,
      device_type: input.device_type,
      backup_state: input.backup_state,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to save WebAuthn credential:", error);
    return null;
  }
  return data as CredentialRow;
}
