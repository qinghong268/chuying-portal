import { useState, useRef } from "react";
import { api } from "../api/client";

interface Props {
  currentUrl?: string;
  onUploaded: (url: string) => void;
}

export function ImageUpload({ currentUrl, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api<{ url: string }>("/api/admin/upload", {
        method: "POST",
        body: formData,
        // Don't set Content-Type - browser sets it with boundary for FormData
      });
      onUploaded(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {currentUrl ? (
        <img src={currentUrl} alt="预览" style={{ maxWidth: 200, maxHeight: 150, display: "block", marginBottom: 8 }} />
      ) : null}
      <input
        type="file"
        ref={fileRef}
        accept="image/*"
        onChange={(e) => { void handleFile(e); }}
        disabled={uploading}
      />
      {uploading ? <span>上传中...</span> : null}
      {error ? <span style={{ color: "red" }}>{error}</span> : null}
    </div>
  );
}
