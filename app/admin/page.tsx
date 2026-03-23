"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { AdminTour } from "@/components/admin/AdminTour";
import { HelpTip } from "@/components/ui/help-tip";
import { AppSpecsViewer } from "@/components/admin/AppSpecsViewer";

export default function AdminPage() {
  const router = useRouter();
  const [llmOpen, setLlmOpen] = React.useState(false);
  const [specsOpen, setSpecsOpen] = React.useState(false);
  const LLMProviderManager = dynamic(() => import("@/features/admin/components/LLMProviderManager"), { ssr: false });

  React.useEffect(() => {
    try {
      // Cleanup legacy debug toggle preferences so old admin UI traces stay off.
      window.localStorage.removeItem("debugOverlay");
      window.localStorage.removeItem("admin_show_speech_debug");
      window.dispatchEvent(new CustomEvent("debugOverlayToggle", { detail: false }));
    } catch {
      // no-op
    }
  }, []);

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
          <HelpTip content="Browse the list of all cases to make edits or check details. Persona configuration is also managed here." />
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

        <div className="flex items-center gap-2">
          <Button className="w-full justify-start" variant="outline" onClick={() => setSpecsOpen(true)}>
            📋 App Specifications Reference
          </Button>
          <HelpTip content="View core prompt templates, stage definitions, and voice configuration values used by the app." />
          <AppSpecsViewer open={specsOpen} onOpenChange={setSpecsOpen} />
        </div>
      </div>
    </div>
  );
}
