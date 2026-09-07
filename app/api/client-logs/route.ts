import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/app/api/_lib/rateLimit";

// Receives client-side errors (uncaught errors / unhandled rejections /
// manual reports) and mirrors them into the server logs so production
// issues are visible in Vercel without browser access.
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    if (!consumeRateLimit(`client-logs:${ip}`, 120, 60_000)) {
      return new NextResponse(null, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const entries = Array.isArray(body?.entries) ? body.entries.slice(0, 20) : [];
    for (const entry of entries) {
      const level = entry?.level === "warn" ? "warn" : "error";
      const message = typeof entry?.message === "string" ? entry.message.slice(0, 500) : "";
      const stack = typeof entry?.stack === "string" ? entry.stack.slice(0, 2000) : "";
      const url = typeof entry?.url === "string" ? entry.url.slice(0, 300) : "";
      const at = typeof entry?.at === "string" ? entry.at : "";
      if (level === "error") {
        console.error(`[client] ${message} :: url=${url} at=${at}${stack ? `\n${stack}` : ""}`);
      } else {
        console.warn(`[client] ${message} :: url=${url} at=${at}`);
      }
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
