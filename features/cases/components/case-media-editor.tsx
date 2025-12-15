"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { getStagesForCase } from "@/features/stages/services/stageService";
import type {
  CaseMediaItem,
  CaseMediaType,
  CaseMediaStageRef,
} from "@/features/cases/models/caseMedia";

const DEFAULT_BUCKET = "case-media";
const SUPPORTED_TYPES: CaseMediaType[] = [
  "image",
  "video",
  "audio",
  "document",
];

const FILE_ACCEPT: Record<CaseMediaType, string> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
  document:
    "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

type CaseMediaEditorProps = {
  caseId?: string;
  value: CaseMediaItem[];
  onChange: (items: CaseMediaItem[]) => void;
  readOnly?: boolean;
};

type UploadState = {
  uploadingIndex: number | null;
  error: string | null;
};

type WebAudioWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

function generateId() {
  if (
    typeof crypto !== "undefined" &&
    typeof (crypto as Crypto).randomUUID === "function"
  ) {
    return (crypto as Crypto).randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

function ensureStageRef(stage?: CaseMediaStageRef | null): CaseMediaStageRef {
  if (stage && typeof stage === "object") {
    return {
      stageId: stage.stageId ?? undefined,
      stageKey: stage.stageKey ?? undefined,
      roleKey: stage.roleKey ?? undefined,
    };
  }
  return {};
}

async function uploadFile(
  file: File,
  type: CaseMediaType,
  caseId?: string,
  bucket = DEFAULT_BUCKET
): Promise<{ url: string; path: string }> {
  const ext = file.name.split(".").pop() ?? "bin";
  const normalizedType = type === "document" ? "documents" : `${type}s`;
  const safeCaseId = caseId?.trim() ? caseId.trim() : "draft";
  const filename = `${generateId()}.${ext}`;
  const path = `cases/${safeCaseId}/${normalizedType}/${filename}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error || !data) {
    throw error ?? new Error("Upload failed");
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  const publicUrl = publicUrlData?.publicUrl;
  if (!publicUrl) {
    throw new Error("Unable to resolve public URL for upload");
  }

  return { url: publicUrl, path: data.path };
}

type WaveformResult = {
  thumbnailUrl: string | null;
  durationMs?: number;
};

async function createWaveformPreview(
  file: File,
  caseId?: string,
  bucket = DEFAULT_BUCKET
): Promise<WaveformResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { thumbnailUrl: null };
  }

  try {
    const audioWindow = window as WebAudioWindow;
    const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextCtor) {
      return { thumbnailUrl: null };
    }
    const audioContext = new AudioContextCtor();
    const buffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(buffer.slice(0));
    const channel = audioBuffer.getChannelData(0);
    const width = 600;
    const height = 120;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { thumbnailUrl: null, durationMs: audioBuffer.duration * 1000 };
    }

    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 1;

    const samplesPerPixel = Math.max(1, Math.floor(channel.length / width));
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const start = x * samplesPerPixel;
      const end = Math.min(channel.length, start + samplesPerPixel);
      let min = 1;
      let max = -1;
      for (let i = start; i < end; i++) {
        const sample = channel[i];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }
      const yLow = ((1 - min) * height) / 2;
      const yHigh = ((1 - max) * height) / 2;
      ctx.moveTo(x, yLow);
      ctx.lineTo(x, yHigh);
    }
    ctx.stroke();
    audioContext.close().catch(() => {});

    const dataUrl = canvas.toDataURL("image/png");
    if (!dataUrl) {
      return { thumbnailUrl: null, durationMs: audioBuffer.duration * 1000 };
    }

    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const safeCaseId = caseId?.trim() ? caseId.trim() : "draft";
    const filename = `${generateId()}.png`;
    const uploadPath = `cases/${safeCaseId}/waveforms/${filename}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(uploadPath, blob, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/png",
      });
    if (error || !data) {
      return { thumbnailUrl: null, durationMs: audioBuffer.duration * 1000 };
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);
    return {
      thumbnailUrl: publicUrlData?.publicUrl ?? null,
      durationMs: audioBuffer.duration * 1000,
    };
  } catch (error) {
    console.warn("Failed to generate waveform preview", error);
    return { thumbnailUrl: null };
  }
}

function clone(items: CaseMediaItem[]): CaseMediaItem[] {
  return items.map((item) => ({
    ...item,
    stage: item.stage ? { ...item.stage } : undefined,
    metadata: item.metadata ?? null,
  }));
}

export function CaseMediaEditor({ caseId, value, onChange, readOnly = false }: CaseMediaEditorProps) {
  const [uploadState, setUploadState] = useState<UploadState>({ uploadingIndex: null, error: null });
  const [advancedOpen, setAdvancedOpen] = useState<Record<string, boolean>>({});

  const stages = useMemo(() => {
    if (!caseId) return [];
    return getStagesForCase(caseId);
  }, [caseId]);

  const items = useMemo(() => clone(value), [value]);

  const updateItem = useCallback(
    (index: number, updater: (item: CaseMediaItem) => CaseMediaItem) => {
      const next = clone(items);
      next[index] = updater(next[index]);
      onChange(next);
    },
    [items, onChange]
  );

  const addItem = () => {
    if (readOnly) return;
    const newItem: CaseMediaItem = {
      id: generateId(),
      type: "image",
      url: "",
      caption: "",
      transcript: "",
      stage: {},
      mimeType: undefined,
      thumbnailUrl: undefined,
      metadata: null,
    };
    onChange([...items, newItem]);
  };

  const removeItem = (index: number) => {
    if (readOnly) return;
    const next = clone(items);
    const [removed] = next.splice(index, 1);
    if (removed) {
      setAdvancedOpen((prev) => {
        if (!prev[removed.id]) return prev;
        const nextState = { ...prev };
        delete nextState[removed.id];
        return nextState;
      });
    }
    onChange(next);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    if (readOnly) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) {
      return;
    }
    const next = clone(items);
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    onChange(next);
  };

  const handleFileChange = async (
    index: number,
    file: File,
    type: CaseMediaType
  ) => {
    if (readOnly) return;
    setUploadState({ uploadingIndex: index, error: null });
    try {
      const { url } = await uploadFile(file, type, caseId);
      let waveform: WaveformResult | null = null;
      if (type === "audio") {
        waveform = await createWaveformPreview(file, caseId);
      }
      updateItem(index, (item) => ({
        ...item,
        url,
        mimeType: file.type || item.mimeType,
        durationMs:
          type === "audio"
            ? waveform?.durationMs ?? item.durationMs
            : item.durationMs,
        thumbnailUrl: waveform?.thumbnailUrl ?? item.thumbnailUrl,
      }));
      setUploadState({ uploadingIndex: null, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUploadState({ uploadingIndex: null, error: message });
    }
  };

  const toggleAdvanced = useCallback(
    (id: string) => {
      if (readOnly) return;
      setAdvancedOpen((prev) => ({
        ...prev,
        [id]: !prev[id],
      }));
    },
    [readOnly]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Media Library</h2>
        {!readOnly && (
          <Button type="button" onClick={addItem} size="sm">
            Add media
          </Button>
        )}
      </div>
      {uploadState.error && (
        <div className="text-sm text-red-600">{uploadState.error}</div>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No media attached yet.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => {
            const stage = ensureStageRef(item.stage);
            const advancedHasValue = Boolean(
              stage.stageId ||
              stage.roleKey ||
              item.mimeType ||
              item.durationMs ||
              item.loop ||
              item.thumbnailUrl
            );
            const showAdvanced = advancedOpen[item.id] ?? advancedHasValue;

            return (
              <div
                key={item.id}
                className="space-y-4 rounded border border-border p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">Item {index + 1}</div>
                  {!readOnly && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => moveItem(index, -1)}
                        disabled={index === 0}
                      >
                        Move up
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => moveItem(index, 1)}
                        disabled={index === items.length - 1}
                      >
                        Move down
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => removeItem(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-3">
                      <Label htmlFor={`media-type-${item.id}`}>Type</Label>
                      <select
                        id={`media-type-${item.id}`}
                        className="w-full rounded border border-input bg-card text-card-foreground px-2 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                        value={item.type}
                        onChange={(event) =>
                          updateItem(index, (current) => ({
                            ...current,
                            type: event.target.value as CaseMediaType,
                          }))
                        }
                        disabled={readOnly}
                      >
                        {SUPPORTED_TYPES.map((typeOption) => (
                          <option key={typeOption} value={typeOption}>
                            {typeOption}
                          </option>
                        ))}
                      </select>

                      <Label>Source</Label>
                      {item.type === "image" && item.url ? (
                        <img
                          src={item.url}
                          alt={item.caption ?? "Case asset"}
                          className="h-32 w-full rounded object-cover"
                        />
                      ) : null}
                      {item.type === "video" && item.url ? (
                        <video controls className="w-full rounded" src={item.url} />
                      ) : null}
                      {item.type === "audio" && item.url ? (
                        <audio controls className="w-full" src={item.url} />
                      ) : null}

                      <Input
                        value={item.url}
                        readOnly={readOnly}
                        onChange={(event) =>
                          updateItem(index, (current) => ({
                            ...current,
                            url: event.target.value,
                          }))
                        }
                        placeholder="https://..."
                      />

                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`media-trigger-${item.id}`}>Display Mode</Label>
                        <select
                          id={`media-trigger-${item.id}`}
                          className="w-full rounded border border-input bg-card text-card-foreground px-2 py-1 text-sm"
                          value={item.trigger ?? "on_demand"}
                          onChange={(e) =>
                            updateItem(index, (curr) => ({
                              ...curr,
                              trigger: e.target.value as "auto" | "on_demand",
                            }))
                          }
                          disabled={readOnly}
                        >
                          <option value="on_demand">On Demand (Ask to see)</option>
                          <option value="auto">Auto (Show at stage start)</option>
                        </select>
                        <p className="text-xs text-muted-foreground">
                          "Auto" shows the media immediately when the assigned stage begins.
                          "On Demand" requires the student to ask for it.
                        </p>
                      </div>

                      {!readOnly && (
                        <label className="flex flex-col gap-2 text-sm">
                          <span>Upload file</span>
                          <input
                            type="file"
                            accept={FILE_ACCEPT[item.type]}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (!file) return;
                              void handleFileChange(index, file, item.type);
                            }}
                            disabled={uploadState.uploadingIndex === index}
                          />
                          {uploadState.uploadingIndex === index && (
                            <span className="text-xs text-muted-foreground">
                              Uploading...
                            </span>
                          )}
                        </label>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor={`media-stage-key-${item.id}`}>
                        Stage Assignment
                      </Label>
                      <select
                        id={`media-stage-key-${item.id}`}
                        className="w-full rounded border border-input bg-card text-card-foreground px-2 py-1 text-sm"
                        value={stage.stageId ?? ""}
                        disabled={readOnly}
                        onChange={(event) => {
                          const selectedId = event.target.value;
                          if (!selectedId) {
                            updateItem(index, (current) => ({
                              ...current,
                              stage: {
                                ...ensureStageRef(current.stage),
                                stageId: undefined,
                                stageKey: undefined,
                                roleKey: undefined,
                              },
                            }));
                            return;
                          }
                          const selectedStage = stages.find(
                            (s) => s.id === selectedId
                          );
                          if (selectedStage) {
                            updateItem(index, (current) => ({
                              ...current,
                              stage: {
                                ...ensureStageRef(current.stage),
                                stageId: selectedStage.id,
                                stageKey: selectedStage.title,
                                roleKey: selectedStage.role,
                              },
                            }));
                          }
                        }}
                      >
                        <option value="">
                          -- Global (Available in all stages) --
                        </option>
                        {stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title} ({s.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor={`media-caption-${item.id}`}>
                      Caption
                    </Label>
                    <Textarea
                      id={`media-caption-${item.id}`}
                      value={item.caption ?? ""}
                      readOnly={readOnly}
                      onChange={(event) =>
                        updateItem(index, (current) => ({
                          ...current,
                          caption: event.target.value,
                        }))
                      }
                      rows={2}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor={`media-transcript-${item.id}`}>
                      Transcript / accessibility notes
                    </Label>
                    <Textarea
                      id={`media-transcript-${item.id}`}
                      value={item.transcript ?? ""}
                      readOnly={readOnly}
                      onChange={(event) =>
                        updateItem(index, (current) => ({
                          ...current,
                          transcript: event.target.value,
                        }))
                      }
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleAdvanced(item.id)}
                      disabled={readOnly && !advancedHasValue}
                    >
                      {showAdvanced ? "Hide advanced fields" : "Show advanced fields"}
                    </Button>
                  </div>

                  {showAdvanced && (
                    <div className="space-y-4 border-t border-border/40 pt-3">
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="space-y-3">
                          <Label htmlFor={`media-stage-id-${item.id}`}>
                            Stage id (optional)
                          </Label>
                          <Input
                            id={`media-stage-id-${item.id}`}
                            value={stage.stageId ?? ""}
                            readOnly={readOnly}
                            onChange={(event) =>
                              updateItem(index, (current) => ({
                                ...current,
                                stage: {
                                  ...ensureStageRef(current.stage),
                                  stageId: event.target.value || undefined,
                                },
                              }))
                            }
                          />

                          <Label htmlFor={`media-role-key-${item.id}`}>
                            Persona role key
                          </Label>
                          <Input
                            id={`media-role-key-${item.id}`}
                            value={stage.roleKey ?? ""}
                            readOnly={readOnly}
                            onChange={(event) =>
                              updateItem(index, (current) => ({
                                ...current,
                                stage: {
                                  ...ensureStageRef(current.stage),
                                  roleKey: event.target.value || undefined,
                                },
                              }))
                            }
                          />

                          <Label htmlFor={`media-mime-${item.id}`}>
                            MIME type
                          </Label>
                          <Input
                            id={`media-mime-${item.id}`}
                            value={item.mimeType ?? ""}
                            readOnly={readOnly}
                            onChange={(event) =>
                              updateItem(index, (current) => ({
                                ...current,
                                mimeType: event.target.value || undefined,
                              }))
                            }
                            placeholder="image/png"
                          />
                        </div>

                        <div className="space-y-3">
                          <Label htmlFor={`media-duration-${item.id}`}>
                            Duration (ms)
                          </Label>
                          <Input
                            id={`media-duration-${item.id}`}
                            type="number"
                            min={0}
                            value={item.durationMs ?? ""}
                            readOnly={readOnly}
                            onChange={(event) =>
                              updateItem(index, (current) => ({
                                ...current,
                                durationMs: event.target.value
                                  ? Number(event.target.value)
                                  : undefined,
                              }))
                            }
                          />

                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`media-loop-${item.id}`}
                              checked={Boolean(item.loop)}
                              onCheckedChange={(checked) =>
                                updateItem(index, (current) => ({
                                  ...current,
                                  loop: Boolean(checked),
                                }))
                              }
                              disabled={readOnly}
                            />
                            <Label htmlFor={`media-loop-${item.id}`}>
                              Loop playback
                            </Label>
                          </div>

                          <Label htmlFor={`media-thumbnail-${item.id}`}>
                            Thumbnail / waveform URL
                          </Label>
                          {item.thumbnailUrl ? (
                            <img
                              src={item.thumbnailUrl}
                              alt="Thumbnail preview"
                              className="h-20 w-full rounded object-cover"
                            />
                          ) : null}
                          <Input
                            id={`media-thumbnail-${item.id}`}
                            value={item.thumbnailUrl ?? ""}
                            readOnly={readOnly}
                            onChange={(event) =>
                              updateItem(index, (current) => ({
                                ...current,
                                thumbnailUrl: event.target.value || undefined,
                              }))
                            }
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
