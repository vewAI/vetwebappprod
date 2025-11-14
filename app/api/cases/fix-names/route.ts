import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseServiceKey) {
  console.warn(
    "SUPABASE_SERVICE_ROLE_KEY not set — /api/cases/fix-names requires a service key"
  );
}
const supabase = createClient(supabaseUrl, supabaseServiceKey ?? "");

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const ownerExamples = [
  "Catalina",
  "Alex",
  "Jordan",
  "Sam",
  "Morgan",
  "Taylor",
  "Casey",
  "Riley",
  "Charlie",
  "Jamie",
];

const horseNames = [
  "Catalina's Mare",
  "Shadow",
  "Star",
  "Bella",
  "Charlie",
  "Misty",
  "Thunder",
  "Duke",
  "Willow",
  "Patch",
];

export async function POST(req: Request) {
  try {
    // Fetch all cases (careful in prod - this route is intended for maintenance)
    const { data: cases, error } = await supabase
      .from("cases")
      .select("id, owner_background, title, description")
      .limit(1000);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const updates: Array<{ id: string; owner_background?: string }> = [];

    for (const c of cases as any[]) {
      const id: string = c.id;
      const ob: string = String(c.owner_background ?? "");
      let needsUpdate = false;
      let newOwnerBackground = ob || "";

      // Heuristics: look for 'Horse:' or 'Owner:' lines
      const hasHorse = /Horse\s*:/i.test(newOwnerBackground);
      const hasOwner =
        /Owner\s*:/i.test(newOwnerBackground) ||
        /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(
          (newOwnerBackground && newOwnerBackground.split("\n")[0]) || ""
        );

      if (!hasHorse || !hasOwner) {
        // Generate deterministic picks
        const h = hashCode(id || String(Date.now()));
        const owner = ownerExamples[h % ownerExamples.length];
        const horse = horseNames[h % horseNames.length];

        if (!newOwnerBackground || newOwnerBackground.trim() === "") {
          newOwnerBackground = `Role: Horse Owner (Female, cooperative)\nOwner: ${owner}\nHorse: ${horse}\n\n(Author note: auto-added owner and horse names)`;
        } else {
          if (!hasOwner) {
            newOwnerBackground += `\nOwner: ${owner}`;
          }
          if (!hasHorse) {
            newOwnerBackground += `\nHorse: ${horse}`;
          }
          newOwnerBackground += `\n\n(Author note: auto-added missing owner/horse names)`;
        }
        needsUpdate = true;
      }

      if (needsUpdate) {
        updates.push({ id, owner_background: newOwnerBackground });
      }
    }

    const results: Array<any> = [];
    for (const u of updates) {
      const { data, error } = await supabase
        .from("cases")
        .update({ owner_background: u.owner_background })
        .eq("id", u.id)
        .select()
        .single();
      if (error) {
        results.push({ id: u.id, success: false, error: error.message });
      } else {
        results.push({ id: u.id, success: true });
      }
    }

    return NextResponse.json({ updated: results.length, results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg || "Unknown error" },
      { status: 500 }
    );
  }
}
