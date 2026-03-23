import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { requireUser } from "@/app/api/_lib/auth";
import { relyingPartyID, relyingPartyName } from "@/lib/webauthn/config";
import { saveChallenge, listCredentialsForUser } from "@/lib/webauthn/store";

export async function POST(req: Request) {
  const authResult = await requireUser(req);
  if ("error" in authResult) {
    return authResult.error;
  }

  const { user } = authResult;

  try {
    const existingCreds = await listCredentialsForUser(user.id);
    const excludeCredentials = existingCreds.map((c) => ({
      id: c.credential_id,
      transports: c.transports as ("internal" | "hybrid" | "usb" | "nfc" | "ble" | "smart-card" | "cable")[],
    }));

    const options = await generateRegistrationOptions({
      rpName: relyingPartyName,
      rpID: relyingPartyID,
      userName: user.email ?? user.id,
      userDisplayName: (user.user_metadata?.display_name as string) ?? user.email ?? undefined,
      userID: new TextEncoder().encode(user.id),
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform",
      },
      excludeCredentials: excludeCredentials.length > 0 ? excludeCredentials : undefined,
    });

    const saved = await saveChallenge(user.id, options.challenge);
    if (!saved) {
      return NextResponse.json({ error: "Failed to store challenge" }, { status: 500 });
    }

    return NextResponse.json(options, { status: 200 });
  } catch (err) {
    console.error("Passkey challenge error:", err);
    return NextResponse.json({ error: "Failed to generate passkey options" }, { status: 500 });
  }
}
