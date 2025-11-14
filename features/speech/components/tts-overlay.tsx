"use client";

import React from "react";
import { TtsAnalyserProvider } from "@/features/speech/hooks/useTtsAnalyser";
import dynamic from "next/dynamic";

const TalkingAvatar = dynamic(() => import("./talking-avatar"), {
  ssr: false,
});

export default function TtsOverlay() {
  return (
    <TtsAnalyserProvider>
      <TalkingAvatar />
    </TtsAnalyserProvider>
  );
}
