import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PhotoModal } from "./PhotoModal";
import type { PhotoResult } from "../types";
import { assetClearance } from "../assetClearance";

const photo: PhotoResult = {
  id: "photo", key: "photo", description: "Campus", seoCaption: "Campus", altText: "Campus",
  lighting: "studio", mood: "neutral", sceneType: "architectural", timeOfDay: "day", source: "api",
  reviewStatus: "approved", consentStatus: "missing", usageRights: "unknown", visibility: "library",
};
let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

async function renderPhoto(record = photo, initialTab: "overview" | "edit" = "overview", canCurate = true) {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<PhotoModal photo={record} authSession={{email:"staff@example.test", groups:["reviewer"], idToken:"token"}} canCurate={canCurate} initialTab={initialTab} onClose={() => undefined} />));
  cleanup = () => { act(() => root.unmount()); container.remove(); };
  return container;
}

describe("Photo policy guidance", () => {
  it("opens review decisions directly without exposing edit tools to non-reviewers", async () => {
    const container = await renderPhoto(photo, "edit");
    expect(container.querySelector(".curator-panel")).not.toBeNull();
    expect(container.querySelector(".curator-save-bar button")?.textContent).toBe("Save review decision");
  });

  it("ignores the edit entry point when the user cannot curate", async () => {
    const container = await renderPhoto(photo, "edit", false);
    expect(container.querySelector(".curator-panel")).toBeNull();
    expect(container.querySelector(".use-guidance")).not.toBeNull();
  });

  it("preserves recorded consent and rights when referring a photo to compliance", async () => {
    const container = await renderPhoto({ ...photo, consentStatus: "approved", usageRights: "public_release" }, "edit");
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("Send to compliance"))!.click());
    const values = Array.from(container.querySelectorAll<HTMLSelectElement>("select")).map((select) => select.value);
    expect(values).toContain("approved");
    expect(values).toContain("public_release");
    expect(values).toContain("pending_review");
    expect(values).toContain("restricted");
  });

  it("does not invent consent or rights when approving", async () => {
    const container = await renderPhoto();
    expect(container.textContent).toContain("Consent is missing or restricted");
    const buttons = () => Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
    await act(async () => buttons().find((button) => button.textContent === "Edit details")!.click());
    await act(async () => buttons().find((button) => button.textContent?.includes("Approve for library"))!.click());
    expect(container.textContent).toContain("Confirm consent and usage rights before approving");
    expect(Array.from(container.querySelectorAll<HTMLSelectElement>("select")).map((select) => select.value)).toContain("missing");
    expect(Array.from(container.querySelectorAll<HTMLSelectElement>("select")).map((select) => select.value)).toContain("unknown");
  });

  it("does not recommend reuse after authorization expires", async () => {
    const container = await renderPhoto({ ...photo, consentStatus:"approved", usageRights:"public_release", expirationDate:"2000-01-01" });
    expect(container.textContent).toContain("Usage authorization has expired");
    expect(container.querySelector("[role=dialog]")?.getAttribute("aria-labelledby")).toBe("photo-detail-title");
    expect(document.activeElement?.className).toBe("modal-close");
  });

  it("loads the saved role access instead of replacing it with defaults", async () => {
    const container = await renderPhoto({ ...photo, allowedGroups: ["compliance", "facilities"] });
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Edit details")!.click());
    const selected = Array.from(container.querySelectorAll<HTMLButtonElement>(".filter-pill[aria-pressed=true]")).map((button) => button.textContent);
    expect(selected).toEqual(["compliance", "facilities"]);
  });

  it("limits campaign permission to a named campaign", () => {
    expect(assetClearance({ ...photo, consentStatus: "approved", usageRights: "campaign_limited", campaign: "Outreach" }).label).toBe("Campaign only");
    expect(assetClearance({ ...photo, consentStatus: "approved", usageRights: "campaign_limited", campaign: "" }).label).toBe("Needs review");
  });

  it("recognizes complete campaign-only details without suggesting broader rights", async () => {
    const container = await renderPhoto({ ...photo, ownerDepartment: "Communications", consentStatus: "not_required", usageRights: "campaign_limited", campaign: "Outreach" });
    expect(container.querySelector(".use-guidance")?.textContent).toContain("Ready for approved library use.");
    expect(container.textContent).toContain("Campaign only");
  });
});
