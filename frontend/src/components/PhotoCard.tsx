import type { PhotoResult } from "../types";
import { assetClearance } from "../assetClearance";

type PhotoCardProps = {
  onOpen: (result: PhotoResult) => void;
  result: PhotoResult;
  selected?: boolean;
};

function labelize(value: string | undefined) {
  return value ? value.replace(/_/g, " ") : "not classified";
}

export function PhotoCard({ onOpen, result, selected = false }: PhotoCardProps) {
  const department = result.ownerDepartment || "Unassigned";
  const consent = result.consentStatus || "missing";
  const usageRights = result.usageRights || "unknown";
  const clearance = assetClearance(result);

  return (
    <button
      className="photo-card"
      aria-pressed={selected}
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
          <span className={`meta-pill is-${clearance.tone}`}>{clearance.label}</span>
          <span className="meta-subtle">{labelize(result.sceneType)}</span>
        </div>
        <p className="photo-description">{result.seoCaption || result.description}</p>
        <p className="photo-owner">{department}</p>
        {clearance.tone !== "approved" ? <span className="photo-resolve">Review details <span aria-hidden="true">&rarr;</span></span> : null}
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
