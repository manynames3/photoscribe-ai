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
  });

  it("does not show search, filters, or photos before staff sign-in", async () => {
    const container = await renderApp();

    expect(container.textContent).toContain("Briar University Hospital");
    expect(container.textContent).toContain(
      "Staff sign-in is required before any media library content is shown.",
    );
    expect(container.textContent).not.toMatch(/\bdemo\b/i);
    expect(container.textContent).not.toContain("Local sample data");
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

    expect(container.querySelector(".locked-library-panel")).toBeNull();
    expect(container.querySelector("[aria-label='Search photos']")).not.toBeNull();
    expect(container.querySelector(".sidebar-panel")).not.toBeNull();
    expect(container.querySelector(".results-panel")).not.toBeNull();
    expect(container.textContent).toContain("Local sample data");
    expect(container.querySelectorAll(".photo-card").length).toBeGreaterThan(0);
  });
});
