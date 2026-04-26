from __future__ import annotations

from lambdas.search import vectors


class FakeVectorsClient:
    def query_vectors(self, **kwargs):
        self.request = kwargs
        return {
            "vectors": [
                {
                    "key": "image.jpg",
                    "distance": 0.4,
                    "metadata": {"description": "desc", "mood": "serene", "s3_key": "image.jpg"},
                }
            ]
        }


def test_query_returns_matches(monkeypatch) -> None:
    fake_client = FakeVectorsClient()
    monkeypatch.setattr(vectors, "_vectors_client", lambda: fake_client)
    monkeypatch.setattr(vectors, "VECTOR_BUCKET_NAME", "bucket")
    monkeypatch.setattr(vectors, "VECTOR_INDEX_NAME", "photos")

    matches = vectors.query([0.1, 0.2], top_k=5, filter={"mood": "serene"})

    assert fake_client.request["filter"] == {"mood": "serene"}
    assert matches[0].key == "image.jpg"
    assert matches[0].metadata["description"] == "desc"
