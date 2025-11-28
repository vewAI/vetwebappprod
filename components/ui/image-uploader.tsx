"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

type ImageUploaderProps = {
  bucket?: string;
  existingUrl?: string;
  onUpload: (url: string) => void;
};

export default function ImageUploader({
  bucket = "case-images",
  existingUrl,
  onUpload,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Use a timestamped filename to avoid collisions
      const ext = file.name.split(".").pop();
      const path = `cases/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { data, error: upError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (upError || !data) {
        throw upError ?? new Error("Upload failed");
      }

      // Get public URL (assumes bucket is public). If you use a private bucket,
      // you'll need to generate signed URLs on the server instead.
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error("Could not obtain public URL");

      setPreview(publicUrl);
      onUpload(publicUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error("Image upload error:", err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="flex items-center gap-4">
          <Image
            src={preview}
            alt="case preview"
            width={112}
            height={112}
            className="h-28 w-28 rounded object-cover"
            unoptimized
          />
          <div className="flex flex-col gap-2">
            <div className="text-sm text-muted-foreground">Uploaded image</div>
            <div className="flex gap-2">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                  className="sr-only"
                />
                <Button
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                >
                  Replace
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPreview(null);
                  onUpload("");
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="sr-only"
          />
          <Button onClick={() => inputRef.current?.click()}>
            {uploading ? "Uploading..." : "Upload image"}
          </Button>
        </div>
      )}

      {error && <div className="text-red-600 text-sm">{error}</div>}
    </div>
  );
}
