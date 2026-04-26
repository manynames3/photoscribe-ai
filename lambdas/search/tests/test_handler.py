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
                "s3_key": "image.jpg",
            }
        ],
    }
