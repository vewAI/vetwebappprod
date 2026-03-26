/**
 * Tells whether the signed-in user has at least one passkey linked to their account.
 * Used to show options like "Add passkey" or "Sign in with passkey" in the UI.
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { listCredentialsForUser } from "@/lib/webauthn/store";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

async function hasPasskeyOnDevice(credentials: Array<{ id: string; transports: string[] }>): Promise<boolean> {
  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(32), // dummy challenge
        allowCredentials: credentials.map((c) => ({
          id: isoBase64URL.toBuffer(c.id), // convert DB string → buffer
          type: "public-key",
        })),
        userVerification: "preferred",
      },
      mediation: "silent",
    });

    return true;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const authResult = await requireUser(req);
  if ("error" in authResult) {
    return authResult.error;
  }

  const { user } = authResult;

  const existingCreds = await listCredentialsForUser(user.id);
  const excludeCredentials = existingCreds.map((c) => ({
    id: c.credential_id,
    transports: c.transports as ("internal" | "hybrid" | "usb" | "nfc" | "ble" | "smart-card" | "cable")[],
  }));

  const hasPasskey = await hasPasskeyOnDevice(excludeCredentials);

  return NextResponse.json({ hasPasskey: hasPasskey });
}
