import { useRef, useState } from "react";

import { uploadPhoto } from "../api";
import type { UploadQueueItem } from "../types";

type UploadPanelProps = {
  onUploaded?: (uploadedCount: number) => void;
};

const TOKEN_STORAGE_KEY = "photoscribe.uploadToken";
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createQueueItems(files: File[]) {
  return files.map((file) => ({
    file,
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    progress: 0,
    status: "ready" as const,
  }));
}

async function sha256File(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function statusText(item: UploadQueueItem) {
  if (item.status === "done") {
    return "indexing started";
  }

  if (item.status === "duplicate") {
    return "duplicate skipped";
  }

  if (item.status === "hashing") {
    return "checking duplicate";
  }

  return item.status;
}

export function UploadPanel({ onUploaded }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? "");

  function updateItem(id: string, patch: Partial<UploadQueueItem>) {
    setItems((currentItems) => currentItems.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => ACCEPTED_IMAGE_TYPES.includes(file.type));
    setItems((currentItems) => [...currentItems, ...createQueueItems(files)]);
  }

  async function processUploads() {
    const uploadToken = token.trim();
    if (!uploadToken) {
      setItems((currentItems) =>
        currentItems.map((item) => ({
          ...item,
          error: item.status === "ready" ? "Enter the owner upload token first." : item.error,
          status: item.status === "ready" ? "error" : item.status,
        })),
      );
      return;
    }

    window.localStorage.setItem(TOKEN_STORAGE_KEY, uploadToken);
    setIsUploading(true);
    let uploadedCount = 0;
    const seenChecksums = new Set(
      items
        .filter((item) => item.status === "done" || item.status === "duplicate")
        .map((item) => item.checksumSha256)
        .filter((checksum): checksum is string => Boolean(checksum)),
    );

    for (const item of items) {
      if (item.status === "done" || item.status === "duplicate") {
        continue;
      }

      let checksumSha256 = item.checksumSha256;
      let reservedChecksum = false;

      try {
        updateItem(item.id, { error: undefined, progress: 1, status: "hashing" });
        checksumSha256 = checksumSha256 ?? (await sha256File(item.file));
        updateItem(item.id, { checksumSha256 });

        if (seenChecksums.has(checksumSha256)) {
          updateItem(item.id, {
            error: "This exact file was already selected or uploaded in this batch.",
            progress: 100,
            status: "duplicate",
          });
          continue;
        }

        seenChecksums.add(checksumSha256);
        reservedChecksum = true;
        updateItem(item.id, { progress: 2, status: "uploading" });

        const result = await uploadPhoto(item.file, uploadToken, checksumSha256, (progress) => {
          updateItem(item.id, { progress });
        });

        if (result.duplicate) {
          updateItem(item.id, {
            error: "This content already exists in the photo library.",
            key: result.key,
            progress: 100,
            status: "duplicate",
          });
          continue;
        }

        uploadedCount += 1;
        updateItem(item.id, { key: result.key, progress: 100, status: "done" });
      } catch (error) {
        if (reservedChecksum && checksumSha256) {
          seenChecksums.delete(checksumSha256);
        }
        updateItem(item.id, {
          error: error instanceof Error ? error.message : "Upload failed.",
          status: "error",
        });
      }
    }

    setIsUploading(false);
    if (uploadedCount) {
      onUploaded?.(uploadedCount);
    }
  }

  const readyCount = items.filter((item) => item.status !== "done" && item.status !== "duplicate").length;

  return (
    <section className="upload-panel">
      <div className="upload-copy">
        <p className="sidebar-label">Media intake</p>
        <h2>Add approved hospital assets</h2>
        <p>
          Drag in department-approved JPEG, PNG, or WebP files. The browser uploads directly to
          private S3 with a short-lived signed URL, skips exact duplicates by content hash, then
          queues each new image for AI metadata extraction and policy indexing.
        </p>
      </div>

      <div
        className={`upload-dropzone${isDragging ? " is-dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <input
          accept="image/jpeg,image/png,image/webp"
          className="upload-input"
          multiple
          onChange={(event) => {
            if (event.target.files) {
              handleFiles(event.target.files);
            }
          }}
          ref={inputRef}
          type="file"
        />
        <button className="upload-choose" onClick={() => inputRef.current?.click()} type="button">
          Choose images
        </button>
        <span>or drop files here</span>
      </div>

      <label className="upload-token">
        <span>Department upload token</span>
        <input
          autoComplete="off"
          onChange={(event) => setToken(event.target.value)}
          placeholder="Paste authorized intake token"
          type="password"
          value={token}
        />
      </label>

      <div className="upload-actions">
        <button
          className="search-button"
          disabled={isUploading || !items.length}
          onClick={() => {
            void processUploads();
          }}
          type="button"
        >
          {isUploading ? "Uploading..." : `Upload ${readyCount || items.length} file${(readyCount || items.length) === 1 ? "" : "s"}`}
        </button>
        <button className="clear-filters" disabled={isUploading || !items.length} onClick={() => setItems([])} type="button">
          Clear
        </button>
      </div>

      {items.length ? (
        <div className="upload-list">
          {items.map((item) => (
            <article className="upload-row" key={item.id}>
              <div>
                <strong>{item.file.name}</strong>
                <span>
                  {formatBytes(item.file.size)} · {statusText(item)}
                </span>
                {item.error ? <p>{item.error}</p> : null}
                {item.key ? <p>Stored for AI indexing.</p> : null}
              </div>
              <div className="upload-progress" aria-label={`${item.file.name} upload progress`}>
                <span style={{ width: `${item.progress}%` }} />
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
