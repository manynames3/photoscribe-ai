"""Schema helpers for ingest metadata."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field, ValidationError


class PhotoMetadata(BaseModel):
    description: str = Field(..., min_length=20, max_length=500)
    alt_text: str = Field(..., max_length=160)
    seo_caption: str = Field(..., max_length=140)
    subjects: list[str] = Field(..., max_length=10)
    mood: Literal[
        "joyful",
        "serene",
        "dramatic",
        "confident",
        "melancholic",
        "energetic",
        "intimate",
        "tense",
        "nostalgic",
        "mysterious",
        "playful",
        "neutral",
    ]
    scene_type: Literal[
        "portrait",
        "landscape",
        "product",
        "architectural",
        "event",
        "lifestyle",
        "abstract",
        "documentary",
        "interior",
        "food",
        "street",
        "other",
    ]
    dominant_colors: list[str] = Field(..., min_length=1, max_length=5)
    objects_detected: list[str] = Field(default_factory=list, max_length=15)
    lighting: Literal[
        "golden_hour",
        "overcast",
        "studio",
        "harsh_sun",
        "soft_diffused",
        "low_light",
        "mixed",
        "backlit",
        "other",
    ]
    time_of_day: Literal["morning", "midday", "afternoon", "evening", "sunset", "night", "unknown"]
    people_count: int = Field(..., ge=0, le=50)
    aspect_ratio: Literal["portrait", "landscape", "square", "panoramic"]


def parse_photo_metadata(raw_text: str) -> PhotoMetadata:
    """Parse model JSON and raise with the raw text preserved on failure."""
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as error:
        raise ValueError(f"image model returned invalid JSON: {raw_text}") from error

    try:
        return PhotoMetadata.model_validate(payload)
    except ValidationError as error:
        raise ValueError(f"image model returned invalid schema payload: {raw_text}") from error


def split_metadata(metadata: PhotoMetadata, *, s3_key: str, bucket: str) -> tuple[dict[str, object], dict[str, object]]:
    """Split the validated metadata into filterable and non-filterable structures."""
    filterable = {
        "mood": metadata.mood,
        "scene_type": metadata.scene_type,
        "lighting": metadata.lighting,
        "time_of_day": metadata.time_of_day,
        "people_count": metadata.people_count,
        "date_added": datetime.now(UTC).date().isoformat(),
        "aspect_ratio": metadata.aspect_ratio,
    }
    non_filterable = {
        "description": metadata.description[:500],
        "alt_text": metadata.alt_text,
        "seo_caption": metadata.seo_caption,
        "s3_key": s3_key,
        "s3_uri": f"s3://{bucket}/{s3_key}",
        "subjects_csv": ",".join(metadata.subjects),
        "colors_csv": ",".join(metadata.dominant_colors),
        "objects_csv": ",".join(metadata.objects_detected),
    }
    return filterable, non_filterable
