export type CaseSeed = {
  id: string;
  slug: string;
  title: string;
  description: string;
  species: string;
  condition: string;
  category: string;
  owner_avatar_key: string;
  nurse_avatar_key: string;
  difficulty: "Easy" | "Medium" | "Hard";
  estimated_time: number;
  image_url: string;
  details: Record<string, unknown>;
  physical_exam_findings: string;
  diagnostic_findings: string;
  owner_background: string;
  history_feedback: string;
  owner_follow_up: string;
  owner_follow_up_feedback: string;
  owner_diagnosis: string;
  get_owner_prompt: string;
  get_history_feedback_prompt: string;
  get_physical_exam_prompt: string;
  get_diagnostic_prompt: string;
  get_owner_follow_up_prompt: string;
  get_owner_follow_up_feedback_prompt: string;
  get_owner_diagnosis_prompt: string;
  get_overall_feedback_prompt: string;
};

const placeholderImage =
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80";

export const CASE_SEEDS: CaseSeed[] = [
  {
    id: "case-1",
    slug: "equine-strangles-catalina",
    title: "Catalina the Cob Mare: Fever and Nasal Discharge",
    description:
      "A 3-year-old Cob mare develops pyrexia, swollen submandibular lymph nodes, and dull attitude shortly after new arrivals joined the boarding yard.",
    species: "Equine",
    condition: "Suspected Streptococcus equi infection",
    category: "Equine Infectious Disease",
    owner_avatar_key: "owner-amelia-ramirez",
    nurse_avatar_key: "nurse-isabella-chen",
    difficulty: "Medium",
    estimated_time: 25,
    image_url: placeholderImage,
    details: {
      presenting_complaint:
        "Owner reports 36 hours of reduced appetite, fever, and new mandibular swelling.",
      duration: "36 hours",
      environment:
        "45-horse boarding facility with frequent traffic in and out",
      learning_objectives: [
        "Practice open-ended history taking in a potential infectious-disease outbreak",
        "Prioritise physical exam data gathering before proposing diagnostics",
        "Communicate isolation and biosecurity in a calm, client-centered manner",
      ],
    },
    physical_exam_findings: `Vital signs:\n- Temp: 39.7°C\n- HR: 48 bpm\n- RR: 16 bpm\nAdditional findings:\n- Enlarged (2 cm) warm submandibular lymph node\n- Mild serous nasal discharge\n- Mildly reduced gut sounds, otherwise WNL`,
    diagnostic_findings: `Available diagnostics when requested:\n- CBC: mild neutrophilia (14.8 x10^9/L)\n- Fibrinogen: 5.5 g/L\n- Serum biochemistry: within normal limits\n- Nasopharyngeal swab PCR: pending\n- Lymph node ultrasound: reveals hypoechoic core with surrounding edema`,
    owner_background: `Role: Horse owner (Catalina belongs to Elena, a young professional rider).\nTone: Initially anxious but appreciative when the vet explains things clearly.\nKey concerns: keeping the barn manager informed, cost of diagnostics, and how long Catalina must be isolated.`,
    history_feedback: `Focus feedback on exposure history, vaccination status, recent travel, and questions about other horses on the property. Praise organised questioning and highlight any missing outbreak-management items.`,
    owner_follow_up: `Owner wants clear justification for each diagnostic test (PCR, culture, ultrasound) and needs help explaining isolation requirements to the barn staff. She becomes more cooperative once she understands biosecurity implications.`,
    owner_follow_up_feedback: `Evaluate whether the student prioritised targeted infectious-disease diagnostics, explained biosecurity, and balanced cost with diagnostic value. Provide two action items for improvement.`,
    owner_diagnosis: `Catalina's nasopharyngeal PCR returns positive for Strep equi equi. Owner reactions: worry about the whole barn, desire for prognosis, frustration about prolonged isolation, and questions about monitoring.`,
    get_owner_prompt: `Stay in character as Catalina's owner. Share details only when asked and keep responses practical, focusing on management realities at a busy boarding yard.`,
    get_history_feedback_prompt: `Use a strengths-first format, then list the top three unanswered history domains related to infectious disease spread.`,
    get_physical_exam_prompt: `Provide only the vital sign or body-system finding requested. Encourage the student to be specific if they ask vague questions like "anything abnormal?"`,
    get_diagnostic_prompt: `Release one laboratory or imaging result at a time. If the student asks for non-existent tests, clarify that they have not been run.`,
    get_owner_follow_up_prompt: `Roleplay a concerned owner weighing the cost and practicality of diagnostics versus immediate treatment.`,
    get_owner_follow_up_feedback_prompt: `Judge how well the student justified diagnostics, discussed isolation logistics, and handled financial concerns.`,
    get_owner_diagnosis_prompt: `React as an owner processing a strangles diagnosis: relief to have answers, but anxious about spread and future competitions.`,
    get_overall_feedback_prompt: `Focus on whether the student:
  - Collected exposure history (recent arrivals, vaccination status, other horses affected) and signalment data.
  - Conducted or at least outlined a systematic physical exam for an equine infectious-disease case.
  - Proposed appropriate diagnostics (CBC, fibrinogen, PCR/culture, imaging) with rationale.
  - Addressed isolation/biosecurity instructions and client logistics.
  When any element is missing from the transcript, flag it explicitly as a deficiency.`,
  },
  {
    id: "case-2",
    slug: "canine-parvo-milo",
    title: "Milo the Labrador: Acute Hemorrhagic Diarrhea",
    description:
      "A 5-month-old Labrador retriever presents with profuse bloody diarrhea, vomiting, and rapid dehydration two days after visiting a busy dog park.",
    species: "Canine",
    condition: "Parvoviral enteritis",
    category: "Small Animal Internal Medicine",
    owner_avatar_key: "owner-olivia-nguyen",
    nurse_avatar_key: "nurse-grace-adebayo",
    difficulty: "Hard",
    estimated_time: 30,
    image_url: placeholderImage,
    details: {
      presenting_complaint:
        "Owner reports sudden onset of vomiting followed by watery, then bloody, diarrhea. Appetite zero; lethargic and unwilling to stand.",
      duration: "48 hours",
      vaccination_status:
        "Two puppy vaccines received; third booster overdue by 3 weeks",
      learning_objectives: [
        "Elicit exposure and vaccination history in young dogs",
        "Prioritise fluid therapy and isolation recommendations",
        "Communicate intensive care requirements empathetically",
      ],
    },
    physical_exam_findings: `Vital signs:\n- Temp: 39.6°C\n- HR: 180 bpm (weak pulses)\n- RR: 40 bpm\nOther findings:\n- Severe dehydration (~10%), tacky gums, CRT 3 sec\n- Abdominal pain on palpation, splenomegaly not appreciated\n- Melena present on rectal exam`,
    diagnostic_findings: `Laboratory data available on request:\n- SNAP Parvo antigen: Strong positive\n- CBC: WBC 1.2 x10^9/L (marked leukopenia), HCT 58% (hemoconcentration), platelets 110 x10^9/L\n- Electrolytes: Na 132 mmol/L, K 3.0 mmol/L, Cl 91 mmol/L\n- Blood glucose: 62 mg/dL\n- Abdominal ultrasound: Diffuse fluid-filled intestinal loops, no intussusception`,
    owner_background: `Role: Laura, first-time dog guardian. Works remotely and is deeply attached to Milo. Financially stretched but willing to use savings if prognosis justifies it.`,
    history_feedback: `Feedback should emphasise vaccination timelines, exposure to unvaccinated dogs, onset/progression of GI signs, and assessment of home hydration attempts.`,
    owner_follow_up: `Owner needs a clear explanation of hospitalisation plan (IV fluids, antiemetics, nutrition), isolation protocols, and daily cost estimates. She is anxious about prognosis but becomes decisive when given probabilities.`,
    owner_follow_up_feedback: `Assess whether the student prioritised point-of-care diagnostics, explained critical-care monitoring, and discussed zoonotic/biosecurity considerations for household members.`,
    owner_diagnosis: `Parvoviral enteritis confirmed. Owner reactions include guilt about the overdue vaccine, questions about survival rate, and logistics for isolation at home after discharge.`,
    get_owner_prompt: `Respond as Laura, a caring but overwhelmed dog owner. Give short answers, ask clarifying questions, and admit when you feel guilty or confused.`,
    get_history_feedback_prompt: `Highlight effective triage questioning, then list the top infectious-disease risk questions they missed.`,
    get_physical_exam_prompt: `Provide specific vitals or system findings only. Remind the student to clarify what parameter they want if the request is vague.`,
    get_diagnostic_prompt: `Share individual lab or imaging results as asked. Offer reference intervals when helpful.`,
    get_owner_follow_up_prompt: `Challenge the student (politely) to justify 24/7 care, discuss financial planning, and describe what will happen each day in hospital.`,
    get_owner_follow_up_feedback_prompt: `Score the student on triage communication, discussion of isolation, and how they framed prognosis.`,
    get_owner_diagnosis_prompt: `React to the confirmed parvo diagnosis. Ask about relapse risk, long-term GI issues, and protecting other dogs in the building.`,
    get_overall_feedback_prompt: `Focus on whether the student:
  - Investigated vaccination status, exposure risks, and home management in the history.
  - Performed or described a complete physical exam with emphasis on hydration and abdominal pain.
  - Prioritised appropriate diagnostics (SNAP parvo test, CBC, electrolytes, ultrasound) and explained the rationale and urgency.
  - Communicated isolation, intensive-care planning, prognosis, and cost discussions clearly to the owner.
  Call out any of these elements as deficiencies when missing from the transcript.`,
  },
  {
    id: "case-3",
    slug: "dairy-mastitis-rosie",
    title: "Rosie the Holstein: Recurrent Mastitis on a High-Output Dairy",
    description:
      "A high-producing Holstein cow develops her third bout of clinical mastitis this lactation, prompting concerns about contagious pathogens spreading through the parlor.",
    species: "Bovine",
    condition: "Contagious mastitis outbreak",
    category: "Food Animal Production Medicine",
    owner_avatar_key: "owner-james-hartley",
    nurse_avatar_key: "nurse-ethan-cooper",
    difficulty: "Medium",
    estimated_time: 28,
    image_url: placeholderImage,
    details: {
      presenting_complaint:
        "Foreman reports clots and watery milk from the right rear quarter plus a sudden drop in tank SCC after a new employee started the night shift.",
      duration: "Recurrent events over 6 weeks",
      herd_size: 600,
      learning_objectives: [
        "Link individual-cow findings to herd-level risk assessment",
        "Interpret milk culture/PCR data and somatic cell counts",
        "Coach producers through hygiene improvements without blame",
      ],
    },
    physical_exam_findings: `Focused udder exam:\n- Right rear quarter swollen, warm, mildly painful\n- Milk stripping: watery with flakes and streaks of blood\n- Supramammary lymph node enlarged\nSystemic exam:\n- Temp: 39.1°C, HR: 88 bpm, rumen motility WNL`,
    diagnostic_findings: `Available data:\n- Cow-side CMT: strong positive (+++) in RR quarter\n- Bulk-tank SCC trend: rising from 180k to 420k over 4 weeks\n- Milk culture: Staphylococcus aureus (beta-lactamase positive)\n- PCR panel: confirms Staph aureus, negative for Mycoplasma\n- Sensitivity: susceptible to ceftiofur, pirlimycin; resistant to penicillin`,
    owner_background: `Role: Daniel, herd manager for a family-owned dairy. Pragmatic, focuses on throughput, and worries about withholding milk. Balances animal welfare with tight margins.`,
    history_feedback: `Encourage systematic questioning about milking routines, post-dip contact time, liner maintenance, and culling strategy. Note any missed opportunities to explore staff training or cow comfort.`,
    owner_follow_up: `Producer wants to know which cows to culture, how to segregate infected animals, and whether equipment or staff habits are to blame. Needs costs framed per hundredweight of milk to sell the plan to ownership.`,
    owner_follow_up_feedback: `Assess how well the student linked diagnostics to economic impact, introduced hygiene upgrades without blame, and prioritised short-term control versus long-term prevention.`,
    owner_diagnosis: `Staph aureus mastitis confirmed. Producer responses: frustration about chronic infections, questions about extended therapy vs. culling, and concern over co-op penalties if SCC climbs further.`,
    get_owner_prompt: `Speak as Daniel. Use practical farm language, cite production numbers, and push for actionable recommendations.`,
    get_history_feedback_prompt: `Applaud efficient information gathering, then critique any missed questions about milking order, parlor maintenance, and treatment protocols.`,
    get_physical_exam_prompt: `Provide detailed quarter-specific findings when asked. If the student wants "general impressions," prompt them to break it into specific questions.`,
    get_diagnostic_prompt: `Share individual lab results (culture, PCR, SCC) and reference how they influence control strategies.`,
    get_owner_follow_up_prompt: `Roleplay a producer balancing cost, milk quality premiums, and labour limits. Ask for concrete timelines and ROI on recommended changes.`,
    get_owner_follow_up_feedback_prompt: `Comment on the student's ability to tie diagnostics to management changes and to present numbers that resonate with producers.`,
    get_owner_diagnosis_prompt: `React to the confirmed Staph aureus diagnosis: weigh culling vs. extended therapy and ask about protecting the rest of the herd.`,
    get_overall_feedback_prompt: `Focus on whether the student:
  - Explored herd management risk factors (milking routines, hygiene, staff practices, equipment maintenance).
  - Conducted or described a systematic udder/quarter exam and interpreted findings in a herd context.
  - Recommended appropriate diagnostics (culture, PCR, SCC trending) with economic justification.
  - Delivered practical, numbers-backed advice on segregation, treatment vs. culling, and prevention while maintaining producer rapport.
  Highlight any missing components directly as performance gaps.`,
  },
];
