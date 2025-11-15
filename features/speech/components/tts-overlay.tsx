"use client";

import React from "react";
import dynamic from "next/dynamic";

import { TtsAnalyserProvider } from "@/features/speech/hooks/useTtsAnalyser";
import { AvatarPresenceProvider } from "@/features/avatar/context/avatar-presence";

const TalkingAvatar = dynamic(() => import("./talking-avatar"), {
  ssr: false,
});

export default function TtsOverlay() {
  return (
    <AvatarPresenceProvider>
      <TtsAnalyserProvider>
        <TalkingAvatar />
      </TtsAnalyserProvider>
    </AvatarPresenceProvider>
  );
}
