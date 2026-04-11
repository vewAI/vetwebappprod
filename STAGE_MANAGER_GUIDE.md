# Stage Manager — Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [How the Stage Manager Works](#how-the-stage-manager-works)
3. [Stage Types Reference](#stage-types-reference)
4. [Stage 1: History Taking — Field-by-Field Guide](#stage-1-history-taking--field-by-field-guide)
5. [How AI Prompts Are Built](#how-ai-prompts-are-built)
6. [How to Modify AI Behaviour](#how-to-modify-ai-behaviour)
7. [Stage Completion Logic](#stage-completion-logic)
8. [All Stages Quick Reference Map](#all-stages-quick-reference-map)

---

## Overview

The Stage Manager controls the sequential flow of a veterinary case. Each case is divided into **stages** (e.g., History Taking, Physical Exam, Diagnostic Planning). Each stage configures:

- **Who the student talks to** (Owner, Nurse, Lab Technician)
- **What the AI persona does** (interaction script)
- **How the student is evaluated** (feedback rubric)
- **When the stage ends** (minimum messages, completion rules)

---

## How the Stage Manager Works

### Stage Controls (Top Bar)

| Control | What It Does |
|---------|-------------|
| **Up / Down** | Changes the order of this stage in the sequence. Stages execute top-to-bottom. |
| **Delete** | Removes this stage from the case flow entirely. |
| **Stage type** dropdown | Selects a template that pre-fills all fields with default values for that stage type. Changing this overwrites current field values. |
| **Active** toggle | When OFF, this stage is skipped during the case. The student never sees it. Use this to disable stages without deleting them. |

### The Data Flow

```
Stage Configuration (Admin UI)
        ↓
Saved to database (case_stages table)
        ↓
Loaded at runtime when student starts case
        ↓
AI persona selected → Interaction script loaded → Chat begins
        ↓
Student exchanges messages → Completion rules checked
        ↓
Transition message → Next stage begins
```

---

## Stage Types Reference

The system has **7 built-in stage types**. Selecting a type pre-fills all fields:

| Stage Type | Default Title | Who Answers | Interaction Script Key | Feedback Rubric Key |
|-----------|--------------|-------------|----------------------|-------------------|
| **History** | History Taking | Client (Horse Owner) | `getOwnerPrompt` | `getHistoryFeedbackPrompt` |
| **Physical Exam** | Physical Examination | Veterinary Nurse | `getPhysicalExamPrompt` | `getPhysicalExamFeedbackPrompt` |
| **Diagnostic Plan** | Diagnostic Planning | Client (Horse Owner) | `getOwnerFollowUpPrompt` | `getOwnerFollowUpFeedbackPrompt` |
| **Lab & Imaging** | Laboratory & Tests | Laboratory Technician | `getDiagnosticPrompt` | *(none)* |
| **Treatment** | Treatment Plan | Veterinary Nurse | `getTreatmentPlanPrompt` | *(none)* |
| **Client Communication** | Client Communication | Client (Horse Owner) | `getOwnerDiagnosisPrompt` | *(none)* |
| **Custom** | Custom Stage | Client (Owner) | *(none — you choose)* | *(none — you choose)* |

---

## Stage 1: History Taking — Field-by-Field Guide

Below is every field in the Stage Editor for Stage 1 (History Taking), with full details on what it does, where its content goes, and how it affects AI behaviour.

---

### 1. Stage Type (dropdown)

| | |
|---|---|
| **Field** | Stage type |
| **Default for History** | `History` |
| **What it does** | Selects a template that auto-fills all other fields with sensible defaults for this stage type. |
| **How to use it** | Pick "History" for a standard history-taking stage. The system will set Who Answers = Client/Owner, Interaction Script = History interview script, Feedback Rubric = History feedback rubric. |
| **Where it acts** | This is a meta-control — it sets the defaults for all fields below it. It does NOT directly affect runtime behaviour after saving. The individual field values control runtime. |
| **Warning** | Changing stage type overwrites all fields. Do this first before customizing. |

---

### 2. Title

| | |
|---|---|
| **Field** | Title |
| **Default** | `History Taking` |
| **What it does** | The display name of this stage. Shown to the student in the progress bar, stage headers, and transition messages. |
| **Example** | `History Taking`, `Initial Consultation`, `Triage History` |
| **Where it acts** | **Runtime:** The title is used to detect the stage type at runtime via keyword matching. If the title contains "history", the system applies history-specific completion rules. If it contains "physical", physical-exam rules apply, etc. The title also appears in transition messages between stages (e.g., "Moving on to Physical Examination..."). |
| **AI impact** | INDIRECT — the title influences stage detection, which determines which persona guardrails and completion rules activate. |

---

### 3. Description / "What should the student accomplish in this stage?"

| | |
|---|---|
| **Field** | What should the student accomplish in this stage? |
| **Default** | `Start the clinical interview and gather all the information you can about the case.` |
| **What it does** | A learner-facing goal statement. This text is shown to the student as the objective for this stage. |
| **Example** | `Start the clinical interview and gather all the information you can about the case.` |
| **Where it acts** | **Student UI:** Displayed as the stage objective/goal text when the student is in this stage. Helps the student understand what they need to do. |
| **AI impact** | NONE — This is informational for the student. The AI does not read this field. |

---

### 4. Who Answers in This Stage (dropdown)

| | |
|---|---|
| **Field** | Who answers in this stage |
| **Default** | `Client / Owner` |
| **Options** | `Client / Owner` → maps to `owner` persona role · `Veterinary Nurse` → maps to `veterinary-nurse` persona role |
| **What it does** | Determines which AI persona the student chats with during this stage. This is the MOST important control — it selects the entire personality, knowledge base, and behavioural rules for the AI. |
| **Where it acts** | **Runtime — Persona Selection:** When set to "Client / Owner", the system loads the Owner persona (configured in Owner Persona + Owner Personality & Context fields). The AI will speak as the animal's owner — concerned, non-technical, emotionally invested. When set to "Veterinary Nurse", the system loads the Nurse persona. The AI speaks as a veterinary professional who reads back clinical findings. |
| **AI impact** | CRITICAL — This determines: |
| | 1. **Which persona identity is loaded** (name, voice, avatar, gender) |
| | 2. **Which base behavioural rules apply** (Owner rules: speak in plain language, 1-3 sentences, don't provide technical interpretation. Nurse rules: only release findings when asked, selective reporting, no premature diagnosis) |
| | 3. **Which persona guardrails activate** (prevents persona from revealing information that belongs to a different stage) |
| **Prompt source** | The persona identity comes from: `owner_persona_config` (for Owner) or `nurse_persona_config` (for Nurse). The behavioural base rules come from hardcoded system prompts that differ by role. |

---

### 5. Displayed Role Name

| | |
|---|---|
| **Field** | Displayed role name |
| **Default** | `Client (Horse Owner)` |
| **What it does** | The name shown next to the AI's chat messages. This is what the student sees as the speaker label. |
| **Example** | `Client (Horse Owner)`, `Maria (Dog Owner)`, `Producer (Dairy Farmer)`, `Veterinary Nurse`, `Laboratory Technician` |
| **Where it acts** | **Student UI:** Appears as the sender name on every AI message in the chat. Also used in transition messages (e.g., "You're now talking to Client (Horse Owner) about..."). |
| **AI impact** | INDIRECT — Used in persona resolution at runtime. The system checks this label to determine persona guardrails and available information. If it contains "owner" or "client", owner-specific rules apply. If it contains "nurse" or "technician", nurse-specific rules apply. |

---

### 6. Interaction Script

| | |
|---|---|
| **Field** | Interaction script (labelled "History interview script" for History stages) |
| **Default label** | `History interview script` |
| **Maps to case field** | `get_owner_prompt` (Owner AI Behaviour) |
| **What it does** | This is the **master system prompt** that tells the AI how to role-play the character during this stage. It defines the AI's personality, what it knows, what it reveals, and how it responds. This is the brain of the AI for this stage. |
| **Where it acts** | **Runtime — System Prompt:** The content of the linked case field is injected as the primary system message at the top of the chat context. Every AI response in this stage is governed by these instructions. |
| **AI impact** | CRITICAL — This is the #1 way to control AI behaviour. The interaction script contains: |
| | 1. **Role definition** ("You are roleplaying as the owner...") |
| | 2. **Knowledge boundaries** (what the owner knows vs. doesn't know) |
| | 3. **Behavioural rules** (how the owner responds, tone, length) |
| | 4. **Information release strategy** (what to volunteer vs. what to withhold until asked) |
| **Prompt source** | AUTO-GENERATED from the `owner_background` field (Owner Personality & Context). The system takes your Owner Personality & Context text and wraps it in a structured prompt template. |
| **Template tokens used** | `{{PRESENTING_COMPLAINT}}` ← from case title/condition, `{{OWNER_BACKGROUND}}` ← from `owner_background` field, `{{STUDENT_QUESTION}}` ← the student's latest message |
| **How to modify** | You can edit AI behaviour in 3 ways: |
| | 1. **Edit `owner_background`** (Owner Personality & Context) → then re-generate the prompt. Best for content changes. |
| | 2. **Edit `get_owner_prompt`** (Owner AI Behaviour) directly → full control over the system prompt. Best for behavioural tweaks. |
| | 3. **Use "Internal stage guidance"** (field #8 below) → adds extra instructions on top of the interaction script. Best for stage-specific overrides. |

#### How the Interaction Script Is Built (auto-generation)

The system generates `get_owner_prompt` from your case data using this template structure:

```
You are roleplaying as the owner or caretaker in a veterinary consultation.

CASE CONTEXT:
- Presenting complaint: {{PRESENTING_COMPLAINT}}
- Patient: {{ANIMAL_NAME}}, {{SPECIES}}, {{AGE}}, {{SEX}}

OWNER PERSONALITY & BACKGROUND:
{{OWNER_BACKGROUND}}

BEHAVIOUR RULES:
- Speak as a concerned animal owner in plain, non-technical language
- Keep replies concise (1-3 sentences)
- Share information ONLY when the student specifically asks
- Do NOT volunteer diagnoses, technical terms, or clinical interpretations
- React emotionally appropriate to the situation
- If you don't know something, say so honestly
```

The `{{OWNER_BACKGROUND}}` token is replaced with whatever you wrote in the **Owner Personality & Context** field. This is why that field is so important — it directly shapes the AI's character.

---

### 7. Feedback Rubric

| | |
|---|---|
| **Field** | Feedback rubric (labelled "History feedback rubric" for History stages) |
| **Default label** | `History feedback rubric` |
| **Maps to case field** | `get_history_feedback_prompt` (History Feedback AI Rules) |
| **What it does** | Defines the evaluation criteria for grading the student's performance in this stage. When feedback is triggered, the AI uses this rubric to assess what the student did well and what they missed. |
| **Where it acts** | **Feedback Generation:** When the stage completes (or the student requests feedback), the system sends the chat transcript along with this rubric to a feedback AI. The rubric tells the AI what "good" looks like for this specific case. |
| **AI impact** | HIGH — Controls the quality and relevance of feedback. A well-written rubric produces targeted, actionable feedback. A vague rubric produces generic feedback. |
| **Prompt source** | AUTO-GENERATED from the `history_feedback` field (History-Taking Rubric). |
| **How the feedback prompt is structured** | |
| | ```
You are an experienced veterinary educator reviewing the learner's
history-taking performance.

SCENARIO: {{CASE_TITLE}}
RUBRIC CRITERIA:
{{HISTORY_FEEDBACK_CONTENT}}

INSTRUCTIONS:
- Begin with specific strengths
- List the top unanswered questions the student should have asked
- Rate coverage of key domains (onset, diet, vaccinations, exposure, etc.)
- Provide constructive coaching points
``` |
| **How to modify** | Edit the `history_feedback` field (History-Taking Rubric) in the case form → then re-generate. Or edit `get_history_feedback_prompt` directly for fine control. |

---

### 8. Internal Stage Guidance (optional)

| | |
|---|---|
| **Field** | Internal stage guidance (optional) |
| **Default** | *(empty)* |
| **What it does** | Extra instructions injected INTO the AI's system prompt for THIS stage only. Think of it as a stage-specific override or addition to the interaction script. |
| **Where it acts** | **Runtime — System Prompt Injection:** If this field has content, it is added as additional system instructions on top of the interaction script. The AI treats these as binding rules for this stage. |
| **AI impact** | HIGH (when used) — This is the best way to add stage-specific behavioural tweaks without modifying the main interaction script. |
| **When to use it** | - "In this stage, the owner should be especially anxious about costs" |
| | - "Do not reveal the vaccination status unless specifically asked about vaccinations" |
| | - "If the student asks about other animals on the property, mention the second horse showing mild symptoms" |
| **How it differs from the Interaction Script** | The Interaction Script (`get_owner_prompt`) applies globally to ALL stages where the Owner answers. The Internal Stage Guidance applies ONLY to this specific stage. If the Owner appears in Stage 1 and Stage 3, the Internal Guidance for Stage 1 won't affect Stage 3. |

---

### 9. Message Shown When Transitioning to the Next Stage (optional)

| | |
|---|---|
| **Field** | Message shown when transitioning to the next stage (optional) |
| **Default** | *(empty — system generates a default transition)* |
| **What it does** | A custom message displayed to the student when this stage ends and the next stage begins. |
| **Where it acts** | **Runtime — Transition:** When the stage completes and the system moves to the next stage, this message appears as an assistant message in the chat. |
| **Default behaviour (when empty)** | The system auto-generates a transition message based on the next stage's role: |
| | - If next stage has an Owner: "Good news! [Stage Title] is complete. You're now talking to [Role Name] about [Next Stage Title]." |
| | - If next stage has a Nurse/Technician: "Moving on to [Next Stage Title]. I'm now [Role Name]." |
| **Example custom message** | "Excellent history taking! Now let's move to the physical examination. The veterinary nurse will assist you with the exam findings." |
| **AI impact** | NONE — This is a static message shown to the student. It is not part of the AI prompt chain. |

---

### 10. Minimum Student Messages Before Completion

| | |
|---|---|
| **Field** | Minimum student messages before completion |
| **Default** | `0` |
| **What it does** | Sets the minimum number of messages the student must send before this stage can be marked as complete. The student cannot advance to the next stage until this threshold is met. |
| **Where it acts** | **Runtime — Stage Completion Gate:** The system counts the student's messages in this stage. If set to 3, the student must send at least 3 messages before the "advance to next stage" option becomes available. |
| **Recommended values** | History Taking: `3-5` (ensures the student asks enough questions) · Physical Exam: `1-2` · Other stages: `1-3` |
| **Note** | Setting to 0 means the student can theoretically skip the stage immediately. This is not recommended for History stages. |

---

### 11. Minimum Assistant Replies Before Completion

| | |
|---|---|
| **Field** | Minimum assistant replies before completion |
| **Default** | `0` |
| **What it does** | Sets the minimum number of AI responses before this stage can be marked as complete. Ensures the AI has had enough turns to provide key information. |
| **Where it acts** | **Runtime — Stage Completion Gate:** The system counts the AI's messages in this stage. Both minimums (student AND assistant) must be met before the stage can advance. |
| **Recommended values** | History Taking: `3-5` (ensures the AI has delivered enough information) · Physical Exam: `1` · Other stages: `1-2` |

---

### 12. Active (toggle)

| | |
|---|---|
| **Field** | Active |
| **Default** | ON |
| **What it does** | When OFF, this stage is completely skipped during the case. The student never sees it and it doesn't appear in the progress bar. |
| **When to use it** | Disable stages you're still working on, or stages that aren't relevant for a particular case version. |

---

## How AI Prompts Are Built

Understanding the prompt assembly chain is key to controlling AI behaviour. Here's the exact order in which prompts are assembled for each chat message:

### System Prompt Assembly Order (highest priority at top)

```
1. MEDIA INSTRUCTIONS
   └─ "AUTO-SHOW" or "ON-DEMAND" based on findings_release_strategy

2. TIMEPOINT CONTEXT (if time-based cases)
   └─ Current timepoint in the case timeline

3. PERSONA IDENTITY
   └─ From owner_persona_config or nurse_persona_config
   └─ Name, gender, voice, appearance description

4. INTERACTION SCRIPT (the big one)
   └─ From get_owner_prompt (History/Diagnostic/Communication stages)
   └─ OR get_physical_exam_prompt (Physical Exam stages)
   └─ OR get_diagnostic_prompt (Lab & Imaging stages)
   └─ Contains: role definition + knowledge + behavioural rules
   └─ Built from: owner_background → auto-generated template

5. OWNER BACKGROUND (if owner persona)
   └─ From owner_background field
   └─ Additional personality/context injection

6. INTERNAL STAGE GUIDANCE (if provided)
   └─ From stage_prompt field
   └─ Stage-specific override instructions

7. RAG CONTEXT (if available)
   └─ Retrieval-augmented generation from indexed documents
   └─ Filtered by persona type (owner vs nurse knowledge)

8. CHAT SYSTEM GUIDELINES
   └─ Global rules (safety, boundaries, formatting)
```

### What Each Prompt Layer Controls

| Layer | Controls | Modified By |
|-------|----------|------------|
| Persona Identity | Who the AI claims to be (name, voice, tone) | `owner_persona_config` / `nurse_persona_config` |
| Interaction Script | How the AI behaves, what it knows, what it reveals | `owner_background` → auto-generates `get_owner_prompt` |
| Owner Background | Extra personality details, financial situation, concerns | `owner_background` field directly |
| Internal Stage Guidance | Stage-specific behavioural overrides | Stage Editor → "Internal stage guidance" field |
| Findings Release | When/how findings are shown | `findings_release_strategy` field |

---

## How to Modify AI Behaviour

### Method 1: Edit the Source Fields (Recommended for Content Changes)

Edit these case fields to change what the AI knows and how it acts:

| Case Field | Affects | When to Edit |
|-----------|---------|-------------|
| `owner_background` (Owner Personality & Context) | Owner AI's personality, knowledge, communication style, financial situation, emotional state | You want to change WHO the owner is or HOW they talk |
| `history_feedback` (History-Taking Rubric) | What the feedback AI considers "good" history-taking for this case | You want to change how the student is evaluated |
| `physical_exam_findings` (Physical Exam Findings) | What the Nurse AI reads back during exam | You want to change exam data the student receives |
| `owner_follow_up` (Owner Post-Exam Questions) | What the Owner asks after the exam | You want to change the Owner's post-exam talking points |
| `owner_diagnosis` (Owner Diagnosis Reaction) | How the Owner reacts to the diagnosis | You want to change the Owner's emotional response |

After editing these fields, click **"Generate"** or **"Auto-fill"** in the case editor to regenerate the auto-generated prompts.

### Method 2: Edit Auto-Generated Prompts Directly (Recommended for Behavioural Tweaks)

Edit these case fields to directly modify the AI's system prompt:

| Case Field | Affects | When to Edit |
|-----------|---------|-------------|
| `get_owner_prompt` (Owner AI Behaviour) | The complete system prompt for the Owner AI | You want precise control over how the Owner behaves |
| `get_history_feedback_prompt` (History Feedback AI Rules) | The complete feedback evaluation prompt | You want to change how feedback is structured |
| `get_physical_exam_prompt` (Nurse AI Behaviour) | The complete system prompt for the Nurse AI | You want to change how the Nurse reveals findings |
| `get_diagnostic_prompt` (Lab Technician AI Behaviour) | The complete system prompt for the Lab AI | You want to change how lab results are delivered |
| `get_owner_follow_up_prompt` (Owner Follow-Up AI Behaviour) | The Owner's post-exam AI prompt | You want to change diagnostic planning conversation |
| `get_owner_diagnosis_prompt` (Owner Diagnosis AI Behaviour) | The Owner's diagnosis reaction prompt | You want to change diagnosis delivery behaviour |
| `get_overall_feedback_prompt` (Final Case Summary AI Rules) | The final performance summary prompt | You want to change overall evaluation criteria |

**Warning:** If you edit these directly and then click "Generate", your manual edits will be overwritten. Edit these ONLY if you don't plan to re-auto-generate.

### Method 3: Use Internal Stage Guidance (Recommended for Stage-Specific Tweaks)

In the Stage Editor, use the **"Internal stage guidance"** field to add instructions that apply ONLY to this stage. This is additive — it supplements the interaction script without replacing it.

**Examples of effective guidance:**
- `"The owner is particularly worried about the cost of treatment. If the student doesn't address costs, the owner should bring it up after 3-4 exchanges."`
- `"Do not mention the other horse on the property unless the student specifically asks about other animals."`
- `"If the student uses medical jargon, respond with confusion. The owner should not understand terms like 'pyrexia' or 'leukocytosis'."`
- `"The owner has already tried giving aspirin before calling the vet. Mention this only if asked about prior treatments."`

---

## Stage Completion Logic

A stage completes when ALL of these conditions are met:

1. **Minimum student messages** ≥ configured threshold
2. **Minimum assistant replies** ≥ configured threshold
3. **Student triggers advancement** by either:
   - Clicking a "Next Stage" button (if available)
   - Using natural language ("I'm done with the history", "Let's move to the exam", "Ready for the next stage")
   - The system detects stage-advancement intent via keyword analysis

### Intent Detection Keywords

The system recognizes these advancement signals:

| Category | Examples |
|----------|---------|
| Direction verbs | "proceed", "advance", "continue", "move on", "next" |
| Stage references | "stage 2", "next section", "physical exam now" |
| Completion cues | "I'm done", "that's all I need", "I have enough information" |
| Polite triggers | "ready for the next part", "let's continue please" |

---

## All Stages Quick Reference Map

| # | Stage Type | Title | Who Answers | Persona Role | Interaction Script Key | Source Case Field | Feedback Rubric Key | Source Case Field |
|---|-----------|-------|-------------|-------------|----------------------|-------------------|-------------------|-------------------|
| 1 | History | History Taking | Client / Owner | `owner` | `getOwnerPrompt` | `owner_background` → `get_owner_prompt` | `getHistoryFeedbackPrompt` | `history_feedback` → `get_history_feedback_prompt` |
| 2 | Physical Exam | Physical Examination | Veterinary Nurse | `veterinary-nurse` | `getPhysicalExamPrompt` | `physical_exam_findings` → `get_physical_exam_prompt` | `getPhysicalExamFeedbackPrompt` | *(auto from exam data)* |
| 3 | Diagnostic Plan | Diagnostic Planning | Client / Owner | `owner` | `getOwnerFollowUpPrompt` | `owner_follow_up` → `get_owner_follow_up_prompt` | `getOwnerFollowUpFeedbackPrompt` | `owner_follow_up_feedback` → `get_owner_follow_up_feedback_prompt` |
| 4 | Lab & Imaging | Laboratory & Tests | Lab Technician | `veterinary-nurse` | `getDiagnosticPrompt` | `diagnostic_findings` → `get_diagnostic_prompt` | *(none)* | — |
| 5 | Treatment | Treatment Plan | Veterinary Nurse | `veterinary-nurse` | `getTreatmentPlanPrompt` | *(auto from case data)* | *(none)* | — |
| 6 | Client Communication | Client Communication | Client / Owner | `owner` | `getOwnerDiagnosisPrompt` | `owner_diagnosis` → `get_owner_diagnosis_prompt` | *(none)* | — |
| 7 | Custom | *(your title)* | *(your choice)* | *(your choice)* | *(your choice)* | *(your choice)* | *(your choice)* | *(your choice)* |

---

## Quick FAQ

**Q: If I change the Owner Personality & Context field, does it immediately change the AI's behaviour?**
A: Not automatically. You need to re-generate the `get_owner_prompt` (Owner AI Behaviour) field. The system auto-generates it from your Owner Personality & Context text.

**Q: Can I have different Owner behaviour in different stages?**
A: Yes. Use the "Internal stage guidance" field to add stage-specific rules. The base behaviour comes from `get_owner_prompt`, but the internal guidance adds extra rules for that stage only.

**Q: What happens if I leave "Interaction script" empty?**
A: The system falls back to a generic persona prompt. The AI will still speak as the selected role (Owner/Nurse) but won't have case-specific knowledge or personality. This usually produces poor results.

**Q: What's the difference between "Interaction script" and "Feedback rubric"?**
A: The Interaction Script controls how the AI behaves DURING the stage (how it role-plays). The Feedback Rubric controls how the student is EVALUATED after the stage (what counts as good performance). They are separate AI prompts for separate purposes.

**Q: Can I edit the auto-generated prompt fields directly?**
A: Yes, but be aware that clicking "Generate" again will overwrite your manual edits. Direct edits are best for fine-tuning after the auto-generation is done.
