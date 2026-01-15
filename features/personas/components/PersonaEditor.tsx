"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { VOICE_PRESETS, type VoicePreset } from "@/features/speech/services/voiceMap";
import { speakRemote, stopActiveTtsPlayback } from "@/features/speech/services/ttsService";
import { Play, Square, Loader2, User, Mic, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import type { PersonaSex } from "@/features/personas/models/persona";

// Avatar templates fetched from existing case_personas
type AvatarTemplate = {
  id: string;
  imageUrl: string;
  displayName: string;
  sex?: PersonaSex | null;
  voiceId?: string;
};

// The persona configuration that gets saved
export type PersonaConfig = {
  imageUrl: string;
  displayName: string;
  sex: PersonaSex;
  voiceId: string;
  /** Reference to source persona (for copying data) */
  sourcePersonaId?: string;
  /** Custom behavior prompt that defines persona personality and responses */
  behaviorPrompt?: string;
};

type PersonaEditorProps = {
  role: "owner" | "nurse";
  caseId: string;
  /** Current configuration */
  value: Partial<PersonaConfig>;
  /** Called when any field changes */
  onChange: (config: PersonaConfig) => void;
  /** Read-only mode (view mode) */
  readOnly?: boolean;
};

/**
 * Comprehensive persona editor for case-viewer.
 * Allows admins to configure image, name, gender, and voice for a persona.
 * All selections persist to case_personas and are used for all attempts.
 */
export function PersonaEditor({
  role,
  caseId,
  value,
  onChange,
  readOnly,
}: PersonaEditorProps) {
  const [avatarTemplates, setAvatarTemplates] = useState<AvatarTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [behaviorPromptOpen, setBehaviorPromptOpen] = useState(false);

  // Current config with defaults
  const config: PersonaConfig = {
    imageUrl: value.imageUrl ?? "",
    displayName: value.displayName ?? (role === "owner" ? "Pet Owner" : "Veterinary Nurse"),
    sex: value.sex ?? "female",
    voiceId: value.voiceId ?? (role === "owner" ? "shimmer" : "nova"),
    sourcePersonaId: value.sourcePersonaId,
    behaviorPrompt: value.behaviorPrompt,
  };

  // Filter voices by gender
  const availableVoices = VOICE_PRESETS.filter((v) => {
    if (config.sex === "neutral") return true;
    return v.gender === config.sex || v.gender === "neutral";
  });

  // Ensure current voice is valid for selected gender
  useEffect(() => {
    if (readOnly) return;
    const currentVoice = VOICE_PRESETS.find((v) => v.id === config.voiceId);
    if (currentVoice && config.sex !== "neutral" && currentVoice.gender !== config.sex && currentVoice.gender !== "neutral") {
      // Voice doesn't match gender, pick a default
      const defaultVoice = availableVoices[0];
      if (defaultVoice) {
        onChange({ ...config, voiceId: defaultVoice.id });
      }
    }
  }, [config.sex]);

  // Fetch avatar templates when dialog opens
  useEffect(() => {
    if (!avatarDialogOpen) return;

    async function fetchTemplates() {
      setLoadingTemplates(true);
      try {
        const templates: AvatarTemplate[] = [];
        const seenUrls = new Set<string>();

        // Fetch from case_personas
        const rolePattern = role === "nurse" ? "veterinary-nurse%" : "owner";
        const query = role === "nurse"
          ? supabase
              .from("case_personas")
              .select("id, display_name, image_url, metadata")
              .ilike("role_key", rolePattern)
              .not("image_url", "is", null)
              .order("created_at", { ascending: false })
              .limit(100)
          : supabase
              .from("case_personas")
              .select("id, display_name, image_url, metadata")
              .eq("role_key", rolePattern)
              .not("image_url", "is", null)
              .order("created_at", { ascending: false })
              .limit(100);

        const { data: personas, error } = await query;

        if (error) {
          console.error("Failed to fetch persona templates", error);
        } else if (personas) {
          personas.forEach((p) => {
            if (p.image_url && !seenUrls.has(p.image_url)) {
              seenUrls.add(p.image_url);
              const meta = (p.metadata ?? {}) as Record<string, unknown>;
              const identity = meta.identity as Record<string, unknown> | undefined;
              templates.push({
                id: p.id,
                imageUrl: p.image_url,
                displayName: p.display_name || (role === "nurse" ? "Nurse" : "Owner"),
                sex: (identity?.sex ?? meta.sex) as PersonaSex | undefined,
                voiceId: (identity?.voiceId ?? meta.voiceId) as string | undefined,
              });
            }
          });
        }

        // Also fetch from global_personas for backwards compatibility
        const globalQuery = role === "nurse"
          ? supabase
              .from("global_personas")
              .select("id, display_name, image_url, metadata")
              .ilike("role_key", rolePattern)
              .not("image_url", "is", null)
              .limit(50)
          : supabase
              .from("global_personas")
              .select("id, display_name, image_url, metadata")
              .eq("role_key", rolePattern)
              .not("image_url", "is", null)
              .limit(50);

        const { data: globalPersonas } = await globalQuery;
        if (globalPersonas) {
          globalPersonas.forEach((p) => {
            if (p.image_url && !seenUrls.has(p.image_url)) {
              seenUrls.add(p.image_url);
              const meta = (p.metadata ?? {}) as Record<string, unknown>;
              const identity = meta.identity as Record<string, unknown> | undefined;
              templates.push({
                id: `global:${p.id}`,
                imageUrl: p.image_url,
                displayName: p.display_name || (role === "nurse" ? "Nurse" : "Owner"),
                sex: (identity?.sex ?? meta.sex) as PersonaSex | undefined,
                voiceId: (identity?.voiceId ?? meta.voiceId) as string | undefined,
              });
            }
          });
        }

        setAvatarTemplates(templates);
      } catch (err) {
        console.error("Failed to fetch templates", err);
      } finally {
        setLoadingTemplates(false);
      }
    }

    void fetchTemplates();
  }, [role, avatarDialogOpen]);

  // Preview voice
  const handlePreviewVoice = useCallback(async () => {
    if (previewPlaying) {
      stopActiveTtsPlayback();
      setPreviewPlaying(false);
      return;
    }

    setPreviewLoading(true);
    setPreviewPlaying(true);
    try {
      const sampleText = role === "owner"
        ? `Hello, I'm ${config.displayName}. I'm here with my pet today.`
        : `Good morning, I'm ${config.displayName}. How can I help you today?`;

      const audio = await speakRemote(sampleText, config.voiceId);
      // Listen for when audio ends
      audio.addEventListener("ended", () => setPreviewPlaying(false));
      audio.addEventListener("error", () => setPreviewPlaying(false));
    } catch (err) {
      console.error("Voice preview failed", err);
      setPreviewPlaying(false);
    } finally {
      setPreviewLoading(false);
    }
  }, [config.displayName, config.voiceId, previewPlaying, role]);

  // Select avatar template
  const handleSelectTemplate = (template: AvatarTemplate) => {
    onChange({
      ...config,
      imageUrl: template.imageUrl,
      displayName: template.displayName,
      sex: template.sex ?? config.sex,
      voiceId: template.voiceId ?? config.voiceId,
      sourcePersonaId: template.id.startsWith("global:") ? template.id : `case:${template.id}`,
    });
    setAvatarDialogOpen(false);
  };

  // Read-only view
  if (readOnly) {
    return (
      <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/30">
        {config.imageUrl ? (
          <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-primary/20 flex-shrink-0">
            <Image
              src={config.imageUrl}
              alt={config.displayName}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="h-20 w-20 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center flex-shrink-0">
            <User className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-lg truncate">{config.displayName}</h4>
          <div className="text-sm text-muted-foreground space-y-1 mt-1">
            <p>Gender: <span className="capitalize">{config.sex}</span></p>
            <p>Voice: {VOICE_PRESETS.find((v) => v.id === config.voiceId)?.label ?? config.voiceId}</p>
          </div>
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <div className="space-y-4 p-4 border rounded-lg">
      {/* Avatar Section */}
      <div className="flex items-start gap-4">
        <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
          <DialogTrigger asChild>
            <button className="relative group">
              {config.imageUrl ? (
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-primary/20 transition-all group-hover:border-primary">
                  <Image
                    src={config.imageUrl}
                    alt={config.displayName}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Pencil className="h-6 w-6 text-white" />
                  </div>
                </div>
              ) : (
                <div className="h-24 w-24 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary transition-colors">
                  <div className="text-center">
                    <User className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                    <span className="text-xs text-muted-foreground">Select</span>
                  </div>
                </div>
              )}
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select {role === "owner" ? "Owner" : "Nurse"} Persona</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              Choose a persona template. You can customize the name, gender, and voice after selection.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {loadingTemplates ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading personas...
                </div>
              ) : avatarTemplates.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No persona templates found. Create personas in other cases first.
                </div>
              ) : (
                avatarTemplates.map((template) => (
                  <button
                    key={template.id}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all hover:border-primary hover:ring-2 hover:ring-primary/20 ${
                      config.imageUrl === template.imageUrl
                        ? "border-primary ring-2 ring-primary ring-offset-2"
                        : "border-muted"
                    }`}
                    title={`${template.displayName} (${template.sex ?? "unknown"})`}
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <Image
                      src={template.imageUrl}
                      alt={template.displayName}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-xs text-white truncate">{template.displayName}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex-1 space-y-3">
          {/* Name */}
          <div>
            <Label htmlFor={`${role}-name`} className="text-sm font-medium">
              Display Name
            </Label>
            <Input
              id={`${role}-name`}
              value={config.displayName}
              onChange={(e) => onChange({ ...config, displayName: e.target.value })}
              placeholder={role === "owner" ? "Pet Owner" : "Veterinary Nurse"}
              className="mt-1"
            />
          </div>

          {/* Gender */}
          <div>
            <Label htmlFor={`${role}-sex`} className="text-sm font-medium">
              Gender
            </Label>
            <Select
              value={config.sex}
              onValueChange={(val: string) => onChange({ ...config, sex: val as PersonaSex })}
            >
              <SelectTrigger id={`${role}-sex`} className="mt-1">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Voice Section */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Voice</Label>
        <div className="flex items-center gap-2">
          <Select
            value={config.voiceId}
            onValueChange={(val: string) => onChange({ ...config, voiceId: val })}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select voice" />
            </SelectTrigger>
            <SelectContent>
              {availableVoices.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  {voice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handlePreviewVoice}
            disabled={previewLoading}
            title={previewPlaying ? "Stop preview" : "Preview voice"}
          >
            {previewLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : previewPlaying ? (
              <Square className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {VOICE_PRESETS.find((v) => v.id === config.voiceId)?.accent ?? ""} accent,{" "}
          {VOICE_PRESETS.find((v) => v.id === config.voiceId)?.provider ?? ""} provider
        </p>
      </div>

      {/* Behavior Prompt Section (Collapsible) */}
      <div className="space-y-2 border-t pt-4">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
          onClick={() => setBehaviorPromptOpen(!behaviorPromptOpen)}
        >
          {behaviorPromptOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Behavior Prompt
          {config.behaviorPrompt && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-auto">
              Custom
            </span>
          )}
        </button>
        {behaviorPromptOpen && (
          <div className="space-y-2 mt-2">
            <Textarea
              id={`${role}-behavior-prompt`}
              value={config.behaviorPrompt ?? ""}
              onChange={(e) => onChange({ ...config, behaviorPrompt: e.target.value })}
              placeholder={`Optional: Define custom personality and behavior for this ${role === "owner" ? "pet owner" : "veterinary nurse"}.\n\nExample: "Speaks with a rural accent, very attached to their pet, tends to worry easily about costs."`}
              rows={6}
              className="text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">
              This prompt is appended to the AI system prompt to customize how this persona responds during conversations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
