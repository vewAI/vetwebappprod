import assert from "assert";
import React from "react";
import { VoiceModeControl } from "../components/VoiceModeControl";

test("VoiceModeControl renders and toggles and exposes status", () => {
  let toggled = false;
  const onToggle = () => { toggled = !toggled; };
  const el = VoiceModeControl({ voiceMode: false, isListening: false, isSpeaking: false, onToggle, disabled: false } as any);
  assert.ok(el);
  // root element should carry our test id
  assert.equal((el as any).props["data-testid"], "voice-mode-control");

  const btn = (el as any).props.children[0];
  assert.equal(btn.props["aria-pressed"], false);
  // invoke the click handler to toggle
  btn.props.onClick();
  assert.equal(toggled, true);

  // When rendering with listening state, status text should reflect it
  const el2 = VoiceModeControl({ voiceMode: true, isListening: true, isSpeaking: false, onToggle: () => {}, disabled: false } as any);
  const statusSr = el2.props.children[1]; // sr-only status
  assert.ok(String(statusSr.props.children).includes("Listening"));
});
