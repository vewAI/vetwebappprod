import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { relyingPartyID } from "@/lib/webauthn/config";
import { saveChallenge } from "@/lib/webauthn/store";

export async function POST() {
  try {
    const options = await generateAuthenticationOptions({
      rpID: relyingPartyID,
      userVerification: "preferred",
    });

    const saved = await saveChallenge(null, options.challenge);
    if (!saved) {
      return NextResponse.json(
        { error: "Failed to store challenge" },
        { status: 500 }
      );
    }

    return NextResponse.json(options, { status: 200 });
  } catch (err) {
    console.error("Passkey auth challenge error:", err);
    return NextResponse.json(
      { error: "Failed to generate passkey options" },
      { status: 500 }
    );
  }
}
