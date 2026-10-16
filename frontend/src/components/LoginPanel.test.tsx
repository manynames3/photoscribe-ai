import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmPasswordReset, requestPasswordReset, signIn } from "../auth";
import { LoginPanel } from "./LoginPanel";

vi.mock("../auth", () => ({
  completeNewPassword: vi.fn(),
  confirmPasswordReset: vi.fn(),
  requestPasswordReset: vi.fn(),
  signIn: vi.fn(),
}));
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.resetAllMocks(); });

async function renderLoginPanel() {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<LoginPanel authSession={null} onSignIn={vi.fn()} onSignOut={vi.fn()} />));
  cleanup = () => { act(() => root.unmount()); container.remove(); };
  return container;
}

async function clickButton(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  await act(async () => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

async function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("Input value setter is unavailable.");
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submitForm(container: HTMLElement) {
  const form = container.querySelector("form");
  if (!form) throw new Error("Login form not found.");
  await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

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

  it("lets staff request a code and reset their password", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValueOnce(undefined);
    vi.mocked(confirmPasswordReset).mockResolvedValueOnce(undefined);
    const container = await renderLoginPanel();

    await clickButton(container, "Forgot password?");
    await setInputValue(container.querySelector('input[type="email"]')!, "staff@briar.example");
    await submitForm(container);

    expect(requestPasswordReset).toHaveBeenCalledWith("staff@briar.example");
    expect(container.querySelector("input[autocomplete=one-time-code]")).not.toBeNull();
    expect(container.querySelector("[role=status]")?.textContent).toContain("If an account exists");

    const codeInput = container.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!;
    await setInputValue(codeInput, "111111");
    await clickButton(container, "Send a new code");
    expect(requestPasswordReset).toHaveBeenCalledTimes(2);
    expect(codeInput.value).toBe("");

    await setInputValue(codeInput, "123456");
    const passwordInputs = container.querySelectorAll<HTMLInputElement>('input[type="password"]');
    await setInputValue(passwordInputs[0]!, "Strong!HospitalPass2026");
    await setInputValue(passwordInputs[1]!, "NotTheSamePass2026!");
    await submitForm(container);

    expect(confirmPasswordReset).not.toHaveBeenCalled();
    expect(container.querySelector("[role=alert]")?.textContent).toBe("The passwords do not match.");

    await setInputValue(passwordInputs[1]!, "Strong!HospitalPass2026");
    await submitForm(container);

    expect(confirmPasswordReset).toHaveBeenCalledWith("staff@briar.example", "123456", "Strong!HospitalPass2026");
    expect(container.querySelector("[role=status]")?.textContent).toContain("Password updated");
    expect(container.querySelector('input[autocomplete="current-password"]')).not.toBeNull();
  });

  it("does not reveal whether an email belongs to a staff account", async () => {
    vi.mocked(requestPasswordReset).mockRejectedValueOnce(
      Object.assign(new Error("User does not exist"), { code: "UserNotFoundException" }),
    );
    const container = await renderLoginPanel();

    await clickButton(container, "Forgot password?");
    await setInputValue(container.querySelector('input[type="email"]')!, "unknown@briar.example");
    await submitForm(container);

    expect(container.querySelector("input[autocomplete=one-time-code]")).not.toBeNull();
    expect(container.querySelector("[role=status]")?.textContent).toContain("If an account exists");
    expect(container.textContent).not.toContain("User does not exist");
  });
});
