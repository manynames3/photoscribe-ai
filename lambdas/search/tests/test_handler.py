from __future__ import annotations

from json import loads

from lambdas.search import handler as search_handler
from lambdas.search.vectors import Match


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
