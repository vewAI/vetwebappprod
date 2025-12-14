"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";

type AvatarOption = {
  url: string;
  label: string;
  roleKey?: string;
};

type AvatarSelectorProps = {
  role: "owner" | "nurse";
  value?: string;
  onChange: (url: string, roleKey?: string) => void;
  readOnly?: boolean;
};

export function AvatarSelector({ role, value, onChange, readOnly }: AvatarSelectorProps) {
  const [options, setOptions] = useState<AvatarOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return; // Only fetch when dialog opens

    async function fetchAvatars() {
      setLoading(true);
      try {
        const newOptions: AvatarOption[] = [];

        if (role === "nurse") {
          // Fetch global nurse personas
          const { data: globalNurses } = await supabase
            .from("global_personas")
            .select("display_name, image_url, role_key")
            .ilike("role_key", "veterinary-nurse%")
            .not("image_url", "is", null);

          // Also fetch any case-specific nurses that might exist
          const { data: caseNurses } = await supabase
            .from("case_personas")
            .select("display_name, image_url, role_key")
            .ilike("role_key", "veterinary-nurse%")
            .not("image_url", "is", null)
            .limit(50);

          if (globalNurses) {
            globalNurses.forEach((p) => {
              if (p.image_url) {
                newOptions.push({
                  url: p.image_url,
                  label: p.display_name || "Global Nurse",
                  roleKey: p.role_key,
                });
              }
            });
          }
          
          if (caseNurses) {
            caseNurses.forEach((p) => {
              if (p.image_url) {
                // Avoid duplicates if URL is same
                if (!newOptions.some(opt => opt.url === p.image_url)) {
                  newOptions.push({
                    url: p.image_url,
                    label: p.display_name || "Case Nurse",
                    roleKey: p.role_key,
                  });
                }
              }
            });
          }
        } else if (role === "owner") {
          // Fetch global owner personas
          const { data: globalOwners } = await supabase
            .from("global_personas")
            .select("display_name, image_url, role_key")
            .ilike("role_key", "owner%")
            .not("image_url", "is", null);

          // Fetch case-specific owners (from all cases, to allow reuse)
          const { data: caseOwners } = await supabase
            .from("case_personas")
            .select("display_name, image_url, role_key")
            .eq("role_key", "owner")
            .not("image_url", "is", null)
            .limit(100); // Increased limit to allow for more variety (requested 60+)

          if (globalOwners) {
            globalOwners.forEach((p) => {
              if (p.image_url) {
                newOptions.push({
                  url: p.image_url,
                  label: p.display_name || "Global Owner",
                  roleKey: p.role_key,
                });
              }
            });
          }

          if (caseOwners) {
            caseOwners.forEach((p) => {
              if (p.image_url) {
                // Avoid duplicates
                if (!newOptions.some(opt => opt.url === p.image_url)) {
                  newOptions.push({
                    url: p.image_url,
                    label: p.display_name || "Owner",
                    roleKey: p.role_key,
                  });
                }
              }
            });
          }
        }

        setOptions(newOptions);
      } catch (err) {
        console.error("Failed to fetch avatars", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchAvatars();
  }, [role, open]);

  if (readOnly) {
    return (
      <div className="flex items-center gap-4">
        {value ? (
          <div className="relative h-16 w-16 overflow-hidden rounded-full border">
            <Image
              src={value}
              alt="Selected avatar"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">No avatar selected</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {value && (
        <div className="relative h-16 w-16 overflow-hidden rounded-full border">
          <Image
            src={value}
            alt="Selected avatar"
            fill
            className="object-cover"
            unoptimized // For external URLs
          />
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            {value ? "Change Avatar" : "Select Avatar"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select {role === "owner" ? "Owner" : "Nurse"} Avatar</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-4 p-4">
            {loading ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                Loading avatars...
              </div>
            ) : options.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No avatars found. {role === "nurse" ? "Check global personas." : "Generate personas in cases first."}
              </div>
            ) : (
              options.map((opt, idx) => (
                <button
                  key={idx}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all hover:border-primary ${
                    value === opt.url ? "border-primary ring-2 ring-primary ring-offset-2" : "border-transparent"
                  }`}
                  onClick={() => {
                    onChange(opt.url, opt.roleKey);
                    setOpen(false);
                  }}
                >
                  <Image
                    src={opt.url}
                    alt={opt.label}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
