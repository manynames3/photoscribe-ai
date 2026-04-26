"""Bedrock helpers for the search Lambda."""

from __future__ import annotations

import json
import os
from typing import Any, cast

import boto3
from botocore.exceptions import ClientError
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential


EMBED_MODEL_ID = os.environ.get("BEDROCK_EMBED_MODEL_ID", "amazon.titan-embed-text-v2:0")
EMBED_DIMENSIONS = int(os.environ.get("BEDROCK_EMBED_DIMENSIONS", "1024"))


def _bedrock_client() -> Any:
    return boto3.client("bedrock-runtime")


def _is_retryable_throttle(error: BaseException) -> bool:
    if not isinstance(error, ClientError):
        return False

    code = error.response.get("Error", {}).get("Code")
    return code in {"ThrottlingException", "TooManyRequestsException", "ServiceUnavailableException"}


@retry(
    reraise=True,
    retry=retry_if_exception(_is_retryable_throttle),
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=0.25, min=0.25, max=2),
)
def embed_text(text: str) -> list[float]:
    """Embed text with Titan Text Embeddings v2."""
    response = _bedrock_client().invoke_model(
        modelId=EMBED_MODEL_ID,
        accept="application/json",
        contentType="application/json",
        body=json.dumps(
            {
                "inputText": text,
                "dimensions": EMBED_DIMENSIONS,
                "normalize": True,
            }
        ),
    )
    payload = json.loads(response["body"].read())
    return [float(value) for value in cast(list[float], payload["embedding"])]
