"""Ingest Lambda handler."""

from __future__ import annotations

import json
import logging
import mimetypes
import os
import time
from datetime import UTC, datetime
from typing import Any
from urllib.parse import unquote_plus

import boto3

from .bedrock import describe_image, embed_text
from .schema import split_metadata
from .thumbnails import create_thumbnail, is_thumbnail_key, thumbnail_key_for_asset
from .vectors import put_vector


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)
ASSET_POLICY_TABLE_NAME = os.environ.get("ASSET_POLICY_TABLE_NAME", "")
DEFAULT_ALLOWED_GROUPS = [group.strip() for group in os.environ.get("DEFAULT_ALLOWED_GROUPS", "").split(",") if group.strip()]
DEFAULT_REVIEW_STATUS = os.environ.get("DEFAULT_REVIEW_STATUS", "approved")
DEFAULT_VISIBILITY = os.environ.get("DEFAULT_VISIBILITY", "library")
PHOTO_BUCKET_NAME = os.environ.get("PHOTO_BUCKET_NAME", "")
ALLOWED_MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _s3_client() -> Any:
    return boto3.client("s3")


def _dynamodb_client() -> Any:
    return boto3.client("dynamodb")


def _extract_s3_records(event: dict[str, Any]) -> list[dict[str, str]]:
    records = event.get("Records")
    if isinstance(records, list):
        extracted: list[dict[str, str]] = []
        for record in records:
            if record.get("eventSource") == "aws:sqs" and record.get("body"):
                try:
                    body = json.loads(record["body"])
                except json.JSONDecodeError:
                    LOGGER.warning("skipping SQS message with invalid JSON body")
                    continue
                if isinstance(body, dict):
                    extracted.extend(_extract_s3_records(body))
                continue

            bucket = record.get("s3", {}).get("bucket", {}).get("name")
            key = record.get("s3", {}).get("object", {}).get("key")
            if bucket and key:
                extracted.append({"bucket": bucket, "key": unquote_plus(key)})
        return extracted

    if event.get("source") == "aws.s3":
        detail = event.get("detail", {})
        bucket = detail.get("bucket", {}).get("name")
        key = detail.get("object", {}).get("key")
        if bucket and key:
            return [{"bucket": bucket, "key": unquote_plus(key)}]

    return []


def _media_type_for_key(key: str, content_type: str | None = None) -> str:
    if content_type:
        return content_type.split(";")[0].strip().lower()

    guessed, _ = mimetypes.guess_type(key)
    return (guessed or "application/octet-stream").lower()


def download_image(bucket: str, key: str) -> tuple[bytes, str]:
    """Download an image from S3 and infer its media type."""
    response = _s3_client().get_object(Bucket=bucket, Key=key)
    image_bytes = response["Body"].read()
    media_type = _media_type_for_key(key, response.get("ContentType"))
    return image_bytes, media_type


def _log(entry: dict[str, object]) -> None:
    LOGGER.info(json.dumps(entry))


def store_thumbnail(bucket: str, key: str, image_bytes: bytes) -> str | None:
    """Write a WebP thumbnail for UI previews without blocking ingest if conversion fails."""
    try:
        thumbnail_bytes = create_thumbnail(image_bytes)
    except Exception as error:  # pragma: no cover - corrupt images should fail soft here.
        _log({"message": "thumbnail generation failed", "bucket": bucket, "key": key, "error": str(error)})
        return None

    thumbnail_key = thumbnail_key_for_asset(key)
    _s3_client().put_object(
        Body=thumbnail_bytes,
        Bucket=bucket,
        CacheControl="public, max-age=31536000, immutable",
        ContentType="image/webp",
        Key=thumbnail_key,
        Metadata={"source-key-sha256": thumbnail_key.split("/")[-1].removesuffix(".webp")},
    )
    return thumbnail_key


def upsert_asset_policy(*, bucket: str, key: str, metadata: Any, thumbnail_key: str | None = None) -> None:
    """Create governance metadata while preserving human review decisions."""
    if not ASSET_POLICY_TABLE_NAME:
        return

    now = datetime.now(UTC).isoformat()
    expression_values = {
        ":allowed_groups": {"S": ",".join(DEFAULT_ALLOWED_GROUPS)},
        ":bucket_name": {"S": bucket},
        ":campaign": {"S": ""},
        ":consent_status": {"S": "missing"},
        ":created_at": {"S": now},
        ":description": {"S": metadata.description[:500]},
        ":expiration_date": {"S": ""},
        ":location": {"S": ""},
        ":mood": {"S": metadata.mood},
        ":owner_department": {"S": ""},
        ":people_count": {"N": str(metadata.people_count)},
        ":review_status": {"S": DEFAULT_REVIEW_STATUS},
        ":scene_type": {"S": metadata.scene_type},
        ":s3_uri": {"S": f"s3://{bucket}/{key}"},
        ":updated_at": {"S": now},
        ":usage_rights": {"S": "unknown"},
        ":visibility": {"S": DEFAULT_VISIBILITY},
    }
    update_parts = [
        "allowed_groups = if_not_exists(allowed_groups, :allowed_groups)",
        "bucket_name = :bucket_name",
        "campaign = if_not_exists(campaign, :campaign)",
        "consent_status = if_not_exists(consent_status, :consent_status)",
        "created_at = if_not_exists(created_at, :created_at)",
        "ai_description = :description",
        "expiration_date = if_not_exists(expiration_date, :expiration_date)",
        "#location = if_not_exists(#location, :location)",
        "mood = :mood",
        "owner_department = if_not_exists(owner_department, :owner_department)",
        "people_count = :people_count",
        "review_status = if_not_exists(review_status, :review_status)",
        "scene_type = :scene_type",
        "s3_uri = :s3_uri",
        "updated_at = :updated_at",
        "usage_rights = if_not_exists(usage_rights, :usage_rights)",
        "visibility = if_not_exists(visibility, :visibility)",
    ]
    if thumbnail_key:
        expression_values[":thumbnail_key"] = {"S": thumbnail_key}
        update_parts.append("thumbnail_key = :thumbnail_key")

    _dynamodb_client().update_item(
        ExpressionAttributeValues=expression_values,
        Key={"asset_key": {"S": key}},
        TableName=ASSET_POLICY_TABLE_NAME,
        UpdateExpression="SET " + ", ".join(update_parts),
        ExpressionAttributeNames={"#location": "location"},
    )


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Ingest uploaded images into S3 Vectors."""
    records = _extract_s3_records(event)
    _log({"message": "received event", "record_count": len(records), "raw_source": event.get("source", "records")})

    for record in records:
        start = time.perf_counter()
        bucket = record["bucket"]
        key = record["key"]

        try:
            if is_thumbnail_key(key):
                _log({"message": "skipped generated thumbnail", "bucket": bucket, "key": key})
                continue

            image_bytes, media_type = download_image(bucket, key)
            if media_type not in ALLOWED_MEDIA_TYPES:
                _log({"message": "skipped unsupported media type", "key": key, "media_type": media_type})
                continue

            thumbnail_key = store_thumbnail(bucket, key, image_bytes)
            metadata = describe_image(image_bytes, media_type)
            vector = embed_text(metadata.description)
            filterable, non_filterable = split_metadata(metadata, s3_key=key, bucket=bucket)
            put_vector(key=key, vector=vector, filterable=filterable, non_filterable=non_filterable)
            upsert_asset_policy(bucket=bucket, key=key, metadata=metadata, thumbnail_key=thumbnail_key)

            latency_ms = round((time.perf_counter() - start) * 1000, 2)
            _log(
                {
                    "message": "indexed",
                    "bucket": bucket,
                    "key": key,
                    "mood": metadata.mood,
                    "scene_type": metadata.scene_type,
                    "thumbnail_key": thumbnail_key,
                    "latency_ms": latency_ms,
                }
            )
        except Exception as error:
            _log({"message": "ingest failed", "bucket": bucket, "key": key, "error": str(error)})
            raise

    return {
        "statusCode": 200,
        "body": json.dumps({"message": "ingest complete", "records": len(records), "bucket": PHOTO_BUCKET_NAME or None}),
    }
