import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { requireUser } from "@/app/api/_lib/auth";
import {
  relyingPartyID,
  relyingPartyOrigin,
} from "@/lib/webauthn/config";
import {
  getChallengeByUserId,
  deleteChallenge,
  saveCredential,
} from "@/lib/webauthn/store";

export async function POST(req: Request) {
  const authResult = await requireUser(req);
  if ("error" in authResult) {
    return authResult.error;
  }

  const { user } = authResult;

  const challenge = await getChallengeByUserId(user.id);
  if (!challenge) {
    return NextResponse.json(
      { error: "No pending passkey registration" },
      { status: 400 }
    );
  }

  // Delete challenge immediately to prevent replay (regardless of verify success)
  await deleteChallenge(challenge.id);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body as Parameters<typeof verifyRegistrationResponse>[0]["response"],
      expectedChallenge: challenge.value,
      expectedOrigin: relyingPartyOrigin,
      expectedRPID: relyingPartyID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Could not verify passkey" },
        { status: 400 }
      );
    }

    const { credential, credentialDeviceType, credentialBackedUp, userVerified, aaguid } =
      verification.registrationInfo;

    const saved = await saveCredential({
      user_id: user.id,
      credential_id: credential.id,
      friendly_name: `Passkey created ${new Date().toLocaleString()}`,
      credential_type: "public-key",
      public_key: credential.publicKey,
      aaguid: typeof aaguid === "string" ? aaguid : "00000000-0000-0000-0000-000000000000",
      sign_count: credential.counter,
      transports:
        (body as { response?: { transports?: string[] } })?.response?.transports ?? [],
      user_verification_status: userVerified ? "verified" : "unverified",
      device_type:
        credentialDeviceType === "singleDevice" ? "single_device" : "multi_device",
      backup_state: credentialBackedUp ? "backed_up" : "not_backed_up",
    });

    if (!saved) {
      return NextResponse.json(
        { error: "Failed to save passkey" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        credential_id: saved.credential_id,
        friendly_name: saved.friendly_name,
        created_at: saved.created_at,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Passkey verify error:", err);
    return NextResponse.json(
      { error: "Could not verify passkey" },
      { status: 400 }
    );
  }
}
