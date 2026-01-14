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
  /** Unique persona ID from case_personas for copying data */
  personaId?: string;
};

type AvatarSelectorProps = {
  role: "owner" | "nurse";
  value?: string;
  /** Returns the selected avatar URL and optionally a persona ID to copy from */
  onChange: (url: string, personaId?: string) => void;
  readOnly?: boolean;
};

/**
 * Avatar selector that shows existing case personas as templates.
 * SIMPLIFIED: Only uses case_personas table - no global_personas dependency.
 * Selected personas are copied (not referenced) to the target case.
 */
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
        const seenUrls = new Set<string>();

        // Fetch all case personas with the matching role that have images
        const rolePattern = role === "nurse" ? "veterinary-nurse%" : "owner";
        const query = role === "nurse"
          ? supabase
              .from("case_personas")
              .select("id, display_name, image_url, role_key, case_id")
              .ilike("role_key", rolePattern)
              .not("image_url", "is", null)
              .order("created_at", { ascending: false })
              .limit(100)
          : supabase
              .from("case_personas")
              .select("id, display_name, image_url, role_key, case_id")
              .eq("role_key", rolePattern)
              .not("image_url", "is", null)
              .order("created_at", { ascending: false })
              .limit(100);

        const { data: personas, error } = await query;

        if (error) {
          console.error("Failed to fetch persona avatars", error);
        } else if (personas) {
          personas.forEach((p) => {
            if (p.image_url && !seenUrls.has(p.image_url)) {
              seenUrls.add(p.image_url);
              newOptions.push({
                url: p.image_url,
                label: p.display_name || (role === "nurse" ? "Nurse" : "Owner"),
                roleKey: p.role_key,
                personaId: `case:${p.id}`,
              });
            }
          });
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
                  key={opt.personaId ?? idx}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all hover:border-primary ${
                    value === opt.url ? "border-primary ring-2 ring-primary ring-offset-2" : "border-transparent"
                  }`}
                  title={opt.label}
                  onClick={() => {
                    // Pass personaId for persistent assignment, fall back to roleKey for backwards compatibility
                    onChange(opt.url, opt.personaId ?? opt.roleKey);
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
