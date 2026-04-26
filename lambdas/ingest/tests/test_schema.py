from __future__ import annotations

import json
from pathlib import Path

import pytest

from lambdas.ingest.schema import parse_photo_metadata, split_metadata


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "sample_claude_response.json"


def test_parse_photo_metadata_validates_fixture() -> None:
    raw_json = FIXTURE_PATH.read_text(encoding="utf-8")

    metadata = parse_photo_metadata(raw_json)

    assert metadata.scene_type == "food"
    assert metadata.people_count == 2


def test_parse_photo_metadata_rejects_invalid_json() -> None:
    with pytest.raises(ValueError):
        parse_photo_metadata("not json")


def test_split_metadata_produces_filterable_and_non_filterable() -> None:
    raw_json = FIXTURE_PATH.read_text(encoding="utf-8")
    metadata = parse_photo_metadata(raw_json)

    filterable, non_filterable = split_metadata(metadata, s3_key="image.jpg", bucket="photos")

    assert filterable["mood"] == "playful"
    assert non_filterable["s3_uri"] == "s3://photos/image.jpg"
    assert "description" in non_filterable
