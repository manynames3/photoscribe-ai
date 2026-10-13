import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { LandingPage } from "./LandingPage";

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

async function renderLanding() {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<LandingPage onWorkspace={() => undefined} contactEmail="" />));
  cleanup = () => { act(() => root.unmount()); container.remove(); };
  return container;
}

async function fillInput(container: HTMLElement, name: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`input[name=${name}]`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("Public pilot page", () => {
  it("closes the mobile menu on Escape and returns focus", async () => {
    const container = await renderLanding();
    const button = container.querySelector<HTMLButtonElement>(".cfl-menu-button")!;
    await act(async () => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("true");
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("validates requests and never claims an unconfigured request was sent", async () => {
    const container = await renderLanding();
    const submit = async () => act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await submit();
    expect(document.activeElement).toBe(container.querySelector("input[name=name]"));
    expect(container.querySelector("input[name=email]")?.getAttribute("aria-invalid")).toBe("true");
    await fillInput(container, "name", "Pilot QA");
    await fillInput(container, "email", "qa@briar.example");
    await fillInput(container, "hospital", "Briar University Hospital");
    await submit();
    expect(container.textContent).toContain("Request prepared; it has not been sent.");
    expect(container.querySelector<HTMLTextAreaElement>("#cfl-summary")?.value).toContain("Briar University Hospital");
    await fillInput(container, "hospital", "Changed request");
    expect(container.querySelector("#cfl-summary")).toBeNull();
  });
});
