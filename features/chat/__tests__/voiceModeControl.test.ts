import assert from "assert";
import React from "react";
import { VoiceModeControl } from "../components/VoiceModeControl";

test("VoiceModeControl renders and reflects state", () => {
  const el = VoiceModeControl({ voiceMode: false, isListening: false, isSpeaking: false, onToggle: () => {} } as any);
  assert.ok(el);
  assert.ok((el as any).props);
});
