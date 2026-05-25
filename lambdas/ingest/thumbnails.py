"""Thumbnail helpers for uploaded photo assets."""

from __future__ import annotations

from hashlib import sha256
from io import BytesIO

from PIL import Image, ImageOps


THUMBNAIL_PREFIX = "thumbnails/"
THUMBNAIL_MAX_SIZE = (640, 640)


def is_thumbnail_key(key: str) -> bool:
    """Return whether an S3 key is an internally generated thumbnail."""
    return key.startswith(THUMBNAIL_PREFIX)


def thumbnail_key_for_asset(asset_key: str) -> str:
    """Create a deterministic thumbnail key without leaking the original object name."""
    digest = sha256(asset_key.encode("utf-8")).hexdigest()
    return f"{THUMBNAIL_PREFIX}{digest[:2]}/{digest}.webp"


def create_thumbnail(image_bytes: bytes) -> bytes:
    """Create a small WebP thumbnail suitable for grid/list UI previews."""
    with Image.open(BytesIO(image_bytes)) as image:
        normalized = ImageOps.exif_transpose(image).convert("RGB")
        normalized.thumbnail(THUMBNAIL_MAX_SIZE)

        output = BytesIO()
        normalized.save(output, format="WEBP", quality=78, method=4)
        return output.getvalue()

