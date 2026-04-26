import type { PhotoResult, SearchFilters, SearchResponse } from "./types";

const PREVIEW_RESULTS: PhotoResult[] = [
  {
    id: "preview-garden",
    key: "preview-garden",
    description:
      "Two children cup a handful of warm red cherry tomatoes against a soft green garden backdrop with a shallow depth of field.",
    altText: "Two hands holding a handful of cherry tomatoes.",
    seoCaption: "Children holding a harvest of cherry tomatoes in soft afternoon light.",
    mood: "playful",
    sceneType: "lifestyle",
    lighting: "soft_diffused",
    timeOfDay: "afternoon",
    source: "preview",
  },
  {
    id: "preview-prism",
    key: "preview-prism",
    description:
      "A white bench glows through prismatic lens flare and dreamy golden bokeh, turning a simple outdoor scene into an abstract wash of light.",
    altText: "White bench in front of blurred trees and prismatic sunlight.",
    seoCaption: "Prismatic sunlight spills over a white bench in a dreamy abstract outdoor frame.",
    mood: "mysterious",
    sceneType: "abstract",
    lighting: "golden_hour",
    timeOfDay: "sunset",
    source: "preview",
  },
  {
    id: "preview-interior",
    key: "preview-interior",
    description:
      "A quiet interior vignette with linen texture, pale wood, and soft window light designed to surface warm editorial search results.",
    altText: "Quiet interior scene with pale wood and linen.",
    seoCaption: "Soft window light across pale wood and linen creates a calm editorial interior.",
    mood: "serene",
    sceneType: "interior",
    lighting: "soft_diffused",
    timeOfDay: "morning",
    source: "preview",
  },
  {
    id: "preview-portrait",
    key: "preview-portrait",
    description:
      "A direct portrait setup with crisp contrast and structured posing intended to stand in for confident brand and editorial headshots.",
    altText: "Confident portrait setup with crisp contrast.",
    seoCaption: "Confident portrait framing with crisp contrast and a clean editorial finish.",
    mood: "confident",
    sceneType: "portrait",
    lighting: "studio",
    timeOfDay: "unknown",
    source: "preview",
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
}>;

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
      timeOfDay: item.time_of_day ?? "unknown",
      thumbnailUrl: item.thumbnail_url,
      imageUrl: item.image_url,
      distance: item.distance,
      s3Key: item.s3_key,
      source: "api",
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
      message: "Preview mode. Add VITE_API_URL to use the deployed semantic search API.",
      mode: "preview",
      query: trimmedQuery,
      results: applyFilters(matchingPreviewResults, filters),
    };
  }

  const url = new URL(`${baseUrl.replace(/\/$/, "")}/search`);
  url.searchParams.set("q", trimmedQuery);

  const serializedFilters = serializeFilters(filters);
  if (serializedFilters) {
    url.searchParams.set("filter", serializedFilters);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Search request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as Partial<SearchResponse> & { results?: unknown[] };

  return {
    message: payload.message ?? "Connected to the deployed semantic search API.",
    mode: "api",
    query: payload.query ?? trimmedQuery,
    results: normalizeApiResults(payload.results ?? []),
  };
}
