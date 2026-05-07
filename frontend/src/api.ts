import type { PhotoResult, SearchFilters, SearchResponse } from "./types";

const PREVIEW_RESULTS: PhotoResult[] = [
  {
    id: "preview-boardroom",
    key: "preview-boardroom",
    description:
      "A leadership team reviews a product launch plan around a conference table with laptops, presentation notes, and clean office lighting.",
    altText: "Corporate team reviewing a product launch plan in a conference room.",
    seoCaption: "Executive planning session in a modern conference room.",
    mood: "confident",
    reviewStatus: "approved",
    sceneType: "event",
    lighting: "studio",
    timeOfDay: "morning",
    source: "preview",
    visibility: "library",
  },
  {
    id: "preview-clinic",
    key: "preview-clinic",
    description:
      "A doctor uses a tablet in a bright hospital hallway while medical staff coordinate patient care in the background.",
    altText: "Doctor using a tablet in a hospital hallway.",
    seoCaption: "Healthcare operations image for internal communications.",
    mood: "serene",
    reviewStatus: "approved",
    sceneType: "documentary",
    lighting: "soft_diffused",
    timeOfDay: "afternoon",
    source: "preview",
    visibility: "restricted",
  },
  {
    id: "preview-warehouse",
    key: "preview-warehouse",
    description:
      "A warehouse operations team performs a quality inspection beside labeled inventory shelves and safety equipment.",
    altText: "Warehouse team inspecting inventory and safety equipment.",
    seoCaption: "Operations and compliance image from a warehouse inspection.",
    mood: "confident",
    reviewStatus: "pending_review",
    sceneType: "documentary",
    lighting: "mixed",
    timeOfDay: "midday",
    source: "preview",
    visibility: "restricted",
  },
  {
    id: "preview-product-demo",
    key: "preview-product-demo",
    description:
      "A customer success manager demonstrates analytics software on a large display during an enterprise product briefing.",
    altText: "Customer success manager presenting analytics software to clients.",
    seoCaption: "Enterprise product demo with customer stakeholders.",
    mood: "energetic",
    reviewStatus: "approved",
    sceneType: "event",
    lighting: "studio",
    timeOfDay: "unknown",
    source: "preview",
    visibility: "library",
  },
];

type ApiPhotoResult = Partial<{
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
  s3_key: string;
  review_status: string;
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
      mood: item.mood ?? "neutral",
      sceneType: item.scene_type ?? "other",
      lighting: item.lighting ?? "other",
      reviewStatus: item.review_status,
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

export async function searchPhotos(query: string, filters: SearchFilters): Promise<SearchResponse> {
  const trimmedQuery = query.trim();
  const baseUrl = import.meta.env.VITE_API_URL?.trim();

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

  const authToken = window.localStorage.getItem("photoscribe.authToken")?.trim();
  const response = await fetch(url.toString(), {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
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
