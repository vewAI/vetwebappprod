/**
 * Tells whether the signed-in user has at least one passkey linked to their account.
 * Used to show options like "Add passkey" or "Sign in with passkey" in the UI.
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { countCredentialsForUser } from "@/lib/webauthn/store";

export async function GET(req: Request) {
  const authResult = await requireUser(req);
  if ("error" in authResult) {
    return authResult.error;
  }

  const { user } = authResult;
  const count = await countCredentialsForUser(user.id);

  return NextResponse.json({ hasPasskey: count > 0 });
}
