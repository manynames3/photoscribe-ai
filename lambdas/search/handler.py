"""Search Lambda handler."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import unquote
from uuid import uuid4

import boto3
from botocore.exceptions import ClientError

from .bedrock import embed_text
from .vectors import Match, query


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)
ASSET_POLICY_TABLE_NAME = os.environ.get("ASSET_POLICY_TABLE_NAME", "")
AUDIT_LOG_TABLE_NAME = os.environ.get("AUDIT_LOG_TABLE_NAME", "")
AUDIT_LOG_RETENTION_DAYS = int(os.environ.get("AUDIT_LOG_RETENTION_DAYS", "30"))
COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID", "")
LIBRARY_ROLE_NAMES = {role.strip() for role in os.environ.get("LIBRARY_ROLE_NAMES", "").split(",") if role.strip()}
MISSING_POLICY_DEFAULT = os.environ.get("MISSING_POLICY_DEFAULT", "allow").strip().lower()
PHOTO_BUCKET_NAME = os.environ.get("PHOTO_BUCKET_NAME", "")
REVIEW_STATUS_INDEX_NAME = os.environ.get("REVIEW_STATUS_INDEX_NAME", "review-status-index")
SIGNED_URL_TTL_SECONDS = int(os.environ.get("SIGNED_URL_TTL_SECONDS", "900"))
UPLOAD_TOKEN_SHA256 = os.environ.get("UPLOAD_TOKEN_SHA256", "").strip().lower()
UPLOAD_URL_TTL_SECONDS = int(os.environ.get("UPLOAD_URL_TTL_SECONDS", "900"))
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(15 * 1024 * 1024)))
MAX_VECTOR_DISTANCE = float(os.environ.get("MAX_VECTOR_DISTANCE", "0.8"))
FILTER_KEYS = {"mood", "scene_type", "lighting", "time_of_day", "people_count", "date_added", "aspect_ratio"}
PRIVILEGED_GROUPS = {"admin", "reviewer"}
ADMIN_GROUPS = {"admin"}
ALLOWED_UPLOAD_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
SAFE_FILENAME_PATTERN = re.compile(r"[^A-Za-z0-9._-]+")
CHECKSUM_SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
MAX_CURATOR_VALUES = 20
MAX_CURATOR_VALUE_LENGTH = 80
MAX_POLICY_VALUE_LENGTH = 120
REVIEW_STATUSES = {"approved", "pending_review", "rejected"}
VISIBILITY_VALUES = {"library", "restricted"}
CONSENT_STATUSES = {"approved", "missing", "not_required", "restricted", "expired"}
USAGE_RIGHTS = {"internal_only", "public_release", "campaign_limited", "do_not_use", "unknown"}


def _s3_client() -> Any:
    return boto3.client("s3")


def _dynamodb_client() -> Any:
    return boto3.client("dynamodb")


def _cognito_client() -> Any:
    return boto3.client("cognito-idp")


def _response(status_code: int, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload),
    }


def _event_headers(event: dict[str, Any]) -> dict[str, str]:
    return {str(key).lower(): str(value) for key, value in (event.get("headers") or {}).items()}


def _json_body(event: dict[str, Any]) -> dict[str, Any]:
    raw_body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw_body = base64.b64decode(raw_body).decode("utf-8")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as error:
        raise ValueError("request body must be valid JSON") from error

    if not isinstance(payload, dict):
        raise ValueError("request body must be a JSON object")

    return payload


def _is_upload_request(event: dict[str, Any]) -> bool:
    route_key = event.get("routeKey")
    method = event.get("requestContext", {}).get("http", {}).get("method")
    raw_path = event.get("rawPath", "")
    return route_key == "POST /uploads/presign" or (method == "POST" and raw_path.endswith("/uploads/presign"))


def _is_asset_tags_request(event: dict[str, Any]) -> bool:
    route_key = event.get("routeKey")
    method = event.get("requestContext", {}).get("http", {}).get("method")
    raw_path = event.get("rawPath", "")
    return route_key == "POST /assets/tags" or (method == "POST" and raw_path.endswith("/assets/tags"))


def _is_asset_policy_request(event: dict[str, Any]) -> bool:
    route_key = event.get("routeKey")
    method = event.get("requestContext", {}).get("http", {}).get("method")
    raw_path = event.get("rawPath", "")
    return route_key == "POST /assets/policy" or (method == "POST" and raw_path.endswith("/assets/policy"))


def _is_review_queue_request(event: dict[str, Any]) -> bool:
    route_key = event.get("routeKey")
    method = event.get("requestContext", {}).get("http", {}).get("method")
    raw_path = event.get("rawPath", "")
    return route_key == "GET /assets/review" or (method == "GET" and raw_path.endswith("/assets/review"))


def _is_admin_users_request(event: dict[str, Any]) -> bool:
    route_key = event.get("routeKey")
    method = event.get("requestContext", {}).get("http", {}).get("method")
    raw_path = event.get("rawPath", "")
    return route_key == "POST /admin/users" or (method == "POST" and raw_path.endswith("/admin/users"))


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


def _has_valid_upload_token(event: dict[str, Any]) -> bool:
    if not UPLOAD_TOKEN_SHA256:
        return False

    supplied_token = _event_headers(event).get("x-upload-token", "")
    supplied_hash = hashlib.sha256(supplied_token.encode("utf-8")).hexdigest()
    return hmac.compare_digest(supplied_hash, UPLOAD_TOKEN_SHA256)


def _safe_upload_filename(filename: str, content_type: str) -> str:
    raw_name = filename.replace("\\", "/").split("/")[-1].strip()
    if not raw_name:
        raise ValueError("filename required")

    base_name, _extension = os.path.splitext(raw_name)
    extension = ALLOWED_UPLOAD_TYPES[content_type]

    safe_base = SAFE_FILENAME_PATTERN.sub("-", base_name).strip(".-_")[:80]
    return f"{safe_base or 'upload'}{extension}"


def _upload_key_for_checksum(checksum_sha256: str, content_type: str) -> str:
    extension = ALLOWED_UPLOAD_TYPES[content_type]
    return f"uploads/sha256/{checksum_sha256[:2]}/{checksum_sha256}{extension}"


def _safe_asset_key(key: str) -> str:
    normalized_key = key.replace("\\", "/").strip()
    if not normalized_key:
        raise ValueError("asset key required")

    if normalized_key.startswith("/") or ".." in normalized_key.split("/"):
        raise ValueError("asset key is invalid")

    return normalized_key


def _object_exists(key: str) -> bool:
    try:
        _s3_client().head_object(Bucket=PHOTO_BUCKET_NAME, Key=key)
    except ClientError as error:
        code = str(error.response.get("Error", {}).get("Code", ""))
        if code in {"404", "NoSuchKey", "NotFound"}:
            return False
        raise

    return True


def _curator_values(payload: dict[str, Any], key: str) -> list[str]:
    raw_values = payload.get(key, [])
    if raw_values is None:
        return []

    if isinstance(raw_values, str):
        values = [item.strip() for item in raw_values.split(",")]
    elif isinstance(raw_values, list):
        values = [str(item).strip() for item in raw_values]
    else:
        raise ValueError(f"{key} must be a list or comma-separated string")

    cleaned_values: list[str] = []
    seen_values: set[str] = set()
    for value in values:
        normalized = re.sub(r"\s+", " ", value).strip()
        if not normalized:
            continue

        if len(normalized) > MAX_CURATOR_VALUE_LENGTH:
            raise ValueError(f"{key} values must be {MAX_CURATOR_VALUE_LENGTH} characters or fewer")

        dedupe_key = normalized.lower()
        if dedupe_key not in seen_values:
            cleaned_values.append(normalized)
            seen_values.add(dedupe_key)

    if len(cleaned_values) > MAX_CURATOR_VALUES:
        raise ValueError(f"{key} can include at most {MAX_CURATOR_VALUES} values")

    return cleaned_values


def _policy_string(payload: dict[str, Any], key: str, allowed_values: set[str] | None = None) -> str:
    value = str(payload.get(key, "") or "").strip()
    if not value:
        return ""

    normalized = re.sub(r"\s+", " ", value)
    if len(normalized) > MAX_POLICY_VALUE_LENGTH:
        raise ValueError(f"{key} must be {MAX_POLICY_VALUE_LENGTH} characters or fewer")

    if allowed_values is not None and normalized not in allowed_values:
        raise ValueError(f"{key} must be one of: {', '.join(sorted(allowed_values))}")

    return normalized


def _policy_date(payload: dict[str, Any], key: str) -> str:
    value = str(payload.get(key, "") or "").strip()
    if not value:
        return ""

    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError(f"{key} must use YYYY-MM-DD format")

    return value


def _role_values(payload: dict[str, Any]) -> list[str]:
    roles = _curator_values(payload, "groups")
    allowed_roles = LIBRARY_ROLE_NAMES or {"admin", "reviewer", "marketing", "hr", "compliance", "facilities"}
    unsupported = sorted(set(roles) - allowed_roles)
    if unsupported:
        raise ValueError(f"unsupported groups: {', '.join(unsupported)}")

    return roles


def _has_curator_access(event: dict[str, Any], security_context: dict[str, Any]) -> bool:
    return bool(set(security_context["groups"]) & PRIVILEGED_GROUPS) or _has_valid_upload_token(event)


def _has_upload_access(event: dict[str, Any], security_context: dict[str, Any]) -> bool:
    return bool(set(security_context["groups"]) & (LIBRARY_ROLE_NAMES or PRIVILEGED_GROUPS)) or _has_valid_upload_token(event)


def _has_admin_access(security_context: dict[str, Any]) -> bool:
    return bool(set(security_context["groups"]) & ADMIN_GROUPS)


def _audit_asset_tags(
    *,
    asset_key: str,
    curator_tags: list[str],
    security_context: dict[str, Any],
    staff_names: list[str],
) -> None:
    if not AUDIT_LOG_TABLE_NAME:
        return

    now = datetime.now(UTC)
    item = {
        "event_id": {"S": str(uuid4())},
        "asset_key": {"S": asset_key},
        "created_at": {"S": now.isoformat()},
        "curator_tags_csv": {"S": ",".join(curator_tags)},
        "event_type": {"S": "asset_tags_updated"},
        "expires_at": {"N": str(int((now + timedelta(days=AUDIT_LOG_RETENTION_DAYS)).timestamp()))},
        "groups_csv": {"S": ",".join(security_context["groups"])},
        "principal_id": {"S": security_context["principal_id"]},
        "staff_names_csv": {"S": ",".join(staff_names)},
    }

    try:
        _dynamodb_client().put_item(Item=item, TableName=AUDIT_LOG_TABLE_NAME)
    except Exception as error:  # pragma: no cover - audit logging must not fail curation.
        LOGGER.warning("audit logging failed: %s", error)


def _handle_upload_presign(event: dict[str, Any]) -> dict[str, Any]:
    security_context = _security_context(event)
    if not _has_upload_access(event, security_context):
        return _response(401, {"error": "authorized uploader required"})

    try:
        payload = _json_body(event)
        filename = str(payload.get("filename", "")).strip()
        content_type = str(payload.get("content_type", "")).split(";")[0].strip().lower()
        size_bytes = int(payload.get("size_bytes", 0))
        checksum_sha256 = str(payload.get("checksum_sha256", "")).strip().lower()
    except (TypeError, ValueError) as error:
        return _response(400, {"error": str(error)})

    if content_type not in ALLOWED_UPLOAD_TYPES:
        return _response(400, {"error": "only JPEG, PNG, and WebP images are supported"})

    if size_bytes <= 0 or size_bytes > MAX_UPLOAD_BYTES:
        return _response(400, {"error": f"file must be between 1 byte and {MAX_UPLOAD_BYTES} bytes"})

    if not CHECKSUM_SHA256_PATTERN.fullmatch(checksum_sha256):
        return _response(400, {"error": "checksum_sha256 must be a 64-character lowercase hex SHA-256 digest"})

    try:
        _safe_upload_filename(filename, content_type)
    except ValueError as error:
        return _response(400, {"error": str(error)})

    key = _upload_key_for_checksum(checksum_sha256, content_type)
    if _object_exists(key):
        return _response(
            200,
            {
                "bucket": PHOTO_BUCKET_NAME,
                "content_type": content_type,
                "duplicate": True,
                "key": key,
            },
        )

    upload_headers = {
        "Content-Type": content_type,
        "x-amz-meta-sha256": checksum_sha256,
    }
    upload_url = _s3_client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": PHOTO_BUCKET_NAME,
            "ContentType": content_type,
            "Key": key,
            "Metadata": {"sha256": checksum_sha256},
        },
        ExpiresIn=UPLOAD_URL_TTL_SECONDS,
    )

    return _response(
        200,
        {
            "bucket": PHOTO_BUCKET_NAME,
            "content_type": content_type,
            "duplicate": False,
            "expires_in": UPLOAD_URL_TTL_SECONDS,
            "headers": upload_headers,
            "key": key,
            "method": "PUT",
            "upload_url": upload_url,
        },
    )


def _handle_asset_tags(event: dict[str, Any]) -> dict[str, Any]:
    if not ASSET_POLICY_TABLE_NAME:
        return _response(403, {"error": "asset tagging is disabled for this deployment"})

    security_context = _security_context(event)
    if not _has_curator_access(event, security_context):
        return _response(403, {"error": "admin, reviewer, or owner token required"})

    try:
        payload = _json_body(event)
        asset_key = _safe_asset_key(str(payload.get("key", "")))
        curator_tags = _curator_values(payload, "curator_tags")
        staff_names = _curator_values(payload, "staff_names")
    except (TypeError, ValueError) as error:
        return _response(400, {"error": str(error)})

    now = datetime.now(UTC).isoformat()
    curator_tags_lc = [tag.lower() for tag in curator_tags]
    staff_names_lc = [name.lower() for name in staff_names]
    _dynamodb_client().update_item(
        ExpressionAttributeValues={
            ":curator_tags": {"S": ",".join(curator_tags)},
            ":curator_tags_lc": {"S": ",".join(curator_tags_lc)},
            ":staff_names": {"S": ",".join(staff_names)},
            ":staff_names_lc": {"S": ",".join(staff_names_lc)},
            ":updated_at": {"S": now},
            ":updated_by": {"S": security_context["principal_id"]},
        },
        Key={"asset_key": {"S": asset_key}},
        TableName=ASSET_POLICY_TABLE_NAME,
        UpdateExpression=(
            "SET curator_tags = :curator_tags, "
            "curator_tags_lc = :curator_tags_lc, "
            "staff_names = :staff_names, "
            "staff_names_lc = :staff_names_lc, "
            "updated_at = :updated_at, "
            "updated_by = :updated_by"
        ),
    )
    _audit_asset_tags(
        asset_key=asset_key,
        curator_tags=curator_tags,
        security_context=security_context,
        staff_names=staff_names,
    )

    return _response(
        200,
        {
            "curator_tags": curator_tags,
            "key": asset_key,
            "staff_names": staff_names,
        },
    )


def _handle_asset_policy(event: dict[str, Any]) -> dict[str, Any]:
    if not ASSET_POLICY_TABLE_NAME:
        return _response(403, {"error": "asset policy updates are disabled for this deployment"})

    security_context = _security_context(event)
    if not _has_curator_access(event, security_context):
        return _response(403, {"error": "admin or reviewer access required"})

    try:
        payload = _json_body(event)
        asset_key = _safe_asset_key(str(payload.get("key", "")))
        curator_tags = _curator_values(payload, "curator_tags")
        staff_names = _curator_values(payload, "staff_names")
        allowed_groups = _role_values(payload) if "groups" in payload else []
        campaign = _policy_string(payload, "campaign")
        consent_status = _policy_string(payload, "consent_status", CONSENT_STATUSES)
        expiration_date = _policy_date(payload, "expiration_date")
        location = _policy_string(payload, "location")
        owner_department = _policy_string(payload, "owner_department")
        review_status = _policy_string(payload, "review_status", REVIEW_STATUSES)
        usage_rights = _policy_string(payload, "usage_rights", USAGE_RIGHTS)
        visibility = _policy_string(payload, "visibility", VISIBILITY_VALUES)
    except (TypeError, ValueError) as error:
        return _response(400, {"error": str(error)})

    now = datetime.now(UTC).isoformat()
    expression_values: dict[str, dict[str, str]] = {
        ":campaign": {"S": campaign},
        ":consent_status": {"S": consent_status},
        ":curator_tags": {"S": ",".join(curator_tags)},
        ":curator_tags_lc": {"S": ",".join(tag.lower() for tag in curator_tags)},
        ":expiration_date": {"S": expiration_date},
        ":location": {"S": location},
        ":owner_department": {"S": owner_department},
        ":review_status": {"S": review_status},
        ":staff_names": {"S": ",".join(staff_names)},
        ":staff_names_lc": {"S": ",".join(name.lower() for name in staff_names)},
        ":updated_at": {"S": now},
        ":updated_by": {"S": security_context["principal_id"]},
        ":usage_rights": {"S": usage_rights},
        ":visibility": {"S": visibility},
    }
    update_parts = [
        "campaign = :campaign",
        "consent_status = :consent_status",
        "curator_tags = :curator_tags",
        "curator_tags_lc = :curator_tags_lc",
        "expiration_date = :expiration_date",
        "#location = :location",
        "owner_department = :owner_department",
        "review_status = :review_status",
        "staff_names = :staff_names",
        "staff_names_lc = :staff_names_lc",
        "updated_at = :updated_at",
        "updated_by = :updated_by",
        "usage_rights = :usage_rights",
        "visibility = :visibility",
    ]
    if allowed_groups:
        expression_values[":allowed_groups"] = {"S": ",".join(allowed_groups)}
        update_parts.append("allowed_groups = :allowed_groups")

    _dynamodb_client().update_item(
        ExpressionAttributeNames={"#location": "location"},
        ExpressionAttributeValues=expression_values,
        Key={"asset_key": {"S": asset_key}},
        TableName=ASSET_POLICY_TABLE_NAME,
        UpdateExpression="SET " + ", ".join(update_parts),
    )
    _audit_asset_tags(
        asset_key=asset_key,
        curator_tags=curator_tags,
        security_context=security_context,
        staff_names=staff_names,
    )

    return _response(
        200,
        {
            "campaign": campaign,
            "consent_status": consent_status,
            "curator_tags": curator_tags,
            "expiration_date": expiration_date,
            "groups": allowed_groups,
            "key": asset_key,
            "location": location,
            "owner_department": owner_department,
            "review_status": review_status,
            "staff_names": staff_names,
            "usage_rights": usage_rights,
            "visibility": visibility,
        },
    )


def _handle_review_queue(event: dict[str, Any]) -> dict[str, Any]:
    if not ASSET_POLICY_TABLE_NAME:
        return _response(403, {"error": "review queue is disabled for this deployment"})

    security_context = _security_context(event)
    groups = set(security_context["groups"])
    if not groups & PRIVILEGED_GROUPS:
        return _response(403, {"error": "admin or reviewer access required"})

    params = event.get("queryStringParameters") or {}
    limit = min(max(int(params.get("limit", 24)), 1), 50)
    response = _dynamodb_client().query(
        ExpressionAttributeValues={":status": {"S": "pending_review"}},
        IndexName=REVIEW_STATUS_INDEX_NAME,
        KeyConditionExpression="review_status = :status",
        Limit=limit,
        TableName=ASSET_POLICY_TABLE_NAME,
    )

    results: list[dict[str, Any]] = []
    for item in response.get("Items", []):
        policy_metadata = _policy_metadata(item)
        results.append(_policy_item_to_result(item, policy_metadata))

    return _response(200, {"message": "review queue loaded", "results": results})


def _handle_admin_users(event: dict[str, Any]) -> dict[str, Any]:
    if not COGNITO_USER_POOL_ID:
        return _response(403, {"error": "admin user management is disabled for this deployment"})

    security_context = _security_context(event)
    if not _has_admin_access(security_context):
        return _response(403, {"error": "admin access required"})

    try:
        payload = _json_body(event)
        email = str(payload.get("email", "")).strip().lower()
        groups = _role_values(payload)
    except (TypeError, ValueError) as error:
        return _response(400, {"error": str(error)})

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return _response(400, {"error": "email must be a valid email address"})

    client = _cognito_client()
    try:
        client.admin_create_user(
            DesiredDeliveryMediums=["EMAIL"],
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
            ],
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=email,
        )
    except ClientError as error:
        code = str(error.response.get("Error", {}).get("Code", ""))
        if code != "UsernameExistsException":
            raise

    for group in groups:
        client.admin_add_user_to_group(GroupName=group, UserPoolId=COGNITO_USER_POOL_ID, Username=email)

    return _response(200, {"email": email, "groups": groups, "message": "user invited"})


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


def _ddb_int(value: dict[str, Any] | None) -> int | None:
    if not value or "N" not in value:
        return None

    try:
        return int(value["N"])
    except ValueError:
        return None


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


def _csv_metadata(value: Any) -> list[str]:
    if not value:
        return []

    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    return [item.strip() for item in str(value).split(",") if item.strip()]


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


def _policy_metadata(policy: dict[str, Any] | None) -> dict[str, Any]:
    if policy is None:
        return {
            "campaign": "",
            "consent_status": "missing",
            "curator_tags": [],
            "expiration_date": "",
            "location": "",
            "owner_department": "",
            "review_status": "missing_policy",
            "staff_names": [],
            "usage_rights": "unknown",
            "visibility": "library",
        }

    return {
        "campaign": _ddb_string(policy.get("campaign")),
        "consent_status": _ddb_string(policy.get("consent_status"), "missing"),
        "curator_tags": _csv_metadata(_ddb_string(policy.get("curator_tags"))),
        "expiration_date": _ddb_string(policy.get("expiration_date")),
        "location": _ddb_string(policy.get("location")),
        "owner_department": _ddb_string(policy.get("owner_department")),
        "review_status": _ddb_string(policy.get("review_status"), "approved"),
        "staff_names": _csv_metadata(_ddb_string(policy.get("staff_names"))),
        "usage_rights": _ddb_string(policy.get("usage_rights"), "unknown"),
        "visibility": _ddb_string(policy.get("visibility"), "library"),
    }


def _authorize_asset(s3_key: str, groups: set[str]) -> tuple[bool, dict[str, Any]]:
    if not ASSET_POLICY_TABLE_NAME:
        return True, {"curator_tags": [], "review_status": "unmanaged", "staff_names": [], "visibility": "library"}

    policy = _get_asset_policy(s3_key)
    if policy is None:
        allowed = MISSING_POLICY_DEFAULT != "deny"
        return allowed, _policy_metadata(None)

    metadata = _policy_metadata(policy)
    review_status = metadata["review_status"]
    visibility = metadata["visibility"]
    allowed_groups = set(_ddb_string_list(policy.get("allowed_groups")))
    is_privileged = bool(groups & PRIVILEGED_GROUPS)

    if review_status in {"pending_review", "rejected"}:
        return is_privileged, metadata

    if visibility == "restricted" and not (is_privileged or groups & allowed_groups):
        return False, metadata

    return True, metadata


def enrich_with_signed_url(match: Match, policy_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
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
        "lighting": match.metadata.get("lighting", "other"),
        "people_count": match.metadata.get("people_count", 0),
        "aspect_ratio": match.metadata.get("aspect_ratio", "landscape"),
        "subjects": _csv_metadata(match.metadata.get("subjects_csv")),
        "colors": _csv_metadata(match.metadata.get("colors_csv")),
        "objects_detected": _csv_metadata(match.metadata.get("objects_csv")),
        "thumbnail_url": signed_url,
        "image_url": signed_url,
        "s3_key": s3_key,
        "campaign": (policy_metadata or {}).get("campaign", ""),
        "consent_status": (policy_metadata or {}).get("consent_status", "missing"),
        "curator_tags": (policy_metadata or {}).get("curator_tags", []),
        "expiration_date": (policy_metadata or {}).get("expiration_date", ""),
        "location": (policy_metadata or {}).get("location", ""),
        "owner_department": (policy_metadata or {}).get("owner_department", ""),
        "review_status": (policy_metadata or {}).get("review_status", "unmanaged"),
        "staff_names": (policy_metadata or {}).get("staff_names", []),
        "usage_rights": (policy_metadata or {}).get("usage_rights", "unknown"),
        "visibility": (policy_metadata or {}).get("visibility", "library"),
    }


def _policy_item_to_result(item: dict[str, Any], policy_metadata: dict[str, Any]) -> dict[str, Any]:
    asset_key = _ddb_string(item.get("asset_key"))
    signed_url = _s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": PHOTO_BUCKET_NAME, "Key": asset_key},
        ExpiresIn=SIGNED_URL_TTL_SECONDS,
    )
    description = _ddb_string(item.get("ai_description"), "Curated hospital media asset.")

    result = {
        "key": asset_key,
        "description": description,
        "alt_text": description[:160],
        "seo_caption": description[:140],
        "mood": _ddb_string(item.get("mood"), "neutral"),
        "scene_type": _ddb_string(item.get("scene_type"), "other"),
        "lighting": "other",
        "aspect_ratio": "landscape",
        "subjects": policy_metadata.get("curator_tags", []),
        "colors": [],
        "objects_detected": [],
        "thumbnail_url": signed_url,
        "image_url": signed_url,
        "s3_key": asset_key,
        "campaign": policy_metadata.get("campaign", ""),
        "consent_status": policy_metadata.get("consent_status", "missing"),
        "curator_tags": policy_metadata.get("curator_tags", []),
        "expiration_date": policy_metadata.get("expiration_date", ""),
        "location": policy_metadata.get("location", ""),
        "owner_department": policy_metadata.get("owner_department", ""),
        "review_status": policy_metadata.get("review_status", "unmanaged"),
        "staff_names": policy_metadata.get("staff_names", []),
        "usage_rights": policy_metadata.get("usage_rights", "unknown"),
        "visibility": policy_metadata.get("visibility", "library"),
        "match_type": "curator_tag",
    }
    people_count = _ddb_int(item.get("people_count"))
    if people_count is not None:
        result["people_count"] = people_count

    return result


def _curated_tag_matches(query_text: str, groups: set[str], limit: int) -> list[dict[str, Any]]:
    if not ASSET_POLICY_TABLE_NAME:
        return []

    normalized_query = query_text.strip().lower()
    if not normalized_query:
        return []

    response = _dynamodb_client().scan(
        ExpressionAttributeValues={":query": {"S": normalized_query}},
        FilterExpression="contains(curator_tags_lc, :query) OR contains(staff_names_lc, :query)",
        Limit=limit,
        TableName=ASSET_POLICY_TABLE_NAME,
    )

    results: list[dict[str, Any]] = []
    for item in response.get("Items", []):
        asset_key = _ddb_string(item.get("asset_key"))
        if not asset_key:
            continue

        policy_metadata = _policy_metadata(item)
        is_allowed, _authorized_metadata = _authorize_asset(asset_key, groups)
        if is_allowed:
            results.append(_policy_item_to_result(item, policy_metadata))

    return results


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
    """Handle semantic search and upload presign requests."""
    if _is_upload_request(event):
        return _handle_upload_presign(event)
    if _is_asset_tags_request(event):
        return _handle_asset_tags(event)
    if _is_asset_policy_request(event):
        return _handle_asset_policy(event)
    if _is_review_queue_request(event):
        return _handle_review_queue(event)
    if _is_admin_users_request(event):
        return _handle_admin_users(event)

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
    groups = set(security_context["groups"])
    results: list[dict[str, Any]] = _curated_tag_matches(query_text, groups, top_k)
    seen_keys = {str(result["key"]) for result in results}
    denied_count = 0
    for match in matches:
        if match.distance is not None and match.distance > MAX_VECTOR_DISTANCE:
            continue

        s3_key = match.metadata.get("s3_key", match.key)
        if str(s3_key) in seen_keys:
            continue

        is_allowed, policy_metadata = _authorize_asset(str(s3_key), groups)
        if is_allowed:
            results.append(enrich_with_signed_url(match, policy_metadata))
            seen_keys.add(str(s3_key))
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
