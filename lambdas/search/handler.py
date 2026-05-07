"""Search Lambda handler."""

from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import unquote
from uuid import uuid4

import boto3

from .bedrock import embed_text
from .vectors import Match, query


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)
ASSET_POLICY_TABLE_NAME = os.environ.get("ASSET_POLICY_TABLE_NAME", "")
AUDIT_LOG_TABLE_NAME = os.environ.get("AUDIT_LOG_TABLE_NAME", "")
AUDIT_LOG_RETENTION_DAYS = int(os.environ.get("AUDIT_LOG_RETENTION_DAYS", "30"))
MISSING_POLICY_DEFAULT = os.environ.get("MISSING_POLICY_DEFAULT", "allow").strip().lower()
PHOTO_BUCKET_NAME = os.environ.get("PHOTO_BUCKET_NAME", "")
SIGNED_URL_TTL_SECONDS = int(os.environ.get("SIGNED_URL_TTL_SECONDS", "900"))
FILTER_KEYS = {"mood", "scene_type", "lighting", "time_of_day", "people_count", "date_added", "aspect_ratio"}
PRIVILEGED_GROUPS = {"admin", "reviewer"}


def _s3_client() -> Any:
    return boto3.client("s3")


def _dynamodb_client() -> Any:
    return boto3.client("dynamodb")


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


def _extract_claims(event: dict[str, Any]) -> dict[str, Any]:
    authorizer = event.get("requestContext", {}).get("authorizer", {})
    jwt = authorizer.get("jwt", {})
    claims = jwt.get("claims", {})
    return claims if isinstance(claims, dict) else {}


def _claim_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if str(item)]

    if isinstance(value, str):
        if value.startswith("[") and value.endswith("]"):
            try:
                decoded = json.loads(value)
                if isinstance(decoded, list):
                    return [str(item) for item in decoded if str(item)]
            except json.JSONDecodeError:
                pass
        return [item.strip() for item in value.split(",") if item.strip()]

    return []


def _security_context(event: dict[str, Any]) -> dict[str, Any]:
    claims = _extract_claims(event)
    groups = set(_claim_list(claims.get("cognito:groups") or claims.get("groups")))

    return {
        "auth_mode": "jwt" if claims else "anonymous",
        "groups": sorted(groups),
        "principal_id": str(claims.get("sub") or claims.get("username") or "anonymous"),
    }


def _ddb_string(value: dict[str, Any] | None, default: str = "") -> str:
    if not value:
        return default
    return str(value.get("S") or value.get("N") or default)


def _ddb_string_list(value: dict[str, Any] | None) -> list[str]:
    if not value:
        return []

    if "SS" in value:
        return [str(item) for item in value["SS"]]

    if "L" in value:
        return [_ddb_string(item) for item in value["L"]]

    if "S" in value:
        return [item.strip() for item in value["S"].split(",") if item.strip()]

    return []


def _get_asset_policy(s3_key: str) -> dict[str, Any] | None:
    if not ASSET_POLICY_TABLE_NAME:
        return None

    response = _dynamodb_client().get_item(
        ConsistentRead=False,
        Key={"asset_key": {"S": s3_key}},
        TableName=ASSET_POLICY_TABLE_NAME,
    )
    item = response.get("Item")
    return item if isinstance(item, dict) else None


def _authorize_asset(s3_key: str, groups: set[str]) -> tuple[bool, dict[str, str]]:
    if not ASSET_POLICY_TABLE_NAME:
        return True, {"review_status": "unmanaged", "visibility": "library"}

    policy = _get_asset_policy(s3_key)
    if policy is None:
        allowed = MISSING_POLICY_DEFAULT != "deny"
        return allowed, {"review_status": "missing_policy", "visibility": "library"}

    review_status = _ddb_string(policy.get("review_status"), "approved")
    visibility = _ddb_string(policy.get("visibility"), "library")
    allowed_groups = set(_ddb_string_list(policy.get("allowed_groups")))
    is_privileged = bool(groups & PRIVILEGED_GROUPS)

    if review_status in {"pending_review", "rejected"}:
        return is_privileged, {"review_status": review_status, "visibility": visibility}

    if visibility == "restricted" and not (is_privileged or groups & allowed_groups):
        return False, {"review_status": review_status, "visibility": visibility}

    return True, {"review_status": review_status, "visibility": visibility}


def enrich_with_signed_url(match: Match, policy_metadata: dict[str, str] | None = None) -> dict[str, Any]:
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
        "review_status": (policy_metadata or {}).get("review_status", "unmanaged"),
        "visibility": (policy_metadata or {}).get("visibility", "library"),
    }


def _audit_search(
    *,
    denied_count: int,
    filter_doc: dict[str, Any] | None,
    query_text: str,
    result_count: int,
    security_context: dict[str, Any],
) -> None:
    if not AUDIT_LOG_TABLE_NAME:
        return

    now = datetime.now(UTC)
    item = {
        "event_id": {"S": str(uuid4())},
        "created_at": {"S": now.isoformat()},
        "denied_count": {"N": str(denied_count)},
        "event_type": {"S": "search"},
        "expires_at": {"N": str(int((now + timedelta(days=AUDIT_LOG_RETENTION_DAYS)).timestamp()))},
        "filters_json": {"S": json.dumps(filter_doc or {}, sort_keys=True)},
        "groups_csv": {"S": ",".join(security_context["groups"])},
        "principal_id": {"S": security_context["principal_id"]},
        "query": {"S": query_text},
        "result_count": {"N": str(result_count)},
    }

    try:
        _dynamodb_client().put_item(Item=item, TableName=AUDIT_LOG_TABLE_NAME)
    except Exception as error:  # pragma: no cover - audit logging must not fail user search.
        LOGGER.warning("audit logging failed: %s", error)


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
    top_k = min(max(top_k, 1), 50)

    try:
        filter_doc = parse_filter(params.get("filter"))
    except ValueError as error:
        return _response(400, {"error": str(error)})

    security_context = _security_context(event)
    query_vector = embed_text(query_text)
    matches = query(query_vector, top_k=top_k, filter=filter_doc)
    results: list[dict[str, Any]] = []
    denied_count = 0
    groups = set(security_context["groups"])
    for match in matches:
        s3_key = match.metadata.get("s3_key", match.key)
        is_allowed, policy_metadata = _authorize_asset(str(s3_key), groups)
        if is_allowed:
            results.append(enrich_with_signed_url(match, policy_metadata))
        else:
            denied_count += 1

    _audit_search(
        denied_count=denied_count,
        filter_doc=filter_doc,
        query_text=query_text,
        result_count=len(results),
        security_context=security_context,
    )

    return _response(
        200,
        {
            "message": "search complete",
            "query": unquote(query_text),
            "results": results,
            "security_context": {
                "auth_mode": security_context["auth_mode"],
                "denied_results": denied_count,
                "groups": security_context["groups"],
            },
        },
    )
