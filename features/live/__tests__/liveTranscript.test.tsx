import { describe, expect, it } from "vitest";
import { filterTranscriptMessages } from "../components/live-transcript";
import type { Message } from "@/features/chat/models/chat";
import type { Stage } from "@/features/stages/types";

describe("LiveTranscript Persona Filtering", () => {
  const stages: Stage[] = [
    {
      id: "stage-0",
      title: "History Taking",
      role: "Client (Horse Owner)",
      settings: { stage_type: "history" },
      personaRoleKey: "owner",
    },
    {
      id: "stage-1",
      title: "Physical Examination",
      role: "Veterinary Nurse",
      settings: { stage_type: "physical" },
      personaRoleKey: "veterinary-nurse",
    },
  ];

  const messages: Message[] = [
    {
      id: "msg-1",
      role: "user",
      content: "Hello Amanda, when did Cerveso become reluctant to move?",
      stageIndex: 0,
      personaRoleKey: "owner",
      timestamp: "2026-11-01T10:00:00Z",
    },
    {
      id: "msg-2",
      role: "assistant",
      content: "It started about 2 hours after our hack this morning.",
      stageIndex: 0,
      personaRoleKey: "owner",
      displayRole: "Amanda",
      timestamp: "2026-11-01T10:00:05Z",
    },
    {
      id: "msg-3",
      role: "user",
      content: "Could you check the digital pulses please?",
      stageIndex: 1,
      personaRoleKey: "veterinary-nurse",
      timestamp: "2026-11-01T10:05:00Z",
    },
    {
      id: "msg-4",
      role: "assistant",
      content: "Recorded.",
      stageIndex: 1,
      personaRoleKey: "veterinary-nurse",
      displayRole: "Nurse Sarah",
      timestamp: "2026-11-01T10:05:03Z",
    },
    {
      id: "msg-5",
      role: "assistant",
      content: "[SYS_TRIGGER] Stage transition",
      stageIndex: 1,
      personaRoleKey: "veterinary-nurse",
      timestamp: "2026-11-01T10:05:04Z",
    },
  ];

  it("filters transcript to show only owner conversation when filterPersona is 'owner'", () => {
    const filtered = filterTranscriptMessages(messages, "owner", stages);
    const contents = filtered.map((m) => m.content);

    expect(contents).toContain("Hello Amanda, when did Cerveso become reluctant to move?");
    expect(contents).toContain("It started about 2 hours after our hack this morning.");
    expect(contents).not.toContain("Could you check the digital pulses please?");
    expect(contents).not.toContain("Recorded.");
    expect(contents).not.toContain("[SYS_TRIGGER] Stage transition");
  });

  it("filters transcript to show only nurse conversation when filterPersona is 'veterinary-nurse'", () => {
    const filtered = filterTranscriptMessages(messages, "veterinary-nurse", stages);
    const contents = filtered.map((m) => m.content);

    expect(contents).toContain("Could you check the digital pulses please?");
    expect(contents).toContain("Recorded.");
    expect(contents).not.toContain("Hello Amanda, when did Cerveso become reluctant to move?");
    expect(contents).not.toContain("It started about 2 hours after our hack this morning.");
    expect(contents).not.toContain("[SYS_TRIGGER] Stage transition");
  });

  it("shows all visible messages when filterPersona is not provided, stripping hidden entries", () => {
    const filtered = filterTranscriptMessages(messages, null, stages);
    const contents = filtered.map((m) => m.content);

    expect(contents).toContain("Hello Amanda, when did Cerveso become reluctant to move?");
    expect(contents).toContain("It started about 2 hours after our hack this morning.");
    expect(contents).toContain("Could you check the digital pulses please?");
    expect(contents).toContain("Recorded.");
    expect(contents).not.toContain("[SYS_TRIGGER] Stage transition");
  });

  it("falls back to stageIndex when legacy messages lack personaRoleKey", () => {
    const legacyMessages: Message[] = [
      {
        id: "leg-1",
        role: "user",
        content: "Legacy question to owner",
        stageIndex: 0,
        timestamp: "2026-11-01T09:00:00Z",
      },
      {
        id: "leg-2",
        role: "assistant",
        content: "Legacy reply from nurse",
        stageIndex: 1,
        timestamp: "2026-11-01T09:05:00Z",
      },
    ];

    const ownerFiltered = filterTranscriptMessages(legacyMessages, "owner", stages);
    expect(ownerFiltered.map((m) => m.content)).toEqual(["Legacy question to owner"]);

    const nurseFiltered = filterTranscriptMessages(legacyMessages, "veterinary-nurse", stages);
    expect(nurseFiltered.map((m) => m.content)).toEqual(["Legacy reply from nurse"]);
  });
});
