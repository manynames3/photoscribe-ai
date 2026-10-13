import type { PhotoResult } from "./types";

export function assetClearance(photo: PhotoResult) {
  if (photo.reviewStatus === "rejected" || photo.usageRights === "do_not_use")
    return { label: "Do not use", tone: "risk", reason: "Not cleared for reuse. A reviewer must confirm the asset policy." };
  if (photo.expirationDate && photo.expirationDate < new Date().toISOString().slice(0, 10))
    return { label: "Expired", tone: "risk", reason: "Usage authorization has expired. Request a policy review." };
  if (!photo.consentStatus || !["approved", "not_required"].includes(photo.consentStatus))
    return { label: "Consent review", tone: "risk", reason: "Consent is missing or restricted. Confirm permitted use with a reviewer." };
  if (photo.reviewStatus !== "approved" || !photo.usageRights || !["internal_only", "public_release", "campaign_limited"].includes(photo.usageRights) || (photo.usageRights === "campaign_limited" && !photo.campaign?.trim()))
    return { label: "Needs review", tone: "warning", reason: "Usage rights or approval are not confirmed. Request a policy review before reuse." };
  if (photo.visibility === "restricted")
    return { label: "Restricted", tone: "warning", reason: "Restricted access. Confirm the intended use with the asset owner." };
  if (photo.usageRights === "campaign_limited")
    return { label: "Campaign only", tone: "approved", reason: `Use is limited to the recorded campaign: ${photo.campaign}. Other uses require review.` };
  return {
    label: photo.usageRights === "internal_only" ? "Internal only" : "Cleared for release",
    tone: "approved",
    reason: photo.usageRights === "internal_only" ? "Internal use only. External sharing requires a separate review." : "Public release permitted under the recorded asset policy.",
  };
}
