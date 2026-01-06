"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { AdminTour } from "@/components/admin/AdminTour";
import { HelpTip } from "@/components/ui/help-tip";
import { DebugToggle } from "@/components/admin/DebugToggle";

export default function AdminPage() {
  const router = useRouter();
  const [llmOpen, setLlmOpen] = React.useState(false);
  const LLMProviderManager = dynamic(() => import("@/features/admin/components/LLMProviderManager"), { ssr: false });
  // Start with a stable value for server rendering to avoid hydration mismatch.
  // Read/write to localStorage only after mount.
  const [debug, setDebug] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Initialize from localStorage on client only
    try {
      const stored = window.localStorage.getItem("debugOverlay");
      const initial = stored === "true";
      setDebug(initial);
      // Dispatch initial toggle so listeners receive correct state
      window.dispatchEvent(new CustomEvent("debugOverlayToggle", { detail: initial }));
    } catch (e) {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    // Persist changes to localStorage on client
    try {
      window.localStorage.setItem("debugOverlay", debug ? "true" : "false");
      window.dispatchEvent(new CustomEvent("debugOverlayToggle", { detail: debug }));
    } catch (e) {
      // ignore
    }
  }, [debug]);

  const tourSteps = [
    { element: '#admin-title', popover: { title: 'Admin Dashboard', description: 'Welcome to the central hub for managing the application.' } },
    { element: '#btn-new-case', popover: { title: 'Create Cases', description: 'Start here to input new clinical cases into the system.' } },
    { element: '#btn-review-cases', popover: { title: 'Edit Cases', description: 'View, edit, or delete existing cases.' } },
    { element: '#btn-personas', popover: { title: 'Persona Management', description: 'Configure the AI personalities (owners, nurses) for each case.' } },
    { element: '#btn-users', popover: { title: 'User Management', description: 'Manage student and faculty accounts and permissions.' } },
  ];

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 id="admin-title" className="text-2xl font-bold">Admin Panel</h1>
          <HelpTip content="This is the main dashboard where you can access all administrative tools." />
        </div>
        <AdminTour steps={tourSteps} tourId="admin-dashboard" />
      </div>
      <DebugToggle enabled={debug} onToggle={setDebug} />

      <div className="grid gap-4">
        <div className="flex items-center gap-2">
          <Button id="btn-new-case" className="w-full justify-start" onClick={() => router.push("/case-entry")}>
            Add New Case
          </Button>
          <HelpTip content="Opens the case entry form to create a new patient scenario." />
        </div>

        <div className="flex items-center gap-2">
          <Button id="btn-review-cases" className="w-full justify-start" onClick={() => router.push("/case-viewer")}>
            Review and Edit Cases
          </Button>
          <HelpTip content="Browse the list of all cases to make edits or check details." />
        </div>

        <div className="flex items-center gap-2">
          <Button
            id="btn-personas"
            className="w-full justify-start"
            onClick={() => router.push("/admin/personas")}
          >
            Manage Personas
          </Button>
          <HelpTip content="Customize the AI characters (Owner, Nurse) associated with each case." />
        </div>

        <div className="flex items-center gap-2">
          <Button
            id="btn-users"
            className="w-full justify-start"
            onClick={() => router.push("/admin/user-management")}
          >
            Manage Users
          </Button>
          <HelpTip content="Add or remove users and assign them to institutions." />
        </div>

        <div className="flex items-center gap-2">
          <Button
            id="btn-modify-case-stages"
            className="w-full justify-start"
            onClick={() => router.push("/admin/case-stage-manager")}
          >
            Modify Case Stages
          </Button>
          <HelpTip content="Open the Case Stage Manager to enable/disable stages per case." />
        </div>

        <div className="flex items-center gap-2">
          <Button className="w-full justify-start" onClick={() => setLlmOpen(true)}>
            LLM Provider Manager
          </Button>
          <HelpTip content="Open the LLM Provider Manager to set default and per-feature providers." />
          <LLMProviderManager open={llmOpen} onOpenChange={setLlmOpen} />
        </div>
      </div>
    </div>
  );
}
