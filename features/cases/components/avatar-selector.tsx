"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Static lists of avatars as requested
const OWNER_AVATARS = Array.from({ length: 50 }, (_, i) => ({
  id: `owner-${i + 1}`,
  url: `/avatars/owner/owner_${i + 1}.jpg`, // Assuming these exist or will exist
  label: `Owner ${i + 1}`,
}));

// Fallback to some placeholder images if local assets don't exist yet
// Using a placeholder service for demonstration if real assets aren't there
const getPlaceholder = (role: string, i: number) => 
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${role}${i}`;

const OWNER_OPTIONS = Array.from({ length: 50 }, (_, i) => ({
  url: getPlaceholder("owner", i),
  label: `Owner ${i + 1}`,
}));

const NURSE_OPTIONS = Array.from({ length: 5 }, (_, i) => ({
  url: getPlaceholder("nurse", i),
  label: `Nurse ${i + 1}`,
}));

type AvatarSelectorProps = {
  role: "owner" | "nurse";
  value?: string;
  onChange: (url: string) => void;
};

export function AvatarSelector({ role, value, onChange }: AvatarSelectorProps) {
  const options = role === "owner" ? OWNER_OPTIONS : NURSE_OPTIONS;
  const [open, setOpen] = React.useState(false);

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
            {options.map((opt, idx) => (
              <button
                key={idx}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all hover:border-primary ${
                  value === opt.url ? "border-primary ring-2 ring-primary ring-offset-2" : "border-transparent"
                }`}
                onClick={() => {
                  onChange(opt.url);
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
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
