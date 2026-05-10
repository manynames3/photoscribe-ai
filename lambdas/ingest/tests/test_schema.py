from __future__ import annotations

import json
from pathlib import Path

import pytest

from lambdas.ingest.schema import parse_photo_metadata, split_metadata


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "sample_model_response.json"


def test_parse_photo_metadata_validates_fixture() -> None:
    raw_json = FIXTURE_PATH.read_text(encoding="utf-8")

    metadata = parse_photo_metadata(raw_json)

    assert metadata.scene_type == "food"
    assert metadata.people_count == 2


def test_parse_photo_metadata_rejects_invalid_json() -> None:
    with pytest.raises(ValueError):
        parse_photo_metadata("not json")


def test_parse_photo_metadata_normalizes_model_enum_drift() -> None:
    payload = {
        "alt_text": "Construction worker outside a hospital building.",
        "aspect_ratio": "wide",
        "description": "A construction worker stands outside a hospital building under renovation. The scene shows the building facade, temporary barriers, and daytime site activity.",
        "dominant_colors": ["blue", "gray"],
        "lighting": "natural",
        "mood": "professional",
        "objects_detected": ["worker", "building", "barriers"],
        "people_count": 1,
        "scene_type": "construction",
        "seo_caption": "Facilities renovation documentation outside a hospital building.",
        "subjects": ["construction worker", "hospital building"],
        "time_of_day": "daytime",
    }

    metadata = parse_photo_metadata(json.dumps(payload))

    assert metadata.aspect_ratio == "landscape"
    assert metadata.lighting == "soft_diffused"
    assert metadata.mood == "confident"
    assert metadata.scene_type == "architectural"
    assert metadata.time_of_day == "unknown"


def test_split_metadata_produces_filterable_and_non_filterable() -> None:
    raw_json = FIXTURE_PATH.read_text(encoding="utf-8")
    metadata = parse_photo_metadata(raw_json)

    filterable, non_filterable = split_metadata(metadata, s3_key="image.jpg", bucket="photos")

    assert filterable["mood"] == "playful"
    assert non_filterable["s3_uri"] == "s3://photos/image.jpg"
    assert "description" in non_filterable
