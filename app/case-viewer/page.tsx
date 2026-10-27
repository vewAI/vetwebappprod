import { Suspense } from "react";
import CaseViewerClient from "./CaseViewerClient";

export default function CaseViewerPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading case...</div>}>
      <CaseViewerClient />
    </Suspense>
  );
}
