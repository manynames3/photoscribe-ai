import { FormEvent, useEffect, useState } from "react";

import { updateAssetPolicy } from "../api";
import type { AuthSession, PhotoResult } from "../types";

type PhotoModalProps = {
  authSession: AuthSession | null;
  canCurate: boolean;
  onClose: () => void;
  photo: PhotoResult | null;
};

const POLICY_GROUPS = ["admin", "reviewer", "marketing", "hr", "compliance", "facilities"];

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

function joinValues(values: string[] | undefined) {
  return values?.join(", ") ?? "";
}

function splitValues(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function PhotoModal({ authSession, canCurate, onClose, photo }: PhotoModalProps) {
  const [campaign, setCampaign] = useState("");
  const [consentStatus, setConsentStatus] = useState("missing");
  const [curatorTags, setCuratorTags] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [groups, setGroups] = useState<string[]>(["admin", "reviewer"]);
  const [location, setLocation] = useState("");
  const [ownerDepartment, setOwnerDepartment] = useState("");
  const [reviewStatus, setReviewStatus] = useState("pending_review");
  const [staffNames, setStaffNames] = useState("");
  const [usageRights, setUsageRights] = useState("unknown");
  const [visibility, setVisibility] = useState("library");
  const [tagStatus, setTagStatus] = useState("");
  const [isSavingTags, setIsSavingTags] = useState(false);

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

  useEffect(() => {
    if (!photo) {
      return;
    }

    setCampaign(photo.campaign ?? "");
    setConsentStatus(photo.consentStatus ?? "missing");
    setCuratorTags(joinValues(photo.curatorTags));
    setExpirationDate(photo.expirationDate ?? "");
    setLocation(photo.location ?? "");
    setOwnerDepartment(photo.ownerDepartment ?? "");
    setReviewStatus(photo.reviewStatus ?? "pending_review");
    setStaffNames(joinValues(photo.staffNames));
    setUsageRights(photo.usageRights ?? "unknown");
    setVisibility(photo.visibility ?? "library");
    setTagStatus("");
  }, [photo]);

  if (!photo) {
    return null;
  }

  async function handleTagSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!photo) {
      return;
    }

    if (!authSession) {
      setTagStatus("Sign in before updating asset policy.");
      return;
    }

    setIsSavingTags(true);
    setTagStatus("");

    try {
      const result = await updateAssetPolicy({
        campaign,
        consentStatus,
        curatorTags: splitValues(curatorTags),
        expirationDate,
        groups,
        key: photo.s3Key ?? photo.key,
        location,
        ownerDepartment,
        reviewStatus,
        staffNames: splitValues(staffNames),
        usageRights,
        visibility,
      });
      setCampaign(result.campaign);
      setConsentStatus(result.consentStatus);
      setCuratorTags(joinValues(result.curatorTags));
      setExpirationDate(result.expirationDate);
      setGroups(result.groups.length ? result.groups : groups);
      setLocation(result.location);
      setOwnerDepartment(result.ownerDepartment);
      setReviewStatus(result.reviewStatus);
      setStaffNames(joinValues(result.staffNames));
      setUsageRights(result.usageRights);
      setVisibility(result.visibility);
      setTagStatus("Asset policy saved. Search, review, and role access now use these fields.");
    } catch (error) {
      setTagStatus(error instanceof Error ? error.message : "Tag update failed.");
    } finally {
      setIsSavingTags(false);
    }
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

        <div className="modal-media">
          {photo.imageUrl ? (
            <img alt={photo.altText} className="modal-image" src={photo.imageUrl} />
          ) : (
            <div className="modal-image photo-thumb-preview">
              <span>{photo.sceneType}</span>
            </div>
          )}
        </div>

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
            <div>
              <dt>Department</dt>
              <dd>{photo.ownerDepartment || "Unassigned"}</dd>
            </div>
            <div>
              <dt>Usage rights</dt>
              <dd>{labelize(photo.usageRights)}</dd>
            </div>
            <div>
              <dt>Consent</dt>
              <dd>{labelize(photo.consentStatus)}</dd>
            </div>
            <div>
              <dt>Campaign</dt>
              <dd>{photo.campaign || "None assigned"}</dd>
            </div>
          </dl>

          {canCurate ? (
          <form className="curator-panel" onSubmit={handleTagSubmit}>
            <div>
              <p className="sidebar-label">Curator tools</p>
              <h4>Review and classify asset</h4>
              <p>
                Add human context the AI cannot know, then approve, restrict, or reject the asset
                before broader department use.
              </p>
            </div>

            <div className="curator-field-grid">
              <label>
                <span>Owner department</span>
                <input
                  onChange={(event) => setOwnerDepartment(event.target.value)}
                  placeholder="Marketing, HR, Compliance"
                  value={ownerDepartment}
                />
              </label>
              <label>
                <span>Campaign</span>
                <input
                  onChange={(event) => setCampaign(event.target.value)}
                  placeholder="Annual report 2026"
                  value={campaign}
                />
              </label>
              <label>
                <span>Location</span>
                <input
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Cardiology clinic, Building A"
                  value={location}
                />
              </label>
              <label>
                <span>Expiration date</span>
                <input onChange={(event) => setExpirationDate(event.target.value)} type="date" value={expirationDate} />
              </label>
            </div>

            <label>
              <span>Staff names</span>
              <input
                autoComplete="off"
                onChange={(event) => setStaffNames(event.target.value)}
                placeholder="Dr. Maya Chen, James Carter"
                value={staffNames}
              />
            </label>

            <label>
              <span>Searchable tags</span>
              <input
                autoComplete="off"
                onChange={(event) => setCuratorTags(event.target.value)}
                placeholder="cardiology, annual report, approved headshot"
                value={curatorTags}
              />
            </label>

            <label>
              <span>Review status</span>
              <select onChange={(event) => setReviewStatus(event.target.value)} value={reviewStatus}>
                <option value="pending_review">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>

            <div className="curator-field-grid">
              <label>
                <span>Visibility</span>
                <select onChange={(event) => setVisibility(event.target.value)} value={visibility}>
                  <option value="library">Shared library</option>
                  <option value="restricted">Restricted</option>
                </select>
              </label>
              <label>
                <span>Consent status</span>
                <select onChange={(event) => setConsentStatus(event.target.value)} value={consentStatus}>
                  <option value="missing">Missing</option>
                  <option value="approved">Approved</option>
                  <option value="not_required">Not required</option>
                  <option value="restricted">Restricted</option>
                  <option value="expired">Expired</option>
                </select>
              </label>
              <label>
                <span>Usage rights</span>
                <select onChange={(event) => setUsageRights(event.target.value)} value={usageRights}>
                  <option value="unknown">Unknown</option>
                  <option value="internal_only">Internal only</option>
                  <option value="public_release">Public release</option>
                  <option value="campaign_limited">Campaign limited</option>
                  <option value="do_not_use">Do not use</option>
                </select>
              </label>
            </div>

            <div>
              <span className="curator-field-label">Allowed roles when restricted</span>
              <div className="filter-pill-row">
                {POLICY_GROUPS.map((group) => (
                  <button
                    key={group}
                    aria-pressed={groups.includes(group)}
                    className={`filter-pill${groups.includes(group) ? " is-active" : ""}`}
                    onClick={() => {
                      setGroups((currentGroups) =>
                        currentGroups.includes(group)
                          ? currentGroups.filter((item) => item !== group)
                          : [...currentGroups, group],
                      );
                    }}
                    type="button"
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>

            <button className="search-button" disabled={isSavingTags || photo.source !== "api"} type="submit">
              {isSavingTags ? "Saving..." : "Save review decision"}
            </button>

            {tagStatus ? <p className="curator-status">{tagStatus}</p> : null}
            {photo.source !== "api" ? <p className="curator-status">Tag editing is available on live API assets.</p> : null}
          </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
