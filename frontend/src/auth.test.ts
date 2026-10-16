import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  confirmPassword: vi.fn(),
  forgotPassword: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  userOptions: vi.fn(),
}));
vi.mock("amazon-cognito-identity-js", () => ({
  AuthenticationDetails: vi.fn(),
  CognitoUser: class {
    constructor(options: unknown) { sdk.userOptions(options); }
    forgotPassword(callbacks: unknown) { sdk.forgotPassword(callbacks); }
    confirmPassword(code: unknown, password: unknown, callbacks: unknown) {
      sdk.confirmPassword(code, password, callbacks);
    }
  },
  CognitoUserPool: class {
    getCurrentUser() { return sdk; }
  },
}));

const token = `header.${btoa(JSON.stringify({ email: "qa@briar.example", "cognito:groups": ["reviewer"] }))}.signature`;
const session = { isValid: () => true, getIdToken: () => ({ getJwtToken: () => token }) };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_COGNITO_CLIENT_ID", "test-client");
  vi.stubEnv("VITE_COGNITO_USER_POOL_ID", "test-pool");
  window.localStorage.clear();
});
afterEach(() => { vi.unstubAllEnvs(); window.localStorage.clear(); });

describe("Staff session refresh", () => {
  it("shares one SDK refresh across concurrent private requests", async () => {
    const auth = await import("./auth");
    const first = auth.refreshAuthToken();
    expect(auth.refreshAuthToken()).toBe(first);
    expect(sdk.getSession).toHaveBeenCalledTimes(1);
    sdk.getSession.mock.calls[0]![0](null, session);
    expect(await first).toBe(token);
    expect(window.localStorage.getItem("photoscribe.authToken")).toBe(token);
  });

  it("does not let an old refresh restore or invalidate a new staff session", async () => {
    const auth = await import("./auth");
    const oldRefresh = auth.refreshAuthToken();
    const oldCallback = sdk.getSession.mock.calls[0]![0];
    auth.signOut();
    const newRefresh = auth.refreshAuthToken();
    expect(sdk.getSession).toHaveBeenCalledTimes(2);
    oldCallback(null, session);
    expect(await oldRefresh).toBeNull();
    expect(window.localStorage.getItem("photoscribe.authToken")).toBeNull();
    expect(auth.refreshAuthToken()).toBe(newRefresh);
    sdk.getSession.mock.calls[1]![0](null, session);
    expect(await newRefresh).toBe(token);
  });
});

describe("Staff password recovery", () => {
  it("requests a recovery code for the normalized email address", async () => {
    const auth = await import("./auth");
    const request = auth.requestPasswordReset(" Staff@Briar.Example ");
    const [options] = sdk.forgotPassword.mock.calls[0]!;

    expect(options.inputVerificationCode).toBeTypeOf("function");
    expect(options.onFailure).toBeTypeOf("function");
    expect(options.onSuccess).toBeTypeOf("function");
    expect(sdk.userOptions).toHaveBeenCalledWith({
      Pool: expect.anything(),
      Username: "staff@briar.example",
    });
    expect(sdk.forgotPassword).toHaveBeenCalledTimes(1);

    options.inputVerificationCode();
    await expect(request).resolves.toBeUndefined();
  });

  it("confirms a code and new password through Cognito", async () => {
    const auth = await import("./auth");
    const reset = auth.confirmPasswordReset(" Staff@Briar.Example ", " 123456 ", "Strong!HospitalPass2026");
    const [code, password, callbacks] = sdk.confirmPassword.mock.calls[0]!;

    expect(code).toBe("123456");
    expect(password).toBe("Strong!HospitalPass2026");
    expect(callbacks.onFailure).toBeTypeOf("function");
    callbacks.onSuccess();
    await expect(reset).resolves.toBeUndefined();
  });
});
