"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { LucideIcon } from "lucide-react";
import { BookOpen, Building2, Cpu, FilePlus, Layers, List, Stethoscope, Users } from "lucide-react";
import { AppSpecsViewer } from "@/components/admin/AppSpecsViewer";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb } from "@/features/navigation/components/breadcrumb";

const LLMProviderManager = dynamic(() => import("@/features/admin/components/LLMProviderManager"), { ssr: false });

type AdminAction = {
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
};

function AdminActionCard({ title, description, icon: Icon, href, onClick }: AdminAction) {
  const card = (
    <Card className="h-full transition-colors hover:bg-brand-50 dark:hover:bg-white/[0.03]">
      <CardHeader>
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/12 dark:text-brand-400">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="mt-1.5 text-sm leading-relaxed">{description}</CardDescription>
      </CardHeader>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {card}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="h-full w-full text-start">
      {card}
    </button>
  );
}

export default function AdminPage() {
  const [llmOpen, setLlmOpen] = React.useState(false);
  const [specsOpen, setSpecsOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      window.localStorage.removeItem("debugOverlay");
      window.localStorage.removeItem("admin_show_speech_debug");
      window.dispatchEvent(new CustomEvent("debugOverlayToggle", { detail: false }));
    } catch {
      // no-op
    }
  }, []);

  const actions: AdminAction[] = [
    {
      title: "Add New Case",
      description: "Create a new patient scenario and add it to the case library.",
      icon: FilePlus,
      href: "/case-entry",
    },
    {
      title: "Review and Edit Cases",
      description: "Browse, edit, or archive existing cases and their personas.",
      icon: List,
      href: "/case-viewer",
    },
    {
      title: "Modify Case Stages",
      description: "Enable, disable, and configure stages for each clinical case.",
      icon: Layers,
      href: "/admin/case-stage-manager",
    },
    {
      title: "Manage Users",
      description: "Add, edit, and remove user accounts, roles, and institution assignments.",
      icon: Users,
      href: "/admin/user-management",
    },
    {
      title: "Manage Institutions",
      description: "Create institutions and manage domains and default roles.",
      icon: Building2,
      href: "/admin/institution-management",
    },
    {
      title: "LLM Provider Manager",
      description: "Set default and per-feature language model providers.",
      icon: Cpu,
      onClick: () => setLlmOpen(true),
    },
    {
      title: "Nurse Specializations",
      description: "Manage species-specific nurse personas and clinical knowledge bases.",
      icon: Stethoscope,
      href: "/admin/nurse-specializations",
    },
    {
      title: "App Specifications Reference",
      description: "View prompt templates, stage definitions, and voice configuration.",
      icon: BookOpen,
      onClick: () => setSpecsOpen(true),
    },
  ];

  return (
    <div className="container mx-auto px-4 pb-8">
      <Breadcrumb items={[{ label: "Home", href: "/dashboard" }, { label: "Admin Panel" }]} />

      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">Admin Panel</h1>
        <p className="mt-4 text-xl text-muted-foreground">Access tools for cases, users, and system configuration.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <AdminActionCard key={action.title} {...action} />
        ))}
      </div>

      <LLMProviderManager open={llmOpen} onOpenChange={setLlmOpen} />
      <AppSpecsViewer open={specsOpen} onOpenChange={setSpecsOpen} />
    </div>
  );
}
