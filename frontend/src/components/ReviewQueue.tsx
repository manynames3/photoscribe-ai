import { useCallback, useEffect, useState } from "react";

import { getReviewQueue } from "../api";
import type { PhotoResult } from "../types";

type ReviewQueueProps = {
  canReview: boolean;
  onOpen: (photo: PhotoResult) => void;
  revision?: number;
};

function reviewReason(item: PhotoResult) {
  if (!item.consentStatus || item.consentStatus === "missing") {
    return "Consent missing";
  }

  if (!item.usageRights || item.usageRights === "unknown") {
    return "Rights unknown";
  }

  if (item.visibility === "restricted") {
    return "Restricted asset";
  }

  return "Review required";
}

export function ReviewQueue({ canReview, onOpen, revision = 0 }: ReviewQueueProps) {
  const [items, setItems] = useState<PhotoResult[]>([]);
  const [status, setStatus] = useState("Loading review queue...");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    setStatus("Loading review queue...");

    try {
      const results = await getReviewQueue();
      setItems(results);
      setHasLoaded(true);
      setStatus(`${results.length} photo${results.length === 1 ? "" : "s"} waiting for review.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Review queue failed.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canReview) {
      return;
    }

    void loadQueue();
  }, [canReview, loadQueue, revision]);

  if (!canReview) {
    return null;
  }

  return (
    <section className="ops-panel">
      <div className="sidebar-header">
        <div>
          <p className="sidebar-label">Review queue</p>
          <h2>Photos waiting for review</h2>
          <p role="status" aria-live="polite">{status}</p>
        </div>
        <button className="clear-filters" disabled={isLoading} onClick={() => void loadQueue()} type="button">
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {items.length ? (
        <div className="review-list">
          {items.map((item) => (
            <button className="review-row" key={item.key} onClick={() => onOpen(item)} type="button">
              {item.thumbnailUrl ? <img alt={item.altText} src={item.thumbnailUrl} /> : null}
              <span>
                <strong>{item.seoCaption || item.description}</strong>
                <small>
                  {item.ownerDepartment || "Unassigned"} · {item.consentStatus || "missing consent"} ·{" "}
                  {item.usageRights || "unknown rights"}
                </small>
                <em>{reviewReason(item)}</em>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {hasLoaded && !items.length ? (
        <p className="curator-status">No photos are waiting for review. New uploads will appear here after indexing.</p>
      ) : null}
    </section>
  );
}
