from __future__ import annotations

from io import BytesIO

from PIL import Image

from lambdas.ingest.thumbnails import create_thumbnail, is_thumbnail_key, thumbnail_key_for_asset


def test_thumbnail_key_is_deterministic_and_internal() -> None:
    key = thumbnail_key_for_asset("uploads/sha256/aa/image.jpg")

    assert key.startswith("thumbnails/")
    assert key.endswith(".webp")
    assert is_thumbnail_key(key)
    assert key == thumbnail_key_for_asset("uploads/sha256/aa/image.jpg")


def test_create_thumbnail_outputs_small_webp() -> None:
    source = BytesIO()
    Image.new("RGB", (1200, 800), color=(42, 96, 88)).save(source, format="JPEG")

    thumbnail = create_thumbnail(source.getvalue())

    with Image.open(BytesIO(thumbnail)) as image:
        assert image.format == "WEBP"
        assert max(image.size) <= 640

