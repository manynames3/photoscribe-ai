from __future__ import annotations

import json
from io import BytesIO

from moto import mock_aws

import boto3

from lambdas.ingest.handler import download_image, handler
from lambdas.ingest.schema import PhotoMetadata


def _sample_metadata() -> PhotoMetadata:
    return PhotoMetadata(
        description="A close-up portrait of hands holding small orange cherry tomatoes in soft indoor light.",
        alt_text="Hands holding cherry tomatoes.",
        seo_caption="Cherry tomatoes gathered in hands.",
        subjects=["hands", "cherry tomatoes"],
        mood="playful",
        scene_type="food",
        dominant_colors=["orange", "cream", "green"],
        objects_detected=["hands", "tomatoes"],
        lighting="soft_diffused",
        time_of_day="unknown",
        people_count=2,
        aspect_ratio="landscape",
    )


@mock_aws
def test_download_image_reads_s3_object() -> None:
    s3 = boto3.client("s3", region_name="us-east-1")
    s3.create_bucket(Bucket="photos")
    s3.put_object(Bucket="photos", Key="image.jpg", Body=b"data", ContentType="image/jpeg")

    image_bytes, media_type = download_image("photos", "image.jpg")

    assert image_bytes == b"data"
    assert media_type == "image/jpeg"


@mock_aws
def test_ingest_handler_indexes_eventbridge_event(monkeypatch) -> None:
    s3 = boto3.client("s3", region_name="us-east-1")
    s3.create_bucket(Bucket="photos")
    s3.put_object(Bucket="photos", Key="image.jpg", Body=b"data", ContentType="image/jpeg")

    captured: dict[str, object] = {}
    monkeypatch.setattr("lambdas.ingest.handler.describe_image", lambda *_args: _sample_metadata())
    monkeypatch.setattr("lambdas.ingest.handler.embed_text", lambda _text: [0.1, 0.2, 0.3])

    def fake_put_vector(*, key: str, vector: list[float], filterable: dict[str, object], non_filterable: dict[str, object]) -> None:
        captured["key"] = key
        captured["vector"] = vector
        captured["filterable"] = filterable
        captured["non_filterable"] = non_filterable

    monkeypatch.setattr("lambdas.ingest.handler.put_vector", fake_put_vector)

    response = handler(
        {
            "source": "aws.s3",
            "detail-type": "Object Created",
            "detail": {"bucket": {"name": "photos"}, "object": {"key": "image.jpg"}},
        },
        None,
    )

    assert response["statusCode"] == 200
    assert json.loads(response["body"])["records"] == 1
    assert captured["key"] == "image.jpg"
    assert captured["vector"] == [0.1, 0.2, 0.3]
    assert captured["filterable"] is not None
    assert captured["non_filterable"] is not None


def test_ingest_handler_skips_unsupported_media_type(monkeypatch) -> None:
    monkeypatch.setattr("lambdas.ingest.handler.download_image", lambda *_args: (b"content", "image/heic"))

    response = handler(
        {
            "source": "aws.s3",
            "detail-type": "Object Created",
            "detail": {"bucket": {"name": "photos"}, "object": {"key": "image.heic"}},
        },
        None,
    )

    assert response["statusCode"] == 200
    assert json.loads(response["body"])["records"] == 1
