"""Search Lambda handler."""

from __future__ import annotations

import json
import os
from typing import Any
from urllib.parse import unquote

import boto3

from .bedrock import embed_text
from .vectors import Match, query


PHOTO_BUCKET_NAME = os.environ.get("PHOTO_BUCKET_NAME", "")
SIGNED_URL_TTL_SECONDS = int(os.environ.get("SIGNED_URL_TTL_SECONDS", "900"))
FILTER_KEYS = {"mood", "scene_type", "lighting", "time_of_day", "people_count", "date_added", "aspect_ratio"}


def _s3_client() -> Any:
    return boto3.client("s3")


def _response(status_code: int, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload),
    }


def parse_filter(raw_filter: str | None) -> dict[str, Any] | None:
    """Parse the UI filter JSON into an S3 Vectors filter document."""
    if raw_filter is None or raw_filter.strip() == "":
        return None

    try:
        payload = json.loads(raw_filter)
    except json.JSONDecodeError as error:
        raise ValueError("filter must be valid JSON") from error

    if not isinstance(payload, dict):
        raise ValueError("filter must decode to an object")

    translated: dict[str, Any] = {}
    for key, value in payload.items():
        if key not in FILTER_KEYS:
            raise ValueError(f"unsupported filter key: {key}")
        translated[key] = value

    return translated


def enrich_with_signed_url(match: Match) -> dict[str, Any]:
    """Attach a signed S3 URL to a query match."""
    s3_key = match.metadata.get("s3_key", match.key)
    signed_url = _s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": PHOTO_BUCKET_NAME, "Key": s3_key},
        ExpiresIn=SIGNED_URL_TTL_SECONDS,
    )

    return {
        "key": match.key,
        "distance": match.distance,
        "description": match.metadata.get("description", ""),
        "alt_text": match.metadata.get("alt_text", ""),
        "seo_caption": match.metadata.get("seo_caption", ""),
        "mood": match.metadata.get("mood", "neutral"),
        "scene_type": match.metadata.get("scene_type", "other"),
        "thumbnail_url": signed_url,
        "image_url": signed_url,
        "s3_key": s3_key,
    }


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    """Handle semantic search requests."""
    params = event.get("queryStringParameters") or {}
    query_text = (params.get("q") or "").strip()
    if not query_text:
        return _response(400, {"error": "q required"})

    try:
        top_k = int(params.get("top_k", 20))
    except ValueError:
        return _response(400, {"error": "top_k must be an integer"})

    try:
        filter_doc = parse_filter(params.get("filter"))
    except ValueError as error:
        return _response(400, {"error": str(error)})

    query_vector = embed_text(query_text)
    matches = query(query_vector, top_k=top_k, filter=filter_doc)
    results = [enrich_with_signed_url(match) for match in matches]

    return _response(
        200,
        {
            "message": "search complete",
            "query": unquote(query_text),
            "results": results,
        },
    )
