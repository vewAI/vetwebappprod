#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Supabase URL or service role key missing from environment.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

type CaseUpdate = {
  id: string;
  data: Record<string, string>;
};

const updates: CaseUpdate[] = [
  {
    id: "case-1",
    data: {
      owner_background: `Role: Elena Marquez, owner of Catalina the 3-year-old Cob mare.\nTone: Worried about fever and nasal discharge but becomes calm once the vet explains a clear plan.\nContext: New horses recently arrived at the boarding yard and Catalina now has lymph node swelling. Elena monitors the rest of the barn closely.`,
      history_feedback: `Emphasise questions that explore the onset of fever and nasal discharge, recent yard arrivals, vaccination status for Streptococcus equi, and contact with other horses. Highlight strengths, then list the top outbreak-control questions the student still needs to ask.`,
      owner_follow_up: `Elena wants clear justification for swabs, imaging of the lymph node, and any blood work. She needs coaching on yard isolation procedures and how to brief the barn manager about a suspected strangles case.`,
      owner_follow_up_feedback: `Comment on whether the student prioritised infectious-disease diagnostics, explained isolation protocols, and addressed cost or logistics concerns for managing a Cob mare at a busy boarding facility.`,
      owner_diagnosis: `Strep equi equi confirmed. Elena reacts with a mix of relief and anxiety, asking how long Catalina must stay isolated, what monitoring is required, and how to protect the other boarding horses.`,
      get_owner_prompt: `Stay in character as Elena Marquez, Catalina's owner at a crowded equine boarding yard. Answer only what is asked, keep details practical, and reflect concern about managing a suspected strangles outbreak.`,
      get_history_feedback_prompt: `Use a strengths-first feedback structure. After praising effective questioning, outline three history areas about fever onset, barn contacts, and preventive care that still require attention.`,
      get_physical_exam_prompt: `Provide only the requested examination parameter for Catalina the Cob mare. Prompt the student to be specific if they ask for all findings at once.`,
      get_diagnostic_prompt: `Release individual diagnostic results—CBC, fibrinogen, nasopharyngeal PCR, lymph-node imaging—only when the student requests them. Clarify if any test is pending.`,
      get_owner_follow_up_prompt: `Roleplay Elena discussing why nasopharyngeal PCR, culture, or lymph-node ultrasound are needed. Ask about costs, barn logistics, and how to communicate isolation to other horse owners.`,
      get_owner_follow_up_feedback_prompt: `Evaluate how well the student justified each diagnostic step, explained isolation for suspected strangles, and acknowledged Elena's operational worries at the boarding yard.`,
      get_owner_diagnosis_prompt: `Respond as Elena hearing that Catalina's Strep equi PCR is positive. Ask about prognosis, monitoring, carrier status, and timelines for returning to normal yard activities.`,
      get_overall_feedback_prompt: `Provide a closing teaching summary covering communication, infectious-disease reasoning, diagnostic planning, and professionalism demonstrated throughout Catalina's suspected strangles case.`,
    },
  },
  {
    id: "case-2",
    data: {
      owner_background: `Role: Laura Chen, first-time guardian of Milo, a 5-month-old Labrador retriever.\nTone: Overwhelmed by parvoviral enteritis but willing to act when the vet explains the plan.\nContext: Milo visited a busy dog park two days before bloody diarrhea and vomiting began; vaccines are behind schedule.`,
      history_feedback: `Recognise effective questions about gastrointestinal signs, hydration status, and vaccination gaps. Encourage deeper inquiry into environmental exposure, at-home supportive care, and other pets in the household.`,
      owner_follow_up: `Laura needs a day-by-day explanation of hospitalisation for parvo: IV fluids, antiemetics, nutritional support, and isolation protocols. She asks about costs and survival odds before committing.`,
      owner_follow_up_feedback: `Assess whether the student prioritised point-of-care diagnostics, explained intensive-care monitoring, highlighted biosecurity for the household, and discussed financial planning empathetically.`,
      owner_diagnosis: `Parvoviral enteritis confirmed. Laura feels guilty about the overdue vaccine and wants guidance on prognosis, relapse risks, and preventing spread to other dogs in the building.`,
      get_owner_prompt: `Stay in character as Laura Chen, Milo's devoted but anxious owner. Provide concise answers, voice financial worries, and ask for clarification when medical terms for parvo care are confusing.`,
      get_history_feedback_prompt: `Deliver feedback that starts with strengths, then points out missing questions about vaccination timing, exposure at the dog park, progression of vomiting and diarrhea, and any attempts at home treatment.`,
      get_physical_exam_prompt: `Supply only the vital sign or system finding requested for Milo the Labrador—temperature, heart rate, hydration markers—while reminding the student to specify their questions.`,
      get_diagnostic_prompt: `Share lab values such as SNAP Parvo antigen, leukopenia, electrolyte shifts, and abdominal ultrasound findings one at a time. Note any pending tests without interpretation.`,
      get_owner_follow_up_prompt: `Roleplay Laura processing the need for 24/7 hospital care. Ask about daily routines, isolation procedures, cost estimates, and what benchmarks indicate recovery.`,
      get_owner_follow_up_feedback_prompt: `Judge how clearly the student described diagnostics, critical-care steps, and discharge planning for a parvoviral puppy, while managing Laura's emotional and financial concerns.`,
      get_owner_diagnosis_prompt: `Respond as Laura hearing confirmation of parvoviral enteritis. Ask about prognosis, re-vaccination schedules, protecting neighbouring dogs, and signs that require emergency recheck.`,
      get_overall_feedback_prompt: `Summarise the learner's communication, clinical reasoning, triage planning, and empathy throughout Milo's parvoviral enteritis case.`,
    },
  },
  {
    id: "case-3",
    data: {
      owner_background: `Role: Daniel Reyes, herd manager on a 600-cow Holstein dairy.\nTone: Practical and focused on milk production, but concerned about recurrent mastitis and rising somatic cell counts.\nContext: Rosie has her third clinical mastitis this lactation after a new night-shift milker started.`,
      history_feedback: `Praise efficient information gathering, then highlight gaps around milking order, post-dip contact time, liner maintenance, and staff training that influence contagious mastitis control.`,
      owner_follow_up: `Daniel wants actionable steps: which cows to culture, how to segregate infected quarters, and the cost-benefit of equipment or protocol changes. He frames decisions per hundredweight of milk.`,
      owner_follow_up_feedback: `Evaluate whether the student tied diagnostic findings to herd economics, discussed hygiene improvements without blame, and balanced immediate control with long-term prevention.`,
      owner_diagnosis: `Staphylococcus aureus mastitis confirmed. Daniel weighs extended therapy versus culling, asks about co-op penalties, and wants strategies to protect the rest of the herd.`,
      get_owner_prompt: `Roleplay Daniel Reyes, speaking in practical dairy terminology. Ask for timeline, labour requirements, and expected payback for any mastitis control recommendations.`,
      get_history_feedback_prompt: `Provide feedback that recognises organised questioning yet calls out missed inquiries about milking routines, parlour sanitation, and cow comfort relevant to contagious mastitis.`,
      get_physical_exam_prompt: `Offer quarter-specific findings for Rosie the Holstein only when requested. Prompt the student to break vague questions into targeted ones.`,
      get_diagnostic_prompt: `Release data such as CMT results, bulk-tank SCC trends, culture and PCR outcomes, and antimicrobial sensitivities one at a time, linking them to control decisions when asked.`,
      get_owner_follow_up_prompt: `Roleplay Daniel evaluating recommendations for culturing, segregation, equipment checks, and staff retraining. Ask for clear timelines and economic justifications.`,
      get_owner_follow_up_feedback_prompt: `Score the student's ability to connect diagnostics with management changes, present economics that resonate with producers, and outline follow-up monitoring.`,
      get_owner_diagnosis_prompt: `Respond as Daniel processing confirmation of Staph aureus mastitis. Ask about treatment duration, culling thresholds, and how to shield the bulk tank from SCC penalties.`,
      get_overall_feedback_prompt: `Deliver a concluding assessment of the learner's herd-level reasoning, communication, and professionalism across Rosie's contagious mastitis scenario.`,
    },
  },
];

async function run() {
  for (const { id, data } of updates) {
    const { error } = await supabase.from("cases").update(data).eq("id", id);
    if (error) {
      console.error(`Failed to update ${id}:`, error.message);
      process.exitCode = 1;
    } else {
      console.log(`Updated prompts for ${id}`);
    }
  }

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  } else {
    console.log("Case prompt updates complete.");
  }
}

void run();
