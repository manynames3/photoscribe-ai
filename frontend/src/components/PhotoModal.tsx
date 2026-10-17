import { FormEvent, useEffect, useRef, useState } from "react";

import { updateAssetPolicy } from "../api";
import { assetClearance } from "../assetClearance";
import type { AuthSession, PhotoResult } from "../types";

type PhotoModalProps = {
  authSession: AuthSession | null;
  canCurate: boolean;
  initialTab?: DossierTab;
  presentation?: "modal" | "inspector" | "review";
  onClose: () => void;
  onPhotoUpdated?: (photo: PhotoResult) => void;
  photo: PhotoResult | null;
};

type DossierTab = "overview" | "permissions" | "people" | "edit";

const POLICY_GROUPS = ["admin", "reviewer", "marketing", "hr", "compliance", "facilities"];

const DOSSIER_TABS: Array<{ key: DossierTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "permissions", label: "Permissions" },
  { key: "people", label: "People & tags" },
  { key: "edit", label: "Edit details" },
];

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
      return "Needs review";
    case "rejected":
      return "Not approved for use";
    case "missing_policy":
      return "Review details needed";
    case "unmanaged":
      return "Not reviewed yet";
    default:
      return "Review status missing";
  }
}

function accessCopy(visibility: string | undefined) {
  switch (visibility) {
    case "restricted":
      return "Restricted internal access";
    case "library":
      return "Shared hospital library";
    default:
      return "Access not set";
  }
}


function reviewReadiness(photo: PhotoResult) {
  const missingItems = [
    !photo.ownerDepartment && "owner department",
    (!photo.consentStatus || !["approved", "not_required"].includes(photo.consentStatus)) && "consent confirmation",
    (!photo.usageRights || !["internal_only", "public_release", "campaign_limited"].includes(photo.usageRights)) && "usage rights",
    photo.usageRights === "campaign_limited" && !photo.campaign?.trim() && "campaign",
    photo.expirationDate && photo.expirationDate < new Date().toISOString().slice(0, 10) && "renewed authorization",
    photo.peopleCount && photo.peopleCount > 0 && !photo.staffNames?.length && "visible people or staff names",
  ].filter(Boolean);

  if (!missingItems.length && photo.reviewStatus === "approved") {
    return "Ready for approved library use.";
  }

  if (!missingItems.length) {
    return "Review details are complete. Choose an approval decision.";
  }

  return `Needs ${missingItems.join(", ")} before broad reuse.`;
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

export function PhotoModal({ authSession, canCurate, initialTab = "overview", presentation = "modal", onClose, onPhotoUpdated, photo }: PhotoModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [activeDossierTab, setActiveDossierTab] = useState<DossierTab>("overview");
  const [campaign, setCampaign] = useState("");
  const [consentStatus, setConsentStatus] = useState("missing");
  const [curatorTags, setCuratorTags] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
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
        closeRef.current();
      }
      if (event.key === "Tab" && presentation === "modal") {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ) ?? []).filter((control) => control.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }
    }

    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>(".modal-close")?.focus({ preventScroll: true });
    const { overflow } = document.body.style;
    if (presentation === "modal") document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeydown);

    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", handleKeydown);
      previousFocus?.focus();
    };
  }, [photo?.key, presentation]);

  useEffect(() => {
    if (!photo) {
      return;
    }

    setCampaign(photo.campaign ?? "");
    setGroups(photo.allowedGroups ?? []);
    setConsentStatus(photo.consentStatus ?? "missing");
    setCuratorTags(joinValues(photo.curatorTags));
    setExpirationDate(photo.expirationDate ?? "");
    setLocation(photo.location ?? "");
    setOwnerDepartment(photo.ownerDepartment ?? "");
    setReviewStatus(photo.reviewStatus ?? "pending_review");
    setStaffNames(joinValues(photo.staffNames));
    setUsageRights(photo.usageRights ?? "unknown");
    setVisibility(photo.visibility ?? "library");
    setActiveDossierTab(initialTab === "edit" && !canCurate ? "overview" : initialTab);
    setTagStatus("");
  }, [photo?.key, initialTab, canCurate]);

  if (!photo) {
    return null;
  }

  async function handleTagSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!photo) {
      return;
    }

    if (!authSession) {
      setTagStatus("Sign in before updating photo details.");
      return;
    }

    if (reviewStatus === "approved" && (!["approved", "not_required"].includes(consentStatus) || !["internal_only", "public_release", "campaign_limited"].includes(usageRights) || (usageRights === "campaign_limited" && !campaign.trim()))) {
      setTagStatus("Confirm consent and usage rights before approving this photo.");
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
      const updatedPhoto = {
        ...photo,
        allowedGroups: result.groups.length ? result.groups : photo.allowedGroups,
        campaign: result.campaign,
        consentStatus: result.consentStatus,
        curatorTags: result.curatorTags,
        expirationDate: result.expirationDate,
        location: result.location,
        ownerDepartment: result.ownerDepartment,
        reviewStatus: result.reviewStatus,
        staffNames: result.staffNames,
        usageRights: result.usageRights,
        visibility: result.visibility,
      };
      onPhotoUpdated?.(updatedPhoto);
      setTagStatus("Photo details saved.");
    } catch (error) {
      setTagStatus(error instanceof Error ? error.message : "Tag update failed.");
    } finally {
      setIsSavingTags(false);
    }
  }

  function applyReviewPreset(preset: "approve" | "compliance" | "restrict") {
    if (preset === "approve") {
      if (!["approved", "not_required"].includes(consentStatus) || !["internal_only", "public_release", "campaign_limited"].includes(usageRights) || (usageRights === "campaign_limited" && !campaign.trim())) {
        setTagStatus("Confirm consent and usage rights before approving this photo.");
        return;
      }
      setReviewStatus("approved");
      setVisibility("library");
      setGroups(["admin", "reviewer", "marketing", "hr", "compliance", "facilities"]);
      return;
    }

    if (preset === "compliance") {
      setReviewStatus("pending_review");
      setVisibility("restricted");
      setGroups(["admin", "reviewer", "compliance"]);
      return;
    }

    setReviewStatus("rejected");
    setVisibility("restricted");
    setUsageRights("do_not_use");
    setGroups(["admin", "reviewer", "compliance"]);
  }

  return (
    <div
      aria-modal={presentation === "modal" ? true : undefined}
      aria-labelledby="photo-detail-title"
      ref={dialogRef}
      className={`modal-backdrop photo-${presentation}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
    >
      <div className={`modal-panel${activeDossierTab === "edit" ? " is-editing" : ""}`}>
        <button className="modal-close" onClick={onClose} type="button">
          {presentation === "review" ? "Close photo" : "Close"}
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
          <div className="dossier-header">
            <div className="photo-card-meta">
              <span className={`meta-pill is-${assetClearance(photo).tone}`}>{assetClearance(photo).label}</span>
              <span className="meta-subtle">{labelize(photo.sceneType)}</span>
              <span className="meta-subtle">{accessCopy(photo.visibility)}</span>
            </div>

            <h3 id="photo-detail-title">{photo.seoCaption || photo.description}</h3>
            {photo.imageUrl ? <a className="photo-full-size" href={photo.imageUrl} target="_blank" rel="noreferrer">View full size</a> : null}
            {presentation === "inspector" && canCurate && assetClearance(photo).tone !== "approved" && activeDossierTab !== "edit" ? (
              <button className="inspector-resolve" type="button" onClick={() => setActiveDossierTab("edit")}>Resolve review</button>
            ) : null}
            {activeDossierTab !== "edit" ? <p>{photo.description}</p> : null}
          </div>

          <div className="dossier-tabs" role="group" aria-label="Photo details sections">
            {DOSSIER_TABS.filter((tab) => tab.key !== "edit" || canCurate).map((tab) => (
              <button
                aria-pressed={activeDossierTab === tab.key}
                className={activeDossierTab === tab.key ? "is-active" : ""}
                key={tab.key}
                onClick={() => setActiveDossierTab(tab.key)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeDossierTab === "overview" ? (
            <div className="dossier-section">
              <div className="use-guidance">
                <div>
                  <span>Recommended use</span>
                  <strong>{assetClearance(photo).reason}</strong>
                </div>
                <div>
                  <span>Owner department</span>
                  <strong>{photo.ownerDepartment || "Unassigned"}</strong>
                </div>
                <div>
                  <span>Review readiness</span>
                  <strong>{reviewReadiness(photo)}</strong>
                </div>
              </div>

              <dl className="metadata-grid">
                <div>
                  <dt>Review status</dt>
                  <dd>{approvalCopy(photo.reviewStatus)}</dd>
                </div>
                <div>
                  <dt>Access level</dt>
                  <dd>{accessCopy(photo.visibility)}</dd>
                </div>
                <div>
                  <dt>Owner department</dt>
                  <dd>{photo.ownerDepartment || "Unassigned"}</dd>
                </div>
                <div>
                  <dt>Campaign</dt>
                  <dd>{photo.campaign || "None assigned"}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          {activeDossierTab === "permissions" ? (
            <dl className="metadata-grid dossier-section">
              <div>
                <dt>Review status</dt>
                <dd>{approvalCopy(photo.reviewStatus)}</dd>
              </div>
              <div>
                <dt>Who can use it</dt>
                <dd>{accessCopy(photo.visibility)}</dd>
              </div>
              <div>
                <dt>Consent</dt>
                <dd>{labelize(photo.consentStatus)}</dd>
              </div>
              <div>
                <dt>Usage rights</dt>
                <dd>{labelize(photo.usageRights)}</dd>
              </div>
              <div>
                <dt>Expiration</dt>
                <dd>{photo.expirationDate || "No expiration assigned"}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{photo.location || "Location not assigned"}</dd>
              </div>
            </dl>
          ) : null}

          {activeDossierTab === "people" ? (
            <dl className="metadata-grid dossier-section">
              <div>
                <dt>People visible</dt>
                <dd>{typeof photo.peopleCount === "number" ? photo.peopleCount : "Not counted"}</dd>
              </div>
              <div>
                <dt>Staff names</dt>
                <dd>{photo.staffNames?.length ? photo.staffNames.join(", ") : "No staff assigned"}</dd>
              </div>
              <div>
                <dt>Photo type</dt>
                <dd>{labelize(photo.sceneType)}</dd>
              </div>
              <div>
                <dt>Image condition</dt>
                <dd>{labelize(photo.lighting)}</dd>
              </div>
              <div>
                <dt>Accessibility caption</dt>
                <dd>{photo.altText}</dd>
              </div>
              <div>
                <dt>Content labels</dt>
                <dd>{photo.subjects?.length ? photo.subjects.slice(0, 8).join(", ") : "No labels assigned"}</dd>
              </div>
            </dl>
          ) : null}

          {canCurate && activeDossierTab === "edit" ? (
          <form className="curator-panel" onSubmit={handleTagSubmit}>
            <fieldset className="curator-field-grid curator-clearance">
              <legend>Clearance and decision</legend>
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
              <label>
                <span>Review status</span>
                <select onChange={(event) => setReviewStatus(event.target.value)} value={reviewStatus}>
                  <option value="pending_review">Pending review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label>
                <span>Visibility</span>
                <select onChange={(event) => setVisibility(event.target.value)} value={visibility}>
                  <option value="library">Shared library</option>
                  <option value="restricted">Restricted</option>
                </select>
              </label>
            </fieldset>

            <div className="review-preset-grid" aria-label="Review decision shortcuts">
              <button onClick={() => applyReviewPreset("approve")} type="button">
                <strong>Approve for library</strong>
                <span>Share with the library; keep recorded rights.</span>
              </button>
              <button onClick={() => applyReviewPreset("compliance")} type="button">
                <strong>Send to compliance</strong>
                <span>Limit access; keep recorded consent and rights.</span>
              </button>
              <button onClick={() => applyReviewPreset("restrict")} type="button">
                <strong>Do not use</strong>
                <span>Restrict access and replace rights with Do not use.</span>
              </button>
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

            <div>
              <span className="curator-field-label">Who can see restricted photos</span>
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

            <div className="curator-save-bar">
              <button className="search-button" disabled={isSavingTags || photo.source !== "api"} type="submit">
                {isSavingTags ? "Saving..." : "Save review decision"}
              </button>
              {tagStatus ? <p className="curator-status" role="status">{tagStatus}</p> : null}
              {photo.source !== "api" ? <p className="curator-status">Editing is available for private library photos.</p> : null}
            </div>
          </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
