"""Bedrock helpers for the ingest Lambda."""

from __future__ import annotations

import base64
import json
import os
from typing import Any, cast

import boto3
from botocore.exceptions import ClientError
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from .prompts import SYSTEM_PROMPT
from .schema import PhotoMetadata, parse_photo_metadata


IMAGE_MODEL_ID = os.environ.get("BEDROCK_IMAGE_MODEL_ID", "us.amazon.nova-lite-v1:0")
EMBED_MODEL_ID = os.environ.get("BEDROCK_EMBED_MODEL_ID", "amazon.titan-embed-text-v2:0")
EMBED_DIMENSIONS = int(os.environ.get("BEDROCK_EMBED_DIMENSIONS", "1024"))
MEDIA_TYPE_FORMATS = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
}


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
def describe_image(image_bytes: bytes, media_type: str) -> PhotoMetadata:
    """Describe an image with Amazon Nova and validate the JSON response."""
    image_format = MEDIA_TYPE_FORMATS.get(media_type)
    if image_format is None:
        raise ValueError(f"unsupported image media type for Bedrock image analysis: {media_type}")

    body = json.dumps(
        {
            "schemaVersion": "messages-v1",
            "system": [{"text": SYSTEM_PROMPT}],
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "image": {
                                "format": image_format,
                                "source": {"bytes": base64.b64encode(image_bytes).decode("utf-8")},
                            }
                        },
                        {"text": "Describe this photo per the schema. Return only valid JSON."},
                    ],
                }
            ],
            "inferenceConfig": {"maxTokens": 800, "temperature": 0.1, "topP": 0.1},
        }
    )

    response = _bedrock_client().invoke_model(
        modelId=IMAGE_MODEL_ID,
        accept="application/json",
        contentType="application/json",
        body=body,
    )
    payload = json.loads(response["body"].read())
    content = payload.get("output", {}).get("message", {}).get("content", [])
    text_parts = [part.get("text", "") for part in content if "text" in part]

    return parse_photo_metadata("".join(text_parts))


@retry(
    reraise=True,
    retry=retry_if_exception(_is_retryable_throttle),
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=0.25, min=0.25, max=2),
)
def embed_text(text: str) -> list[float]:
    """Embed text with Titan Text Embeddings v2."""
    body = json.dumps(
        {
            "inputText": text,
            "dimensions": EMBED_DIMENSIONS,
            "normalize": True,
        }
    )

    response = _bedrock_client().invoke_model(
        modelId=EMBED_MODEL_ID,
        accept="application/json",
        contentType="application/json",
        body=body,
    )
    payload = json.loads(response["body"].read())
    return [float(value) for value in cast(list[float], payload["embedding"])]
