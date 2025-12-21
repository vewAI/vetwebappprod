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
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return setError("Select a file first");
    setUploading(true);
    setError(null);
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
  };

  return (
    <div className="space-y-2 border p-3 rounded">
      <div className="flex items-center gap-2">
        <Label>Upload Reference Paper (PDF/DOCX)</Label>
        <input
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
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex items-center gap-2">
        <Button onClick={handleUpload} disabled={uploading || !file}>
          {uploading ? "Uploading..." : "Upload Paper"}
        </Button>
      </div>
    </div>
  );
}

export default CasePapersUploader;
