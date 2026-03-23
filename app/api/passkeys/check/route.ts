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
