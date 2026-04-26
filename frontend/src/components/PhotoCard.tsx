import type { PhotoResult } from "../types";

type PhotoCardProps = {
  onOpen: (result: PhotoResult) => void;
  result: PhotoResult;
};

export function PhotoCard({ onOpen, result }: PhotoCardProps) {
  return (
    <button
      className="photo-card"
      onClick={() => onOpen(result)}
      type="button"
    >
      {result.thumbnailUrl ? (
        <img
          alt={result.altText}
          className="photo-thumb"
          loading="lazy"
          src={result.thumbnailUrl}
        />
      ) : (
        <div className="photo-thumb photo-thumb-preview">
          <span>{result.sceneType}</span>
        </div>
      )}

      <div className="photo-card-body">
        <div className="photo-card-meta">
          <span className="meta-pill">{result.mood}</span>
          <span className="meta-subtle">{result.sceneType}</span>
        </div>
        <p className="photo-description">{result.description}</p>
        <div className="photo-card-footer">
          <span>{result.timeOfDay.replace(/_/g, " ")}</span>
          <span>{result.source === "api" ? "live" : "preview"}</span>
        </div>
      </div>
    </button>
  );
}
