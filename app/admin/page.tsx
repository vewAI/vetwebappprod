"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AdminTour } from "@/components/admin/AdminTour";
import { HelpTip } from "@/components/ui/help-tip";
import { DebugToggle } from "@/components/admin/DebugToggle";

export default function AdminPage() {
  const router = useRouter();
  const [debug, setDebug] = React.useState<boolean>(
    typeof window !== "undefined"
      ? window.localStorage.getItem("debugOverlay") === "true"
      : false
  );

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("debugOverlay", debug ? "true" : "false");
      // Optionally, dispatch a custom event for listeners
      window.dispatchEvent(new CustomEvent("debugOverlayToggle", { detail: debug }));
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
      </div>
    </div>
  );
}
