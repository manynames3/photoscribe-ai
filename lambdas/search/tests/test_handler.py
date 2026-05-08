from __future__ import annotations

from hashlib import sha256
from json import dumps, loads

from botocore.exceptions import ClientError

from lambdas.search import handler as search_handler
from lambdas.search.vectors import Match


def _not_found_error() -> ClientError:
    return ClientError({"Error": {"Code": "404"}}, "HeadObject")


def test_search_handler_requires_q() -> None:
    response = search_handler.handler({"queryStringParameters": {}}, None)
    assert response["statusCode"] == 400
    assert loads(response["body"]) == {"error": "q required"}


def test_search_handler_rejects_invalid_filter() -> None:
    response = search_handler.handler({"queryStringParameters": {"q": "test", "filter": "not-json"}}, None)
    assert response["statusCode"] == 400
    assert loads(response["body"]) == {"error": "filter must be valid JSON"}


def test_search_handler_returns_enriched_results(monkeypatch) -> None:
    monkeypatch.setattr(search_handler, "embed_text", lambda _query: [0.1, 0.2, 0.3])
    monkeypatch.setattr(
        search_handler,
        "query",
        lambda *_args, **_kwargs: [
            Match(
                key="image.jpg",
                distance=0.12,
                metadata={
                    "description": "A portrait at sunset.",
                    "alt_text": "Portrait at sunset",
                    "seo_caption": "Sunset portrait",
                    "mood": "confident",
                    "scene_type": "portrait",
                    "lighting": "golden_hour",
                    "people_count": 1,
                    "aspect_ratio": "portrait",
                    "subjects_csv": "clinician,headshot",
                    "colors_csv": "white,blue",
                    "objects_csv": "lab coat,stethoscope",
                    "s3_key": "image.jpg",
                },
            )
        ],
    )

    class FakeS3Client:
        def generate_presigned_url(self, *_args, **_kwargs) -> str:
            return "https://signed.example/image.jpg"

    monkeypatch.setattr(search_handler, "_s3_client", lambda: FakeS3Client())
    monkeypatch.setattr(search_handler, "PHOTO_BUCKET_NAME", "photos")

    response = search_handler.handler({"queryStringParameters": {"q": "golden hour portrait"}}, None)

    assert response["statusCode"] == 200
    assert loads(response["body"]) == {
        "message": "search complete",
        "query": "golden hour portrait",
        "results": [
            {
                "key": "image.jpg",
                "distance": 0.12,
                "description": "A portrait at sunset.",
                "alt_text": "Portrait at sunset",
                "seo_caption": "Sunset portrait",
                "mood": "confident",
                "scene_type": "portrait",
                "lighting": "golden_hour",
                "people_count": 1,
                "aspect_ratio": "portrait",
                "subjects": ["clinician", "headshot"],
                "colors": ["white", "blue"],
                "objects_detected": ["lab coat", "stethoscope"],
                "thumbnail_url": "https://signed.example/image.jpg",
                "image_url": "https://signed.example/image.jpg",
                "review_status": "unmanaged",
                "s3_key": "image.jpg",
                "visibility": "library",
            }
        ],
        "security_context": {
            "auth_mode": "anonymous",
            "denied_results": 0,
            "groups": [],
        },
    }


def test_search_handler_filters_assets_by_policy_and_audits(monkeypatch) -> None:
    monkeypatch.setattr(search_handler, "embed_text", lambda _query: [0.1, 0.2, 0.3])
    monkeypatch.setattr(
        search_handler,
        "query",
        lambda *_args, **_kwargs: [
            Match(
                key="approved.jpg",
                distance=0.1,
                metadata={"description": "Approved image.", "s3_key": "approved.jpg"},
            ),
            Match(
                key="pending.jpg",
                distance=0.2,
                metadata={"description": "Pending image.", "s3_key": "pending.jpg"},
            ),
        ],
    )

    class FakeS3Client:
        def generate_presigned_url(self, *_args, **_kwargs) -> str:
            return "https://signed.example/image.jpg"

    audit_items: list[dict[str, object]] = []

    class FakeDynamoDBClient:
        def get_item(self, *, Key: dict[str, dict[str, str]], **_kwargs) -> dict[str, object]:
            key = Key["asset_key"]["S"]
            policies = {
                "approved.jpg": {
                    "review_status": {"S": "approved"},
                    "visibility": {"S": "library"},
                },
                "pending.jpg": {
                    "review_status": {"S": "pending_review"},
                    "visibility": {"S": "library"},
                },
            }
            return {"Item": policies[key]}

        def put_item(self, *, Item: dict[str, object], **_kwargs) -> None:
            audit_items.append(Item)

    monkeypatch.setattr(search_handler, "_s3_client", lambda: FakeS3Client())
    monkeypatch.setattr(search_handler, "_dynamodb_client", lambda: FakeDynamoDBClient())
    monkeypatch.setattr(search_handler, "ASSET_POLICY_TABLE_NAME", "asset-policy")
    monkeypatch.setattr(search_handler, "AUDIT_LOG_TABLE_NAME", "audit-log")
    monkeypatch.setattr(search_handler, "PHOTO_BUCKET_NAME", "photos")

    response = search_handler.handler({"queryStringParameters": {"q": "policy test"}}, None)
    body = loads(response["body"])

    assert response["statusCode"] == 200
    assert [result["key"] for result in body["results"]] == ["approved.jpg"]
    assert body["security_context"]["denied_results"] == 1
    assert audit_items[0]["denied_count"]["N"] == "1"
    assert audit_items[0]["result_count"]["N"] == "1"


def test_search_handler_filters_weak_vector_matches(monkeypatch) -> None:
    monkeypatch.setattr(search_handler, "embed_text", lambda _query: [0.1, 0.2, 0.3])
    monkeypatch.setattr(search_handler, "MAX_VECTOR_DISTANCE", 0.8)
    monkeypatch.setattr(
        search_handler,
        "query",
        lambda *_args, **_kwargs: [
            Match(
                key="strong.jpg",
                distance=0.42,
                metadata={"description": "Strong match.", "s3_key": "strong.jpg"},
            ),
            Match(
                key="weak.jpg",
                distance=0.93,
                metadata={"description": "Weak match.", "s3_key": "weak.jpg"},
            ),
        ],
    )

    class FakeS3Client:
        def generate_presigned_url(self, *_args, **_kwargs) -> str:
            return "https://signed.example/image.jpg"

    monkeypatch.setattr(search_handler, "_s3_client", lambda: FakeS3Client())
    monkeypatch.setattr(search_handler, "ASSET_POLICY_TABLE_NAME", "")
    monkeypatch.setattr(search_handler, "AUDIT_LOG_TABLE_NAME", "")
    monkeypatch.setattr(search_handler, "PHOTO_BUCKET_NAME", "photos")

    response = search_handler.handler({"queryStringParameters": {"q": "doctor"}}, None)
    body = loads(response["body"])

    assert response["statusCode"] == 200
    assert [result["key"] for result in body["results"]] == ["strong.jpg"]


def test_search_handler_allows_reviewers_to_view_pending_assets(monkeypatch) -> None:
    monkeypatch.setattr(search_handler, "embed_text", lambda _query: [0.1, 0.2, 0.3])
    monkeypatch.setattr(
        search_handler,
        "query",
        lambda *_args, **_kwargs: [
            Match(
                key="pending.jpg",
                distance=0.2,
                metadata={"description": "Pending image.", "s3_key": "pending.jpg"},
            )
        ],
    )

    class FakeS3Client:
        def generate_presigned_url(self, *_args, **_kwargs) -> str:
            return "https://signed.example/pending.jpg"

    class FakeDynamoDBClient:
        def get_item(self, **_kwargs) -> dict[str, object]:
            return {
                "Item": {
                    "review_status": {"S": "pending_review"},
                    "visibility": {"S": "library"},
                }
            }

    monkeypatch.setattr(search_handler, "_s3_client", lambda: FakeS3Client())
    monkeypatch.setattr(search_handler, "_dynamodb_client", lambda: FakeDynamoDBClient())
    monkeypatch.setattr(search_handler, "ASSET_POLICY_TABLE_NAME", "asset-policy")
    monkeypatch.setattr(search_handler, "AUDIT_LOG_TABLE_NAME", "")
    monkeypatch.setattr(search_handler, "PHOTO_BUCKET_NAME", "photos")

    response = search_handler.handler(
        {
            "queryStringParameters": {"q": "pending"},
            "requestContext": {
                "authorizer": {
                    "jwt": {
                        "claims": {
                            "cognito:groups": "reviewer",
                            "sub": "user-1",
                        }
                    }
                }
            },
        },
        None,
    )
    body = loads(response["body"])

    assert response["statusCode"] == 200
    assert body["results"][0]["review_status"] == "pending_review"
    assert body["security_context"]["auth_mode"] == "jwt"
    assert body["security_context"]["groups"] == ["reviewer"]


def test_upload_presign_requires_enabled_upload_token(monkeypatch) -> None:
    monkeypatch.setattr(search_handler, "UPLOAD_TOKEN_SHA256", "")

    response = search_handler.handler(
        {
            "routeKey": "POST /uploads/presign",
            "body": dumps({"filename": "image.jpg", "content_type": "image/jpeg", "size_bytes": 100}),
        },
        None,
    )

    assert response["statusCode"] == 403
    assert loads(response["body"]) == {"error": "browser uploads are disabled for this deployment"}


def test_upload_presign_rejects_invalid_token(monkeypatch) -> None:
    monkeypatch.setattr(search_handler, "UPLOAD_TOKEN_SHA256", sha256(b"correct").hexdigest())

    response = search_handler.handler(
        {
            "routeKey": "POST /uploads/presign",
            "headers": {"x-upload-token": "wrong"},
            "body": dumps({"filename": "image.jpg", "content_type": "image/jpeg", "size_bytes": 100}),
        },
        None,
    )

    assert response["statusCode"] == 401
    assert loads(response["body"]) == {"error": "valid upload token required"}


def test_upload_presign_returns_signed_put_url(monkeypatch) -> None:
    class FakeS3Client:
        def head_object(self, **_kwargs: object) -> dict[str, object]:
            raise _not_found_error()

        def generate_presigned_url(self, operation: str, **kwargs: object) -> str:
            assert operation == "put_object"
            assert kwargs["Params"]["Bucket"] == "photos"
            assert kwargs["Params"]["ContentType"] == "image/webp"
            assert kwargs["Params"]["Metadata"] == {"sha256": "a" * 64}
            assert kwargs["Params"]["Key"] == f"uploads/sha256/aa/{'a' * 64}.webp"
            return "https://signed.example/upload"

    monkeypatch.setattr(search_handler, "_s3_client", lambda: FakeS3Client())
    monkeypatch.setattr(search_handler, "PHOTO_BUCKET_NAME", "photos")
    monkeypatch.setattr(search_handler, "UPLOAD_TOKEN_SHA256", sha256(b"secret").hexdigest())

    response = search_handler.handler(
        {
            "routeKey": "POST /uploads/presign",
            "headers": {"x-upload-token": "secret"},
            "body": dumps(
                {
                    "checksum_sha256": "a" * 64,
                    "content_type": "image/webp",
                    "filename": "My Image.jpeg",
                    "size_bytes": 100,
                }
            ),
        },
        None,
    )
    body = loads(response["body"])

    assert response["statusCode"] == 200
    assert body["content_type"] == "image/webp"
    assert body["duplicate"] is False
    assert body["headers"] == {"Content-Type": "image/webp", "x-amz-meta-sha256": "a" * 64}
    assert body["key"] == f"uploads/sha256/aa/{'a' * 64}.webp"
    assert body["method"] == "PUT"
    assert body["upload_url"] == "https://signed.example/upload"


def test_upload_presign_skips_existing_checksum(monkeypatch) -> None:
    class FakeS3Client:
        def head_object(self, **kwargs: object) -> dict[str, object]:
            assert kwargs["Bucket"] == "photos"
            assert kwargs["Key"] == f"uploads/sha256/bb/{'b' * 64}.jpg"
            return {}

        def generate_presigned_url(self, *_args: object, **_kwargs: object) -> str:
            raise AssertionError("duplicate objects should not receive a new presigned URL")

    monkeypatch.setattr(search_handler, "_s3_client", lambda: FakeS3Client())
    monkeypatch.setattr(search_handler, "PHOTO_BUCKET_NAME", "photos")
    monkeypatch.setattr(search_handler, "UPLOAD_TOKEN_SHA256", sha256(b"secret").hexdigest())

    response = search_handler.handler(
        {
            "routeKey": "POST /uploads/presign",
            "headers": {"x-upload-token": "secret"},
            "body": dumps(
                {
                    "checksum_sha256": "b" * 64,
                    "content_type": "image/jpeg",
                    "filename": "duplicate.jpg",
                    "size_bytes": 100,
                }
            ),
        },
        None,
    )
    body = loads(response["body"])

    assert response["statusCode"] == 200
    assert body == {
        "bucket": "photos",
        "content_type": "image/jpeg",
        "duplicate": True,
        "key": f"uploads/sha256/bb/{'b' * 64}.jpg",
    }


def test_upload_presign_rejects_unsupported_content_type(monkeypatch) -> None:
    monkeypatch.setattr(search_handler, "UPLOAD_TOKEN_SHA256", sha256(b"secret").hexdigest())

    response = search_handler.handler(
        {
            "routeKey": "POST /uploads/presign",
            "headers": {"x-upload-token": "secret"},
            "body": dumps({"filename": "image.heic", "content_type": "image/heic", "size_bytes": 100}),
        },
        None,
    )

    assert response["statusCode"] == 400
    assert loads(response["body"]) == {"error": "only JPEG, PNG, and WebP images are supported"}
