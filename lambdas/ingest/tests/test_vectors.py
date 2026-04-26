from __future__ import annotations

from lambdas.ingest import vectors


class FakeVectorsClient:
    def __init__(self) -> None:
        self.request = None

    def put_vectors(self, **kwargs):
        self.request = kwargs
        return {"vectors": []}


def test_put_vector_writes_metadata(monkeypatch) -> None:
    fake_client = FakeVectorsClient()
    monkeypatch.setattr(vectors, "_vectors_client", lambda: fake_client)
    monkeypatch.setattr(vectors, "VECTOR_BUCKET_NAME", "bucket")
    monkeypatch.setattr(vectors, "VECTOR_INDEX_NAME", "photos")

    vectors.put_vector(
        key="image.jpg",
        vector=[0.1, 0.2],
        filterable={"mood": "playful"},
        non_filterable={"description": "hello"},
    )

    assert fake_client.request["vectorBucketName"] == "bucket"
    assert fake_client.request["indexName"] == "photos"
    assert fake_client.request["vectors"][0]["metadata"]["mood"] == "playful"
    assert fake_client.request["vectors"][0]["metadata"]["description"] == "hello"
