"""S3 Vectors helpers for ingest."""

from __future__ import annotations

import os
from typing import Any

import boto3


VECTOR_BUCKET_NAME = os.environ.get("VECTOR_BUCKET_NAME", "")
VECTOR_INDEX_NAME = os.environ.get("VECTOR_INDEX_NAME", "")


def _vectors_client() -> Any:
    return boto3.client("s3vectors")


def put_vector(key: str, vector: list[float], filterable: dict[str, object], non_filterable: dict[str, object]) -> None:
    """Upsert a vector keyed by its source S3 object key."""
    metadata = dict(filterable)
    metadata.update(non_filterable)

    _vectors_client().put_vectors(
        vectorBucketName=VECTOR_BUCKET_NAME,
        indexName=VECTOR_INDEX_NAME,
        vectors=[
            {
                "key": key,
                "data": {"float32": [float(value) for value in vector]},
                "metadata": metadata,
            }
        ],
    )
