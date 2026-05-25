import type {
  AdminUserInvite,
  AssetPolicyUpdate,
  AssetTagsUpdate,
  PhotoResult,
  SearchFilters,
  SearchResponse,
  UploadResult,
} from "./types";

const PREVIEW_RESULTS: PhotoResult[] = [
  {
    id: "preview-executive-headshot",
    key: "preview-executive-headshot",
    description:
      "Approved hospital executive headshot for leadership announcements, board materials, and press requests.",
    altText: "Hospital executive headshot approved for communications use.",
    seoCaption: "Hospital executive headshot for leadership communications.",
    campaign: "Leadership communications",
    consentStatus: "approved",
    curatorTags: ["executive headshot", "approved asset", "leadership"],
    location: "Administration office",
    mood: "confident",
    ownerDepartment: "Communications",
    reviewStatus: "approved",
    sceneType: "portrait",
    lighting: "studio",
    timeOfDay: "unknown",
    peopleCount: 1,
    source: "preview",
    staffNames: ["Dr. Maya Chen"],
    subjects: ["executive", "headshot", "portrait", "hospital leadership"],
    usageRights: "public_release",
    visibility: "library",
  },
  {
    id: "preview-leadership-briefing",
    key: "preview-leadership-briefing",
    description:
      "Hospital executives review community impact materials around a conference table with secure laptops, printed reports, and clean administrative lighting.",
    altText: "Hospital leadership team reviewing community impact materials.",
    seoCaption: "Hospital leadership planning session for internal communications.",
    campaign: "Community impact report",
    consentStatus: "approved",
    curatorTags: ["campaign assets", "annual report", "leadership"],
    location: "Executive conference room",
    mood: "confident",
    ownerDepartment: "Marketing",
    reviewStatus: "approved",
    sceneType: "event",
    lighting: "studio",
    timeOfDay: "morning",
    peopleCount: 6,
    source: "preview",
    staffNames: [],
    subjects: ["executives", "reports", "conference room", "approved campaign assets"],
    usageRights: "internal_only",
    visibility: "library",
  },
  {
    id: "preview-clinic",
    key: "preview-clinic",
    description:
      "A doctor uses a tablet in a bright hospital hallway while medical staff coordinate patient care in the background.",
    altText: "Doctor using a tablet in a hospital hallway.",
    seoCaption: "Clinician using a tablet in a hospital operations corridor.",
    campaign: "Clinical operations",
    consentStatus: "restricted",
    curatorTags: ["doctor", "tablet", "clinical staff"],
    location: "Hospital corridor",
    mood: "serene",
    ownerDepartment: "Clinical Communications",
    reviewStatus: "approved",
    sceneType: "documentary",
    lighting: "soft_diffused",
    timeOfDay: "afternoon",
    peopleCount: 3,
    source: "preview",
    staffNames: ["Dr. Jordan Lee"],
    subjects: ["doctor", "tablet", "hospital hallway"],
    usageRights: "internal_only",
    visibility: "restricted",
  },
  {
    id: "preview-facilities-rounds",
    key: "preview-facilities-rounds",
    description:
      "Facilities and safety staff inspect a clearly marked hospital corridor with equipment carts, wayfinding signage, and compliance documentation.",
    altText: "Hospital facilities team inspecting a clinical corridor.",
    seoCaption: "Hospital facilities inspection image for operations documentation.",
    campaign: "Facilities documentation",
    consentStatus: "not_required",
    curatorTags: ["facilities", "safety inspection", "needs compliance review"],
    location: "Clinical corridor",
    mood: "confident",
    ownerDepartment: "Facilities",
    reviewStatus: "pending_review",
    sceneType: "documentary",
    lighting: "mixed",
    timeOfDay: "midday",
    peopleCount: 2,
    source: "preview",
    staffNames: [],
    subjects: ["facilities", "safety", "clinical corridor"],
    usageRights: "internal_only",
    visibility: "restricted",
  },
  {
    id: "preview-community-event",
    key: "preview-community-event",
    description:
      "Medical staff and volunteers welcome families at an outdoor community health event with branded tables, soft daylight, and approachable patient education materials.",
    altText: "Hospital staff welcoming families at a community health event.",
    seoCaption: "Community health outreach event for hospital marketing.",
    campaign: "Community health outreach",
    consentStatus: "approved",
    curatorTags: ["community health event", "approved campaign assets", "outreach"],
    location: "Outdoor community event",
    mood: "energetic",
    ownerDepartment: "Marketing",
    reviewStatus: "approved",
    sceneType: "event",
    lighting: "studio",
    timeOfDay: "unknown",
    peopleCount: 8,
    source: "preview",
    staffNames: [],
    subjects: ["community outreach", "families", "patient education"],
    usageRights: "public_release",
    visibility: "library",
  },
];

const PREVIEW_STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "or", "the", "to", "with"]);

type ApiPhotoResult = Partial<{
  aspect_ratio: string;
  campaign: string;
  colors: string[];
  consent_status: string;
  curator_tags: string[];
  expiration_date: string;
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
  location: string;
  distance: number;
  objects_detected: string[];
  owner_department: string;
  people_count: number;
  s3_key: string;
  review_status: string;
  staff_names: string[];
  subjects: string[];
  usage_rights: string;
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

type ApiAction = "search" | "upload" | "review" | "save" | "invite";

function previewSearchTerms(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^a-z0-9]/g, ""))
    .filter((term) => term && !PREVIEW_STOP_WORDS.has(term));
}

function resultHaystack(result: PhotoResult) {
  return [
    result.description,
    result.altText,
    result.seoCaption,
    result.mood,
    result.sceneType,
    result.lighting,
    result.timeOfDay,
    result.reviewStatus,
    result.visibility,
    result.consentStatus,
    result.usageRights,
    result.ownerDepartment,
    result.campaign,
    result.location,
    result.staffNames?.join(" "),
    result.subjects?.join(" "),
    result.curatorTags?.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scorePreviewQuery(result: PhotoResult, query: string) {
  const terms = previewSearchTerms(query);
  if (!terms.length) {
    return 0;
  }

  const haystack = resultHaystack(result);
  return terms.filter((term) => haystack.includes(term) || (term.endsWith("s") && haystack.includes(term.slice(0, -1)))).length;
}

function matchesPreviewQuery(result: PhotoResult, query: string) {
  const terms = previewSearchTerms(query);
  if (!terms.length) {
    return false;
  }

  const minimumScore = terms.length <= 2 ? terms.length : Math.ceil(terms.length * 0.5);
  return scorePreviewQuery(result, query) >= minimumScore;
}

function matchingPreviewResults(query: string) {
  return PREVIEW_RESULTS.map((result) => ({ result, score: scorePreviewQuery(result, query) }))
    .filter(({ result }) => matchesPreviewQuery(result, query))
    .sort((left, right) => right.score - left.score)
    .map(({ result }) => result);
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
      campaign: item.campaign,
      consentStatus: item.consent_status,
      curatorTags: item.curator_tags,
      dominantColors: item.colors,
      mood: item.mood ?? "neutral",
      sceneType: item.scene_type ?? "other",
      lighting: item.lighting ?? "other",
      expirationDate: item.expiration_date,
      location: item.location,
      objectsDetected: item.objects_detected,
      ownerDepartment: item.owner_department,
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
      usageRights: item.usage_rights,
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

function jsonAuthHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...authHeaders(),
  };
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
    const previewResults = matchingPreviewResults(trimmedQuery);

    return {
      message: "Showing example photos.",
      mode: "preview",
      query: trimmedQuery,
      results: applyFilters(previewResults, filters),
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

  const response = await apiFetch("search", url.toString(), {
    headers: authHeaders(),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(friendlyApiError("search", response.status, payload.error));
  }

  const payload = (await response.json()) as ApiSearchResponse;

  return {
    message: payload.message ?? "Search complete.",
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
    throw new Error("Saving photo details is not set up for this site yet.");
  }

  const response = await apiFetch("save", `${baseUrl}/assets/tags`, {
    body: JSON.stringify({
      curator_tags: curatorTags,
      key,
      staff_names: staffNames,
    }),
    headers: curatorHeaders(token),
    method: "POST",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(friendlyApiError("save", response.status, payload.error));
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

export async function getReviewQueue(): Promise<PhotoResult[]> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) {
    return [];
  }

  const response = await apiFetch("review", `${baseUrl}/assets/review`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(friendlyApiError("review", response.status, payload.error));
  }

  const payload = (await response.json()) as { results?: unknown[] };
  return normalizeApiResults(payload.results ?? []);
}

export async function updateAssetPolicy(update: AssetPolicyUpdate): Promise<AssetPolicyUpdate> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) {
    throw new Error("Saving review details is not set up for this site yet.");
  }

  const response = await apiFetch("save", `${baseUrl}/assets/policy`, {
    body: JSON.stringify({
      campaign: update.campaign,
      consent_status: update.consentStatus,
      curator_tags: update.curatorTags,
      expiration_date: update.expirationDate,
      groups: update.groups,
      key: update.key,
      location: update.location,
      owner_department: update.ownerDepartment,
      review_status: update.reviewStatus,
      staff_names: update.staffNames,
      usage_rights: update.usageRights,
      visibility: update.visibility,
    }),
    headers: jsonAuthHeaders(),
    method: "POST",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(friendlyApiError("save", response.status, payload.error));
  }

  const payload = (await response.json()) as Partial<{
    campaign: string;
    consent_status: string;
    curator_tags: string[];
    expiration_date: string;
    groups: string[];
    key: string;
    location: string;
    owner_department: string;
    review_status: string;
    staff_names: string[];
    usage_rights: string;
    visibility: string;
  }>;

  return {
    campaign: payload.campaign ?? "",
    consentStatus: payload.consent_status ?? "missing",
    curatorTags: payload.curator_tags ?? [],
    expirationDate: payload.expiration_date ?? "",
    groups: payload.groups ?? [],
    key: payload.key ?? update.key,
    location: payload.location ?? "",
    ownerDepartment: payload.owner_department ?? "",
    reviewStatus: payload.review_status ?? "pending_review",
    staffNames: payload.staff_names ?? [],
    usageRights: payload.usage_rights ?? "unknown",
    visibility: payload.visibility ?? "library",
  };
}

export async function inviteAdminUser(email: string, groups: string[]): Promise<AdminUserInvite> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) {
    throw new Error("Staff invitations are not set up for this site yet.");
  }

  const response = await apiFetch("invite", `${baseUrl}/admin/users`, {
    body: JSON.stringify({ email, groups }),
    headers: jsonAuthHeaders(),
    method: "POST",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(friendlyApiError("invite", response.status, payload.error));
  }

  return (await response.json()) as AdminUserInvite;
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

function networkApiError(action: ApiAction) {
  if (action === "search") {
    return "Search cannot reach the photo service. Check the API URL, CORS settings, or network connection and retry.";
  }

  if (action === "upload") {
    return "Upload cannot reach the photo service. Check your staff session and network connection, then retry.";
  }

  return "The photo service cannot be reached. Check the network connection and retry.";
}

async function apiFetch(action: ApiAction, input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(networkApiError(action));
  }
}

function friendlyApiError(action: ApiAction, status: number, fallback?: string) {
  if (status === 401) {
    return "Your staff session expired. Sign in again and retry.";
  }

  if (status === 403) {
    return "Your account does not have access to this action.";
  }

  if (status === 413) {
    return "This file is too large for the current upload limit.";
  }

  if (status === 429) {
    return "The service is busy from too many requests. Wait a minute and retry.";
  }

  if (status === 500 || status === 502 || status === 503 || status === 504) {
    if (action === "upload") {
      return "Upload setup is temporarily busy. Wait a minute and retry; no duplicate ingest has started for this file.";
    }

    if (action === "search") {
      return "Search is temporarily unavailable. Recently uploaded photos may still be indexing; try again in a minute.";
    }

    return "The service is temporarily unavailable. Wait a minute and retry.";
  }

  return fallback ?? `${action} request failed with status ${status}.`;
}

async function requestUploadPresign(
  file: File,
  checksumSha256: string,
): Promise<UploadPresignResponse> {
  const baseUrl = apiBaseUrl();
  const contentType = inferContentType(file);
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await apiFetch("upload", `${baseUrl}/uploads/presign`, {
      body: JSON.stringify({
        checksum_sha256: checksumSha256,
        content_type: contentType,
        filename: file.name,
        size_bytes: file.size,
      }),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      method: "POST",
    });

    const payload = (await response.json().catch(() => ({}))) as Partial<UploadPresignResponse> & { error?: string };
    if (response.ok) {
      if (!payload.key || !payload.bucket) {
        throw new Error("Upload could not check for duplicates. Try again.");
      }

      if (payload.duplicate) {
        return payload as UploadPresignResponse;
      }

      if (!payload.upload_url || !payload.headers || payload.method !== "PUT") {
        throw new Error("Upload could not start. Try again.");
      }

      return payload as UploadPresignResponse;
    }

    const message = friendlyApiError("upload", response.status, payload.error);
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
      reject(new Error(`Photo upload failed with status ${request.status}.`));
    };

    request.onerror = () => reject(new Error("Photo upload failed."));
    request.send(file);
  });
}

export async function uploadPhoto(
  file: File,
  checksumSha256: string,
  onProgress: (progress: number) => void,
): Promise<UploadResult> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) {
    throw new Error("Photo uploads are not set up for this site yet.");
  }

  const payload = await requestUploadPresign(file, checksumSha256);
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
