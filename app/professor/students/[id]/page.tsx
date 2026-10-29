"use client";

import { useParams } from "next/navigation";
import { ProfessorStudentDetail } from "@/features/professor/components/ProfessorStudentDetail";

export default function ProfessorStudentPage() {
  const params = useParams();
  const studentId = typeof params.id === "string" ? params.id : "";
  return <ProfessorStudentDetail studentId={studentId} />;
}
