"""Ingest Lambda handler."""

from __future__ import annotations

import json
import logging
import mimetypes
import os
import time
from typing import Any
from urllib.parse import unquote_plus

import boto3

from .bedrock import describe_image, embed_text
from .schema import split_metadata
from .vectors import put_vector


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)
PHOTO_BUCKET_NAME = os.environ.get("PHOTO_BUCKET_NAME", "")
ALLOWED_MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _s3_client() -> Any:
    return boto3.client("s3")


def _extract_s3_records(event: dict[str, Any]) -> list[dict[str, str]]:
    records = event.get("Records")
    if isinstance(records, list):
        extracted: list[dict[str, str]] = []
        for record in records:
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
