import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authStorage = {
  token: "photoscribe.authToken",
  email: "photoscribe.authEmail",
  groups: "photoscribe.authGroups",
};

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

async function renderApp(path = "/app") {
  vi.resetModules();
  vi.stubEnv("VITE_API_URL", "");
  window.history.pushState({}, "", path);

  const { App } = await import("./App");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });

  await act(async () => {
    root.render(<App />);
  });
  await flushEffects();

  return container;
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

function signInAsStaff() {
  window.localStorage.setItem(authStorage.token, "test-token");
  window.localStorage.setItem(authStorage.email, "admin@briar.example");
  window.localStorage.setItem(authStorage.groups, JSON.stringify(["admin"]));
}

describe("App workspace access", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const { root, container } of mountedRoots.splice(0)) {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
    document.body.innerHTML = "";
    window.localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.doUnmock("./api");
  });

  it("does not show search, filters, or photos before staff sign-in", async () => {
    const container = await renderApp();

    expect(container.textContent).toContain("Briar University Hospital");
    expect(container.textContent).toContain("Staff sign in");
    expect(container.querySelector(".cf-brand-symbol")).not.toBeNull();
    expect(container.textContent).not.toContain("Private by default");
    expect(container.textContent).not.toMatch(/\bdemo\b/i);
    expect(container.textContent).not.toContain("Sample data");
    expect(container.querySelector(".login-panel")).not.toBeNull();
    expect(container.querySelector("[aria-label='Search photos']")).toBeNull();
    expect(container.querySelector(".search-form")).toBeNull();
    expect(container.querySelector(".sidebar-panel")).toBeNull();
    expect(container.querySelector(".results-panel")).toBeNull();
    expect(container.querySelector(".photo-card")).toBeNull();
  });

  it("shows the searchable library after staff sign-in", async () => {
    signInAsStaff();

    const container = await renderApp();
    await flushEffects();
    await flushEffects();

    expect(container.querySelector(".workspace-access-page")).toBeNull();
    expect(container.querySelector(".workspace-v2")).not.toBeNull();
    expect(container.querySelector("[aria-label='Search photos']")).not.toBeNull();
    expect(container.querySelector(".sidebar-panel")).not.toBeNull();
    expect(container.querySelector(".results-panel")).not.toBeNull();
    expect(container.textContent).toContain("Sample data");
    expect(container.querySelectorAll(".photo-card").length).toBeGreaterThan(0);
  });

  it("keeps staff tools in focused workspace views", async () => {
    signInAsStaff();

    const container = await renderApp();
    await flushEffects();

    expect(container.querySelector(".upload-panel")).toBeNull();
    expect(container.querySelector(".results-panel")).not.toBeNull();

    const uploadButton = Array.from(container.querySelectorAll<HTMLButtonElement>(".workspace-sidebar button")).find(
      (button) => button.textContent === "Upload",
    );
    expect(uploadButton).toBeDefined();

    await act(async () => {
      uploadButton?.click();
    });

    expect(container.querySelector(".upload-panel")).not.toBeNull();
    expect(container.querySelector(".results-panel")).toBeNull();
    expect(container.querySelector(".ops-panel")).toBeNull();
  });

  it("preserves selected uploads across workspace navigation", async () => {
    signInAsStaff();
    const container = await renderApp("/app#upload");
    const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
    Object.defineProperty(input, "files", { value: [new File(["photo"], "campus.jpg", { type: "image/jpeg" })] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    const nav = Array.from(container.querySelectorAll<HTMLButtonElement>(".workspace-sidebar button"));
    await act(async () => nav.find((button) => button.textContent === "Library")!.click());
    expect(container.querySelector(".upload-panel")?.closest("[hidden]")).not.toBeNull();
    await act(async () => nav.find((button) => button.textContent === "Upload")!.click());
    expect(container.querySelector(".upload-list")?.textContent).toContain("campus.jpg");
    expect(window.location.hash).toBe("#upload");
  });

  it("closes private photo details when the session expires", async () => {
    signInAsStaff();
    const container = await renderApp();
    await act(async () => container.querySelector<HTMLButtonElement>(".photo-card")!.click());
    expect(container.querySelector("[role=dialog]")).not.toBeNull();
    await act(async () => window.dispatchEvent(new Event("photoscribe:session-expired")));
    expect(container.querySelector("[role=dialog]")).toBeNull();
    expect(container.querySelector(".workspace-access-page")).not.toBeNull();
    expect(window.localStorage.getItem(authStorage.token)).toBeNull();
  });

  it("guards direct access links by role", async () => {
    signInAsStaff();
    window.localStorage.setItem(authStorage.groups, JSON.stringify(["marketing"]));
    const container = await renderApp("/app#access");
    expect(container.querySelector(".results-panel")).not.toBeNull();
    expect(container.querySelector(".ops-panel")).toBeNull();
    expect(Array.from(container.querySelectorAll(".workspace-sidebar button")).map((button) => button.textContent)).toEqual(["Library", "Upload"]);
  });

  it("ignores a slower response after a newer search completes", async () => {
    let finishFirst!: (value: unknown) => void;
    let finishSecond!: (value: unknown) => void;
    const first = new Promise((resolve) => { finishFirst = resolve; });
    const second = new Promise((resolve) => { finishSecond = resolve; });
    const response = (query: string) => ({ query, results: [], mode: "preview", message: "Search complete." });
    vi.doMock("./api", () => ({
      searchPhotos: vi.fn((query: string) => query === "approved campaign assets" ? first :
        query === "hospital executive headshot" ? second : Promise.resolve(response(query))),
    }));
    signInAsStaff();
    const container = await renderApp();
    const shortcuts = Array.from(container.querySelectorAll<HTMLButtonElement>(".request-chip"));
    await act(async () => shortcuts.find((button) => button.textContent === "Campaign photos")!.click());
    await act(async () => shortcuts.find((button) => button.textContent === "Staff headshots")!.click());
    await act(async () => finishSecond(response("Newest headshots")));
    await act(async () => finishFirst(response("Stale campaign")));
    expect(container.querySelector(".results-summary h2")?.textContent).toContain("Newest headshots");
    expect(container.querySelector(".results-summary h2")?.textContent).not.toContain("Stale campaign");
  });

  it.each(["closed", "expired"])("does not reopen a %s photo dialog after a delayed save", async (action) => {
    let finishSave!: (value: unknown) => void;
    const save = new Promise((resolve) => { finishSave = resolve; });
    const photo = { id: "qa", key: "qa.jpg", description: "QA campus", seoCaption: "QA campus", altText: "QA campus",
      lighting: "studio", mood: "neutral", sceneType: "architectural", timeOfDay: "day", source: "api",
      reviewStatus: "approved", consentStatus: "not_required", usageRights: "internal_only", visibility: "library", ownerDepartment: "Communications" };
    vi.doMock("./api", () => ({
      searchPhotos: vi.fn((query: string) => Promise.resolve({ query, results: [photo], mode: "api", message: "Search complete." })),
      updateAssetPolicy: vi.fn(() => save),
    }));
    signInAsStaff();
    const container = await renderApp();
    await act(async () => container.querySelector<HTMLButtonElement>(".photo-card")!.click());
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Edit details")!.click());
    await act(async () => container.querySelector(".curator-panel")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await act(async () => {
      if (action === "expired") window.dispatchEvent(new Event("photoscribe:session-expired"));
      else container.querySelector<HTMLButtonElement>(".modal-close")!.click();
    });
    await act(async () => finishSave({ ...photo, groups: ["admin"], campaign: "QA", curatorTags: [], staffNames: [], expirationDate: "", location: "" }));
    expect(container.querySelector("[role=dialog]")).toBeNull();
    if (action === "expired") expect(container.querySelector(".workspace-access-page")).not.toBeNull();
  });
});
