"use client";

import React from "react";
import { useParams } from "next/navigation";
import { StudentSessionDetail } from "@/features/case-sessions/components/StudentSessionDetail";

export default function CaseSessionDetailPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  return (
    <div className="container mx-auto px-4 pb-8">
      <StudentSessionDetail sessionId={sessionId} />
    </div>
  );
}
