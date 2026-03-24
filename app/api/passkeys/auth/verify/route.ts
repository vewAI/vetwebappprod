/**
 * Completes sign-in with a passkey. Verifies that the user's device correctly answered the challenge
 * and signs them in by creating a session, so they can access their account without a password.
 */
import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { relyingPartyID, relyingPartyOrigin } from "@/lib/webauthn/config";
import { getChallengeByValue, deleteChallenge, getCredentialByCredentialId, updateCredentialCounter } from "@/lib/webauthn/store";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

export async function POST(req: Request) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const response = body as {
    id?: string;
    rawId?: string;
    response?: { clientDataJSON?: string; authenticatorData?: string; signature?: string };
    type?: string;
  };

  const credentialId = response?.id;
  if (!credentialId || !response?.response) {
    return NextResponse.json({ error: "Invalid assertion response" }, { status: 400 });
  }

  const credential = await getCredentialByCredentialId(credentialId);
  if (!credential) {
    return NextResponse.json({ error: "Unknown passkey" }, { status: 400 });
  }

  const publicKeyBytes = isoBase64URL.toBuffer(credential.public_key); // straight from DB

  // Decode clientDataJSON to get the challenge for lookup
  let expectedChallenge: string;
  try {
    const clientDataJSON = Buffer.from(response.response.clientDataJSON!, "base64url").toString("utf-8");
    const clientData = JSON.parse(clientDataJSON) as { challenge?: string };
    expectedChallenge = clientData.challenge ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid assertion" }, { status: 400 });
  }

  const challengeRow = await getChallengeByValue(expectedChallenge);
  if (!challengeRow) {
    return NextResponse.json({ error: "Invalid or expired challenge" }, { status: 400 });
  }

  await deleteChallenge(challengeRow.id);

  try {
    const verification = await verifyAuthenticationResponse({
      response: body as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
      expectedChallenge,
      expectedOrigin: relyingPartyOrigin,
      expectedRPID: relyingPartyID,
      credential: {
        id: credential.credential_id,
        publicKey: publicKeyBytes,
        counter: credential.sign_count,
      },
    });

    if (!verification.verified || !verification.authenticationInfo) {
      return NextResponse.json({ error: "Passkey verification failed, " + (verification.authenticationInfo || "unknown error") }, { status: 400 });
    }
    await updateCredentialCounter(verification.authenticationInfo.credentialID, verification.authenticationInfo.newCounter);

    const userId = credential.user_id;
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);

    if (userError || !userData?.user?.email) {
      return NextResponse.json({ error: "User not found" }, { status: 400 });
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("generateLink error:", linkError);
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json({
      token_hash: linkData.properties.hashed_token,
      type: "email",
    });
  } catch (err) {
    console.error("Passkey auth verify error:", err);
    return NextResponse.json({ error: "Passkey verification faileds, " + (err as Error).message }, { status: 400 });
  }
}
