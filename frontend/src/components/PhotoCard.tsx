import type { PhotoResult } from "../types";

type PhotoCardProps = {
  onOpen: (result: PhotoResult) => void;
  result: PhotoResult;
};

function labelize(value: string | undefined) {
  return value ? value.replace(/_/g, " ") : "not classified";
}

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
          <span className="meta-subtle">{labelize(result.sceneType)}</span>
          {result.reviewStatus ? <span className="meta-subtle">{labelize(result.reviewStatus)}</span> : null}
        </div>
        <p className="photo-description">{result.description}</p>
        <div className="photo-card-footer">
          <span>{typeof result.peopleCount === "number" ? `${result.peopleCount} people` : "people uncounted"}</span>
          <span>{labelize(result.visibility ?? (result.source === "api" ? "library" : "preview"))}</span>
        </div>
      </div>
    </button>
  );
}
