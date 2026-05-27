import { Suspense } from "react";
import NewSessionClient from "./NewSessionClient";

export default function ProfessorNewSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">Loading…</div>
      }
    >
      <NewSessionClient />
    </Suspense>
  );
}
