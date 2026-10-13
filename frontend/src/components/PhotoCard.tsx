import type { PhotoResult } from "../types";
import { assetClearance } from "../assetClearance";

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

  if (value === "risk" || value === "restricted" || value === "missing" || value === "expired") {
    return " is-risk";
  }

  return "";
}

export function PhotoCard({ onOpen, result }: PhotoCardProps) {
  const department = result.ownerDepartment || "Unassigned";
  const consent = result.consentStatus || "missing";
  const usageRights = result.usageRights || "unknown";
  const clearance = assetClearance(result);

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
          <span>No preview</span>
        </div>
      )}

      <div className="photo-card-body">
        <div className="photo-card-meta">
          <span className={`meta-pill${policyClass(clearance.tone)}`}>{clearance.label}</span>
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
        </dl>
      </div>
    </button>
  );
}
