export type SearchFilters = Partial<{
  lighting: string;
  mood: string;
  scene_type: string;
  time_of_day: string;
}>;

export type PhotoResult = {
  altText: string;
  aspectRatio?: string;
  curatorTags?: string[];
  dominantColors?: string[];
  description: string;
  distance?: number;
  id: string;
  imageUrl?: string;
  key: string;
  lighting: string;
  mood: string;
  objectsDetected?: string[];
  peopleCount?: number;
  reviewStatus?: string;
  sceneType: string;
  s3Key?: string;
  seoCaption: string;
  source: "preview" | "api";
  staffNames?: string[];
  subjects?: string[];
  thumbnailUrl?: string;
  timeOfDay: string;
  visibility?: string;
};

export type SearchResponse = {
  message: string;
  mode: "preview" | "api";
  query: string;
  results: PhotoResult[];
  securityContext?: {
    authMode: "anonymous" | "jwt";
    deniedResults: number;
    groups: string[];
  };
};

export type UploadQueueItem = {
  checksumSha256?: string;
  error?: string;
  file: File;
  id: string;
  key?: string;
  progress: number;
  status: "ready" | "hashing" | "uploading" | "done" | "duplicate" | "error";
};

export type UploadResult = {
  bucket: string;
  duplicate?: boolean;
  key: string;
};

export type AssetTagsUpdate = {
  curatorTags: string[];
  key: string;
  staffNames: string[];
};
