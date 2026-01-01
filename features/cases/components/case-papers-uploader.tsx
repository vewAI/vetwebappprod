"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadFile } from "@/features/cases/components/case-media-editor";
import { buildAuthHeaders } from "@/lib/auth-headers";
import axios from "axios";
import { isCaseMediaItem } from "@/features/cases/models/caseMedia";

type Props = {
  caseId: string;
  onUploaded?: (media: any) => void;
};

export function CasePapersUploader({ caseId, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [processForAi, setProcessForAi] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handleUpload = async () => {
    if (!file) return setError("Select a file first");
    // Set uploading immediately so the UI can reflect state
    setError(null);
    setUploading(true);

    // Defer heavy work to next tick to ensure UI updates (prevents long event handler jank)
    setTimeout(async () => {
      try {
        const { url, path } = await uploadFile(file, "document", caseId);

        // Build media item
        const mediaItem = {
          id: `${Date.now()}-${Math.random()}`,
          type: "document",
          url,
          caption: caption || file.name,
          mimeType: file.type || undefined,
          metadata: { sourcePath: path },
          trigger: "on_demand",
        };

        const headers = await buildAuthHeaders({ "Content-Type": "application/json" });
        const resp = await axios.post(`/api/cases/media`, { caseId, media: mediaItem }, { headers });
        if (resp.status === 200) {

          // Trigger Ingestion if requested
          if (processForAi) {
            setIngesting(true);
            try {
              const formData = new FormData();
              formData.append("file", file);
              formData.append("case_id", caseId);

              // Using axios for consistency
              const ingestHeaders = await buildAuthHeaders({ "Content-Type": "multipart/form-data" });
              await axios.post("/api/cases/ingest", formData, {
                headers: ingestHeaders,
              });
              console.log("Ingestion complete");
            } catch (ingestErr) {
              console.error("Ingestion failed", ingestErr);
              // Extract and display specific error message if available
              if (ingestErr instanceof Error || (typeof ingestErr === 'object' && ingestErr !== null)) {
                const errorObj = ingestErr as any;
                const errorMsg = errorObj?.response?.data?.error || errorObj?.message || "AI processing failed";
                const errorCode = errorObj?.response?.data?.code;
                setError(`Ingestion error${errorCode ? ` (${errorCode})` : ""}: ${errorMsg}`);
              } else {
                setError("File uploaded but AI processing failed.");
              }
            } finally {
              setIngesting(false);
            }
          }

          setFile(null);
          setCaption("");
          if (onUploaded) onUploaded(mediaItem);
        } else {
          setError("Failed to attach paper to case");
        }
      } catch (err) {
        console.error("Upload error", err);
        setError(String((err as Error).message ?? "Upload failed"));
      } finally {
        setUploading(false);
      }
    }, 0);
  };

  return (
    <div className="space-y-2 border p-3 rounded">
      <div className="flex items-center gap-2">
        <Label>Upload Reference Paper (PDF/DOCX)</Label>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
          className="ml-2"
        />
      </div>
      <div>
        <Label>Caption (optional)</Label>
        <Input value={caption} onChange={(e) => setCaption(e.target.value)} />
      </div>

      <div className="flex items-center space-x-2 py-2">
        <input
          type="checkbox"
          id="processAi"
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          checked={processForAi}
          onChange={(e) => setProcessForAi(e.target.checked)}
        />
        <Label htmlFor="processAi" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          Process for AI Knowledge Base (RAG)
        </Label>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex items-center gap-2">
        <Button
          onClick={() => {
            if (!file) {
              // open file picker when no file selected
              inputRef.current?.click();
              return;
            }
            void handleUpload();
          }}
          disabled={uploading}
        >
          {uploading ? (ingesting ? "Ingesting Knowledge..." : "Uploading...") : file ? "Upload Paper" : "Select a file"}
        </Button>
      </div>
    </div>
  );
}

export default CasePapersUploader;
