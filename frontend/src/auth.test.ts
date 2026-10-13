import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn() }));
vi.mock("amazon-cognito-identity-js", () => ({
  AuthenticationDetails: vi.fn(),
  CognitoUser: vi.fn(),
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
