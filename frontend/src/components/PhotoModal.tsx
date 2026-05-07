import { useEffect } from "react";

import type { PhotoResult } from "../types";

type PhotoModalProps = {
  onClose: () => void;
  photo: PhotoResult | null;
};

export function PhotoModal({ onClose, photo }: PhotoModalProps) {
  useEffect(() => {
    if (!photo) {
      return;
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeydown);

    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [onClose, photo]);

  if (!photo) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
    >
      <div className="modal-panel">
        <button className="modal-close" onClick={onClose} type="button">
          Close
        </button>

        {photo.imageUrl ? (
          <img alt={photo.altText} className="modal-image" src={photo.imageUrl} />
        ) : (
          <div className="modal-image photo-thumb-preview">
            <span>{photo.sceneType}</span>
          </div>
        )}

        <div className="modal-copy">
          <div className="photo-card-meta">
            <span className="meta-pill">{photo.mood}</span>
            <span className="meta-subtle">{photo.sceneType}</span>
            <span className="meta-subtle">{photo.lighting.replace(/_/g, " ")}</span>
            {photo.reviewStatus ? <span className="meta-subtle">{photo.reviewStatus.replace(/_/g, " ")}</span> : null}
          </div>

          <h3>{photo.seoCaption || photo.description}</h3>
          <p>{photo.description}</p>

          <dl className="metadata-grid">
            <div>
              <dt>Alt text</dt>
              <dd>{photo.altText}</dd>
            </div>
            <div>
              <dt>Time of day</dt>
              <dd>{photo.timeOfDay.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt>Visibility</dt>
              <dd>{photo.visibility ?? "library"}</dd>
            </div>
            <div>
              <dt>Review status</dt>
              <dd>{photo.reviewStatus?.replace(/_/g, " ") ?? "not managed"}</dd>
            </div>
            <div>
              <dt>S3 key</dt>
              <dd>{photo.s3Key ?? photo.key}</dd>
            </div>
            <div>
              <dt>Vector distance</dt>
              <dd>{photo.distance?.toFixed(3) ?? "Preview mode"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
