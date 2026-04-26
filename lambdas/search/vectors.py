"""S3 Vectors helpers for search."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import boto3


VECTOR_BUCKET_NAME = os.environ.get("VECTOR_BUCKET_NAME", "")
VECTOR_INDEX_NAME = os.environ.get("VECTOR_INDEX_NAME", "")


@dataclass(slots=True)
class Match:
    key: str
    distance: float | None
    metadata: dict[str, Any]


def _vectors_client() -> Any:
    return boto3.client("s3vectors")


def query(vector: list[float], top_k: int = 20, filter: dict[str, Any] | None = None) -> list[Match]:
    """Query S3 Vectors for nearest neighbors."""
    request: dict[str, Any] = {
        "vectorBucketName": VECTOR_BUCKET_NAME,
        "indexName": VECTOR_INDEX_NAME,
        "queryVector": {"float32": [float(value) for value in vector]},
        "topK": top_k,
        "returnDistance": True,
        "returnMetadata": True,
    }
    if filter:
        request["filter"] = filter

    response = _vectors_client().query_vectors(**request)
    matches: list[Match] = []

    for item in response.get("vectors", []):
        matches.append(
            Match(
                key=item["key"],
                distance=float(item["distance"]) if "distance" in item else None,
                metadata=item.get("metadata", {}),
            )
        )

    return matches
