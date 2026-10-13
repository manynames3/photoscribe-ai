import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signIn } from "../auth";
import { LoginPanel } from "./LoginPanel";

vi.mock("../auth", () => ({ signIn: vi.fn(), completeNewPassword: vi.fn() }));
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.resetAllMocks(); });

async function submitFailure(message: string) {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(signIn).mockRejectedValueOnce(new Error(message));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<LoginPanel authSession={null} onSignIn={vi.fn()} onSignOut={vi.fn()} />));
  cleanup = () => { act(() => root.unmount()); container.remove(); };
  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  return container;
}

describe("Staff sign-in announcements", () => {
  it("announces authentication failures as alerts", async () => {
    const container = await submitFailure("Incorrect username or password.");
    expect(container.querySelector("[role=alert]")?.textContent).toBe("Incorrect username or password.");
  });

  it("treats first-password setup as a next step, not an error", async () => {
    const container = await submitFailure("NEW_PASSWORD_REQUIRED");
    expect(container.querySelector("[role=alert]")).toBeNull();
    expect(container.querySelector("[role=status]")?.textContent).toContain("Choose a permanent password");
    expect(container.querySelector("input[autocomplete=new-password]")).not.toBeNull();
  });
});
