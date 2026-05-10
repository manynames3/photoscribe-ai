import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchPhotos, uploadPhoto } from "./api";

describe("frontend API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();

    const storage = new Map<string, string>();
    const localStorageMock = {
      clear: vi.fn(() => storage.clear()),
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      setItem: vi.fn((key: string, value: string) => storage.set(key, String(value))),
    };

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorageMock,
    });
  });

  it("returns filtered preview results when no backend URL is configured", async () => {
    vi.stubEnv("VITE_API_URL", "");

    const response = await searchPhotos("doctor tablet", { scene_type: "documentary" });

    expect(response.mode).toBe("preview");
    expect(response.results).toHaveLength(1);
    expect(response.results[0].key).toBe("preview-clinic");
    expect(response.securityContext?.authMode).toBe("anonymous");
  });

  it("sends Cognito auth headers and normalizes backend search results", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    window.localStorage.setItem("photoscribe.authToken", "jwt-token");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          query: "doctor",
          results: [
            {
              description: "Doctor reviewing a patient chart.",
              key: "uploads/doctor.jpg",
              owner_department: "Marketing",
              review_status: "approved",
              scene_type: "documentary",
              staff_names: ["Dr. Maya Chen"],
            },
          ],
          security_context: {
            auth_mode: "jwt",
            denied_results: 0,
            groups: ["reviewer"],
          },
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await searchPhotos("doctor", {});
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("https://api.example.test/search?q=doctor");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-token");
    expect(response.mode).toBe("api");
    expect(response.results[0]).toMatchObject({
      key: "uploads/doctor.jpg",
      ownerDepartment: "Marketing",
      reviewStatus: "approved",
      staffNames: ["Dr. Maya Chen"],
    });
  });

  it("skips direct S3 upload when the backend reports an exact duplicate", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.test");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          bucket: "photos",
          content_type: "image/jpeg",
          duplicate: true,
          key: "uploads/sha256/ab/abc.jpg",
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["photo-bytes"], "doctor.jpg", { type: "image/jpeg" });
    const onProgress = vi.fn();
    const result = await uploadPhoto(file, "a".repeat(64), onProgress);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(result).toEqual({
      bucket: "photos",
      duplicate: true,
      key: "uploads/sha256/ab/abc.jpg",
    });
    expect(body).toMatchObject({
      checksum_sha256: "a".repeat(64),
      content_type: "image/jpeg",
      filename: "doctor.jpg",
      size_bytes: file.size,
    });
    expect(onProgress).toHaveBeenCalledWith(100);
  });
});
