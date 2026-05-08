import { useEffect } from "react";

import type { PhotoResult } from "../types";

type PhotoModalProps = {
  onClose: () => void;
  photo: PhotoResult | null;
};

function labelize(value: string | undefined, fallback = "Not specified") {
  if (!value) {
    return fallback;
  }

  return value.replace(/_/g, " ");
}

function approvalCopy(reviewStatus: string | undefined) {
  switch (reviewStatus) {
    case "approved":
      return "Approved for department use";
    case "pending_review":
      return "Needs compliance review";
    case "rejected":
      return "Do not use externally";
    case "missing_policy":
      return "Policy record needed";
    case "unmanaged":
      return "Not yet governed";
    default:
      return "Review status unavailable";
  }
}

function accessCopy(visibility: string | undefined) {
  switch (visibility) {
    case "restricted":
      return "Restricted internal access";
    case "library":
      return "Shared hospital library";
    default:
      return "Library access not classified";
  }
}

function departmentFit(photo: PhotoResult) {
  const haystack = `${photo.description} ${photo.seoCaption} ${photo.subjects?.join(" ") ?? ""}`.toLowerCase();

  if (haystack.includes("headshot") || haystack.includes("portrait") || haystack.includes("employee")) {
    return "Human Resources, Executive Office";
  }

  if (haystack.includes("facility") || haystack.includes("corridor") || haystack.includes("interior")) {
    return "Facilities, Operations";
  }

  if (haystack.includes("patient") || haystack.includes("clinical") || photo.visibility === "restricted") {
    return "Compliance, Clinical Communications";
  }

  if (photo.sceneType === "event" || haystack.includes("community")) {
    return "Marketing, Community Relations";
  }

  return "Marketing, Communications";
}

function recommendedUse(photo: PhotoResult) {
  if (photo.reviewStatus === "pending_review" || photo.visibility === "restricted") {
    return "Internal review, campaign planning, or controlled departmental use.";
  }

  if (photo.reviewStatus === "approved") {
    return "Approved library asset for presentations, intranet, and department requests.";
  }

  return "Useful candidate asset; confirm policy status before external publication.";
}

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
            <span className="meta-subtle">{labelize(photo.sceneType)}</span>
            <span className="meta-subtle">{approvalCopy(photo.reviewStatus)}</span>
          </div>

          <h3>{photo.seoCaption || photo.description}</h3>
          <p>{photo.description}</p>

          <div className="use-guidance">
            <div>
              <span>Recommended use</span>
              <strong>{recommendedUse(photo)}</strong>
            </div>
            <div>
              <span>Best-fit teams</span>
              <strong>{departmentFit(photo)}</strong>
            </div>
          </div>

          <dl className="metadata-grid">
            <div>
              <dt>Release readiness</dt>
              <dd>{approvalCopy(photo.reviewStatus)}</dd>
            </div>
            <div>
              <dt>Access level</dt>
              <dd>{accessCopy(photo.visibility)}</dd>
            </div>
            <div>
              <dt>People visible</dt>
              <dd>{typeof photo.peopleCount === "number" ? photo.peopleCount : "Not counted"}</dd>
            </div>
            <div>
              <dt>Asset type</dt>
              <dd>{labelize(photo.sceneType)}</dd>
            </div>
            <div>
              <dt>Accessibility caption</dt>
              <dd>{photo.altText}</dd>
            </div>
            <div>
              <dt>Content labels</dt>
              <dd>{photo.subjects?.length ? photo.subjects.slice(0, 5).join(", ") : labelize(photo.lighting)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
