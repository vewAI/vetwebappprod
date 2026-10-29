import { Suspense } from "react";
import CaseSessionsClient from "./CaseSessionsClient";

export default function CaseSessionsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8 text-muted-foreground">
          Loading sessions…
        </div>
      }
    >
      <CaseSessionsClient />
    </Suspense>
  );
}
