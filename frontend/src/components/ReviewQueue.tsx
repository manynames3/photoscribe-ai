import { useState } from "react";

import { getReviewQueue } from "../api";
import type { PhotoResult } from "../types";

type ReviewQueueProps = {
  canReview: boolean;
  onOpen: (photo: PhotoResult) => void;
};

export function ReviewQueue({ canReview, onOpen }: ReviewQueueProps) {
  const [items, setItems] = useState<PhotoResult[]>([]);
  const [status, setStatus] = useState("Load newly uploaded assets that need review before release.");
  const [isLoading, setIsLoading] = useState(false);

  if (!canReview) {
    return null;
  }

  async function loadQueue() {
    setIsLoading(true);
    setStatus("");

    try {
      const results = await getReviewQueue();
      setItems(results);
      setStatus(`${results.length} asset${results.length === 1 ? "" : "s"} awaiting review.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Review queue failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="ops-panel">
      <div className="sidebar-header">
        <div>
          <p className="sidebar-label">Review queue</p>
          <h2>Pending assets</h2>
          <p>{status}</p>
        </div>
        <button className="clear-filters" disabled={isLoading} onClick={() => void loadQueue()} type="button">
          {isLoading ? "Loading..." : "Load queue"}
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
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
