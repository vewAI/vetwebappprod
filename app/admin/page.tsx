"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>
      <Button className="mb-4" onClick={() => router.push("/case-entry")}>
        Add New Case
      </Button>
      <Button className="mb-4 ml-2" onClick={() => router.push("/case-viewer")}>
        Review and Edit Cases
      </Button>
      {/* Add other admin controls here */}
    </div>
  );
}
