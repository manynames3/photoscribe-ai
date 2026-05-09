import type { PhotoResult } from "../types";

type PhotoCardProps = {
  onOpen: (result: PhotoResult) => void;
  result: PhotoResult;
};

function labelize(value: string | undefined) {
  return value ? value.replace(/_/g, " ") : "not classified";
}

function policyClass(value: string | undefined) {
  if (value === "approved") {
    return " is-approved";
  }

  if (value === "restricted" || value === "missing" || value === "expired") {
    return " is-risk";
  }

  return "";
}

export function PhotoCard({ onOpen, result }: PhotoCardProps) {
  const department = result.ownerDepartment || "Unassigned";
  const consent = result.consentStatus || "consent missing";
  const usageRights = result.usageRights || "rights unknown";
  const reviewStatus = result.reviewStatus || "pending";

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
          <span className={`meta-pill${policyClass(reviewStatus)}`}>{labelize(reviewStatus)}</span>
          <span className="meta-subtle">{labelize(result.sceneType)}</span>
        </div>
        <p className="photo-description">{result.description}</p>
        <dl className="asset-record-grid">
          <div>
            <dt>Owner</dt>
            <dd>{department}</dd>
          </div>
          <div>
            <dt>Consent</dt>
            <dd>{labelize(consent)}</dd>
          </div>
          <div>
            <dt>Rights</dt>
            <dd>{labelize(usageRights)}</dd>
          </div>
          <div>
            <dt>People</dt>
            <dd>{typeof result.peopleCount === "number" ? result.peopleCount : "Uncounted"}</dd>
          </div>
        </dl>
        <div className="photo-card-footer">
          <span>{labelize(result.visibility ?? (result.source === "api" ? "library" : "preview"))}</span>
          <span>{labelize(result.mood)}</span>
        </div>
      </div>
    </button>
  );
}
