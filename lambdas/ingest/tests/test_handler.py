from __future__ import annotations

import json
import logging
from io import BytesIO

from moto import mock_aws

import boto3

from lambdas.ingest import handler as ingest_handler
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


def test_ingest_handler_extracts_eventbridge_event_from_sqs(monkeypatch) -> None:
    captured: dict[str, object] = {}
    monkeypatch.setattr("lambdas.ingest.handler.download_image", lambda *_args: (b"content", "image/webp"))
    monkeypatch.setattr("lambdas.ingest.handler.describe_image", lambda *_args: _sample_metadata())
    monkeypatch.setattr("lambdas.ingest.handler.embed_text", lambda _text: [0.1, 0.2, 0.3])
    monkeypatch.setattr("lambdas.ingest.handler.put_vector", lambda **kwargs: captured.update(kwargs))

    eventbridge_event = {
        "source": "aws.s3",
        "detail-type": "Object Created",
        "detail": {"bucket": {"name": "photos"}, "object": {"key": "uploads%2Fimage.webp"}},
    }
    response = handler({"Records": [{"eventSource": "aws:sqs", "body": json.dumps(eventbridge_event)}]}, None)

    assert response["statusCode"] == 200
    assert json.loads(response["body"])["records"] == 1
    assert captured["key"] == "uploads/image.webp"


def test_ingest_handler_logs_sqs_worker_configuration(monkeypatch, caplog) -> None:
    monkeypatch.setenv("SQS_RECEIVE_WAIT_SECONDS", "20")
    monkeypatch.setenv("SQS_IDLE_BACKOFF_MODE", "aws-lambda-managed")
    event = {
        "Records": [
            {
                "eventSource": "aws:sqs",
                "eventSourceARN": "arn:aws:sqs:us-east-1:123456789012:photoscribe-dev-ingest-queue",
                "body": "{}",
            }
        ]
    }

    with caplog.at_level(logging.INFO):
        response = handler(event, None)

    log_entries = [json.loads(record.message) for record in caplog.records if record.message.startswith("{")]
    worker_log = next(entry for entry in log_entries if entry["message"] == "sqs worker batch started")
    assert response["statusCode"] == 200
    assert worker_log["batch_size"] == 1
    assert worker_log["wait_time_seconds"] == 20
    assert worker_log["idle_backoff"] == "aws-lambda-managed"


def test_upsert_asset_policy_preserves_review_decisions(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeDynamoDBClient:
        def update_item(self, **kwargs: object) -> None:
            captured.update(kwargs)

    monkeypatch.setattr(ingest_handler, "_dynamodb_client", lambda: FakeDynamoDBClient())
    monkeypatch.setattr(ingest_handler, "ASSET_POLICY_TABLE_NAME", "asset-policy")
    monkeypatch.setattr(ingest_handler, "DEFAULT_ALLOWED_GROUPS", ["admin", "reviewer", "employee"])
    monkeypatch.setattr(ingest_handler, "DEFAULT_REVIEW_STATUS", "pending_review")
    monkeypatch.setattr(ingest_handler, "DEFAULT_VISIBILITY", "restricted")

    ingest_handler.upsert_asset_policy(
        bucket="photos",
        key="image.jpg",
        metadata=_sample_metadata(),
        thumbnail_key="thumbnails/ab/thumb.webp",
    )

    assert captured["TableName"] == "asset-policy"
    assert captured["Key"] == {"asset_key": {"S": "image.jpg"}}
    assert "if_not_exists(review_status" in str(captured["UpdateExpression"])
    assert "if_not_exists(visibility" in str(captured["UpdateExpression"])
    assert "thumbnail_key = :thumbnail_key" in str(captured["UpdateExpression"])
    assert captured["ExpressionAttributeValues"][":allowed_groups"]["S"] == "admin,reviewer,employee"
    assert captured["ExpressionAttributeValues"][":people_count"]["N"] == "2"
    assert captured["ExpressionAttributeValues"][":thumbnail_key"]["S"] == "thumbnails/ab/thumb.webp"


def test_ingest_handler_skips_generated_thumbnail(monkeypatch) -> None:
    def fail_download(*_args: object) -> tuple[bytes, str]:
        raise AssertionError("generated thumbnails should not be re-ingested")

    monkeypatch.setattr("lambdas.ingest.handler.download_image", fail_download)

    response = handler(
        {
            "source": "aws.s3",
            "detail-type": "Object Created",
            "detail": {"bucket": {"name": "photos"}, "object": {"key": "thumbnails%2Fab%2Fthumb.webp"}},
        },
        None,
    )

    assert response["statusCode"] == 200
