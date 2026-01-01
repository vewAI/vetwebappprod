import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  if (!auth.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cfgPath = path.join(process.cwd(), "tmp", "llm-provider-config.json");
  try {
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, "utf-8");
      const parsed = JSON.parse(raw);
      return NextResponse.json(parsed);
    }
  } catch (e) {
    console.error("Failed to read llm provider config", e);
  }
  // default
  return NextResponse.json({ defaultProvider: process.env.LLM_DEFAULT_PROVIDER || "openai", featureOverrides: { embeddings: process.env.LLM_PROVIDER_EMBEDDINGS || null } });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  if (!auth.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const cfgPath = path.join(process.cwd(), "tmp");
  try {
    if (!fs.existsSync(cfgPath)) fs.mkdirSync(cfgPath, { recursive: true });
    fs.writeFileSync(path.join(cfgPath, "llm-provider-config.json"), JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ success: true, config: body });
  } catch (e) {
    console.error("Failed to write llm provider config", e);
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}
