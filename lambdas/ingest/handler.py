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


def upsert_asset_policy(*, bucket: str, key: str, metadata: Any) -> None:
    """Create governance metadata while preserving human review decisions."""
    if not ASSET_POLICY_TABLE_NAME:
        return

    now = datetime.now(UTC).isoformat()
    _dynamodb_client().update_item(
        ExpressionAttributeValues={
            ":allowed_groups": {"S": ",".join(DEFAULT_ALLOWED_GROUPS)},
            ":bucket_name": {"S": bucket},
            ":created_at": {"S": now},
            ":description": {"S": metadata.description[:500]},
            ":mood": {"S": metadata.mood},
            ":review_status": {"S": DEFAULT_REVIEW_STATUS},
            ":scene_type": {"S": metadata.scene_type},
            ":s3_uri": {"S": f"s3://{bucket}/{key}"},
            ":updated_at": {"S": now},
            ":visibility": {"S": DEFAULT_VISIBILITY},
        },
        Key={"asset_key": {"S": key}},
        TableName=ASSET_POLICY_TABLE_NAME,
        UpdateExpression=(
            "SET allowed_groups = if_not_exists(allowed_groups, :allowed_groups), "
            "bucket_name = :bucket_name, "
            "created_at = if_not_exists(created_at, :created_at), "
            "ai_description = :description, "
            "mood = :mood, "
            "review_status = if_not_exists(review_status, :review_status), "
            "scene_type = :scene_type, "
            "s3_uri = :s3_uri, "
            "updated_at = :updated_at, "
            "visibility = if_not_exists(visibility, :visibility)"
        ),
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
            image_bytes, media_type = download_image(bucket, key)
            if media_type not in ALLOWED_MEDIA_TYPES:
                _log({"message": "skipped unsupported media type", "key": key, "media_type": media_type})
                continue

            metadata = describe_image(image_bytes, media_type)
            vector = embed_text(metadata.description)
            filterable, non_filterable = split_metadata(metadata, s3_key=key, bucket=bucket)
            put_vector(key=key, vector=vector, filterable=filterable, non_filterable=non_filterable)
            upsert_asset_policy(bucket=bucket, key=key, metadata=metadata)

            latency_ms = round((time.perf_counter() - start) * 1000, 2)
            _log(
                {
                    "message": "indexed",
                    "bucket": bucket,
                    "key": key,
                    "mood": metadata.mood,
                    "scene_type": metadata.scene_type,
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
