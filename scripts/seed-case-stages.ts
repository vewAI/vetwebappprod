#!/usr/bin/env tsx
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { caseConfig } from "../features/config/case-config";
import { resolveChatPersonaRoleKey } from "../features/chat/utils/persona-guardrails";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  for (const [caseId, stages] of Object.entries(caseConfig)) {
    const { count, error: countError } = await supabase
      .from("case_stages")
      .select("id", { count: "exact", head: true })
      .eq("case_id", caseId);

    if (countError) {
      console.error(`Failed to count existing stages for ${caseId}:`, countError.message);
      continue;
    }

    if ((count ?? 0) > 0) {
      console.log(`Skipping ${caseId}: already has ${count} stage rows`);
      continue;
    }

    const rows = stages.map((stage, idx) => ({
      case_id: caseId,
      sort_order: idx,
      title: stage.title,
      description: stage.description,
      persona_role_key: resolveChatPersonaRoleKey(stage.title, stage.role),
      role_label: stage.role,
      role_info_key: stage.roleInfoKey ?? null,
      feedback_prompt_key: stage.feedbackPromptKey ?? null,
      stage_prompt: null,
      transition_message: null,
      is_active: true,
      min_user_turns: 0,
      min_assistant_turns: 0,
      settings: {},
    }));

    const { error } = await supabase.from("case_stages").insert(rows);
    if (error) {
      console.error(`Failed to seed ${caseId}:`, error.message);
    } else {
      console.log(`Seeded ${caseId}: ${rows.length} stages`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
