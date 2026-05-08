import type { AssetTagsUpdate, PhotoResult, SearchFilters, SearchResponse, UploadResult } from "./types";

const PREVIEW_RESULTS: PhotoResult[] = [
  {
    id: "preview-leadership-briefing",
    key: "preview-leadership-briefing",
    description:
      "Hospital executives review community impact materials around a conference table with secure laptops, printed reports, and clean administrative lighting.",
    altText: "Hospital leadership team reviewing community impact materials.",
    seoCaption: "Hospital leadership planning session for internal communications.",
    mood: "confident",
    reviewStatus: "approved",
    sceneType: "event",
    lighting: "studio",
    timeOfDay: "morning",
    peopleCount: 6,
    source: "preview",
    staffNames: [],
    subjects: ["executives", "reports", "conference room"],
    visibility: "library",
  },
  {
    id: "preview-clinic",
    key: "preview-clinic",
    description:
      "A doctor uses a tablet in a bright hospital hallway while medical staff coordinate patient care in the background.",
    altText: "Doctor using a tablet in a hospital hallway.",
    seoCaption: "Clinician using a tablet in a hospital operations corridor.",
    mood: "serene",
    reviewStatus: "approved",
    sceneType: "documentary",
    lighting: "soft_diffused",
    timeOfDay: "afternoon",
    peopleCount: 3,
    source: "preview",
    staffNames: [],
    subjects: ["doctor", "tablet", "hospital hallway"],
    visibility: "restricted",
  },
  {
    id: "preview-facilities-rounds",
    key: "preview-facilities-rounds",
    description:
      "Facilities and safety staff inspect a clearly marked hospital corridor with equipment carts, wayfinding signage, and compliance documentation.",
    altText: "Hospital facilities team inspecting a clinical corridor.",
    seoCaption: "Hospital facilities inspection image for operations documentation.",
    mood: "confident",
    reviewStatus: "pending_review",
    sceneType: "documentary",
    lighting: "mixed",
    timeOfDay: "midday",
    peopleCount: 2,
    source: "preview",
    staffNames: [],
    subjects: ["facilities", "safety", "clinical corridor"],
    visibility: "restricted",
  },
  {
    id: "preview-community-event",
    key: "preview-community-event",
    description:
      "Medical staff and volunteers welcome families at an outdoor community health event with branded tables, soft daylight, and approachable patient education materials.",
    altText: "Hospital staff welcoming families at a community health event.",
    seoCaption: "Community health outreach event for hospital marketing.",
    mood: "energetic",
    reviewStatus: "approved",
    sceneType: "event",
    lighting: "studio",
    timeOfDay: "unknown",
    peopleCount: 8,
    source: "preview",
    staffNames: [],
    subjects: ["community outreach", "families", "patient education"],
    visibility: "library",
  },
];

type ApiPhotoResult = Partial<{
  aspect_ratio: string;
  colors: string[];
  curator_tags: string[];
  key: string;
  description: string;
  alt_text: string;
  seo_caption: string;
  mood: string;
  scene_type: string;
  lighting: string;
  time_of_day: string;
  thumbnail_url: string;
  image_url: string;
  distance: number;
  objects_detected: string[];
  people_count: number;
  s3_key: string;
  review_status: string;
  staff_names: string[];
  subjects: string[];
  visibility: string;
}>;

type ApiSearchResponse = Partial<SearchResponse> & {
  results?: unknown[];
  security_context?: Partial<{
    auth_mode: "anonymous" | "jwt";
    denied_results: number;
    groups: string[];
  }>;
};

type UploadPresignResponse = {
  bucket: string;
  content_type: string;
  duplicate?: boolean;
  headers?: Record<string, string>;
  key: string;
  method?: "PUT";
  upload_url?: string;
};

type SignedUploadPresignResponse = UploadPresignResponse & {
  duplicate?: false;
  headers: Record<string, string>;
  method: "PUT";
  upload_url: string;
};

function matchesPreviewQuery(result: PhotoResult, query: string) {
  const haystack = [
    result.description,
    result.altText,
    result.seoCaption,
    result.mood,
    result.sceneType,
    result.lighting,
    result.timeOfDay,
  ]
    .join(" ")
    .toLowerCase();

  return query
    .toLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

function applyFilters(results: PhotoResult[], filters: SearchFilters) {
  return results.filter((result) => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value) {
        return true;
      }

      if (key === "scene_type") {
        return result.sceneType === value;
      }

      if (key === "time_of_day") {
        return result.timeOfDay === value;
      }

      return result[key as keyof Pick<PhotoResult, "mood" | "lighting">] === value;
    });
  });
}

function normalizeApiResults(results: unknown[]): PhotoResult[] {
  return results.map((result, index) => {
    const item = (result ?? {}) as ApiPhotoResult;

    return {
      id: item.key ?? `api-${index + 1}`,
      key: item.key ?? `api-${index + 1}`,
      description: item.description ?? "No description returned.",
      altText: item.alt_text ?? "Search result image.",
      seoCaption: item.seo_caption ?? "",
      aspectRatio: item.aspect_ratio,
      curatorTags: item.curator_tags,
      dominantColors: item.colors,
      mood: item.mood ?? "neutral",
      sceneType: item.scene_type ?? "other",
      lighting: item.lighting ?? "other",
      objectsDetected: item.objects_detected,
      peopleCount: item.people_count,
      reviewStatus: item.review_status,
      staffNames: item.staff_names,
      subjects: item.subjects,
      timeOfDay: item.time_of_day ?? "unknown",
      thumbnailUrl: item.thumbnail_url,
      imageUrl: item.image_url,
      distance: item.distance,
      s3Key: item.s3_key,
      source: "api",
      visibility: item.visibility,
    };
  });
}

function serializeFilters(filters: SearchFilters) {
  const populatedEntries = Object.entries(filters).filter(([, value]) => Boolean(value));
  return populatedEntries.length ? JSON.stringify(Object.fromEntries(populatedEntries)) : undefined;
}

function apiBaseUrl() {
  return import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "") ?? "";
}

function authHeaders(): Record<string, string> {
  const authToken = window.localStorage.getItem("photoscribe.authToken")?.trim();
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function curatorHeaders(token: string): Record<string, string> {
  const trimmedToken = token.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!trimmedToken) {
    return headers;
  }

  headers["x-upload-token"] = trimmedToken;
  if (trimmedToken.includes(".")) {
    headers.Authorization = `Bearer ${trimmedToken}`;
  }

  return headers;
}

export async function searchPhotos(query: string, filters: SearchFilters): Promise<SearchResponse> {
  const trimmedQuery = query.trim();
  const baseUrl = apiBaseUrl();

  if (!baseUrl) {
    const matchingPreviewResults = PREVIEW_RESULTS.filter((result) => matchesPreviewQuery(result, trimmedQuery));

    return {
      message: "Demo catalog. Add VITE_API_URL to use the deployed semantic search API.",
      mode: "preview",
      query: trimmedQuery,
      results: applyFilters(matchingPreviewResults, filters),
      securityContext: {
        authMode: "anonymous",
        deniedResults: 0,
        groups: [],
      },
    };
  }

  const url = new URL(`${baseUrl.replace(/\/$/, "")}/search`);
  url.searchParams.set("q", trimmedQuery);

  const serializedFilters = serializeFilters(filters);
  if (serializedFilters) {
    url.searchParams.set("filter", serializedFilters);
  }

  const response = await fetch(url.toString(), {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Search request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as ApiSearchResponse;

  return {
    message: payload.message ?? "Connected to the deployed semantic search API.",
    mode: "api",
    query: payload.query ?? trimmedQuery,
    results: normalizeApiResults(payload.results ?? []),
    securityContext: payload.security_context
      ? {
          authMode: payload.security_context.auth_mode ?? "anonymous",
          deniedResults: payload.security_context.denied_results ?? 0,
          groups: payload.security_context.groups ?? [],
        }
      : undefined,
  };
}

export async function updateAssetTags(
  key: string,
  curatorTags: string[],
  staffNames: string[],
  token: string,
): Promise<AssetTagsUpdate> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) {
    throw new Error("Connect VITE_API_URL before saving curator tags.");
  }

  const response = await fetch(`${baseUrl}/assets/tags`, {
    body: JSON.stringify({
      curator_tags: curatorTags,
      key,
      staff_names: staffNames,
    }),
    headers: curatorHeaders(token),
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Tag update failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as Partial<{
    curator_tags: string[];
    key: string;
    staff_names: string[];
  }>;

  return {
    curatorTags: payload.curator_tags ?? [],
    key: payload.key ?? key,
    staffNames: payload.staff_names ?? [],
  };
}

function inferContentType(file: File) {
  if (file.type) {
    return file.type;
  }

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lowerName.endsWith(".png")) {
    return "image/png";
  }
  if (lowerName.endsWith(".webp")) {
    return "image/webp";
  }

  return "application/octet-stream";
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isRetryableStatus(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function requestUploadPresign(
  file: File,
  uploadToken: string,
  checksumSha256: string,
): Promise<UploadPresignResponse> {
  const baseUrl = apiBaseUrl();
  const contentType = inferContentType(file);
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}/uploads/presign`, {
      body: JSON.stringify({
        checksum_sha256: checksumSha256,
        content_type: contentType,
        filename: file.name,
        size_bytes: file.size,
      }),
      headers: {
        "Content-Type": "application/json",
        "x-upload-token": uploadToken,
        ...authHeaders(),
      },
      method: "POST",
    });

    const payload = (await response.json().catch(() => ({}))) as Partial<UploadPresignResponse> & { error?: string };
    if (response.ok) {
      if (!payload.key || !payload.bucket) {
        throw new Error("Upload API returned an invalid duplicate response.");
      }

      if (payload.duplicate) {
        return payload as UploadPresignResponse;
      }

      if (!payload.upload_url || !payload.headers || payload.method !== "PUT") {
        throw new Error("Upload API returned an invalid presigned URL response.");
      }

      return payload as UploadPresignResponse;
    }

    const message = payload.error ?? `Upload request failed with status ${response.status}.`;
    lastError = new Error(message);
    if (!isRetryableStatus(response.status) || attempt === 3) {
      throw lastError;
    }

    await sleep(500 * 2 ** attempt);
  }

  throw lastError ?? new Error("Upload request failed.");
}

function putFileWithProgress(
  file: File,
  presign: SignedUploadPresignResponse,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", presign.upload_url);

    Object.entries(presign.headers).forEach(([key, value]) => {
      request.setRequestHeader(key, value);
    });

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new Error(`S3 upload failed with status ${request.status}.`));
    };

    request.onerror = () => reject(new Error("S3 upload failed."));
    request.send(file);
  });
}

export async function uploadPhoto(
  file: File,
  uploadToken: string,
  checksumSha256: string,
  onProgress: (progress: number) => void,
): Promise<UploadResult> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) {
    throw new Error("Upload requires VITE_API_URL to point at the deployed API.");
  }

  const payload = await requestUploadPresign(file, uploadToken, checksumSha256);
  if (payload.duplicate) {
    onProgress(100);
    return {
      bucket: payload.bucket,
      duplicate: true,
      key: payload.key,
    };
  }

  await putFileWithProgress(file, payload as SignedUploadPresignResponse, onProgress);

  return {
    bucket: payload.bucket,
    key: payload.key,
  };
}
