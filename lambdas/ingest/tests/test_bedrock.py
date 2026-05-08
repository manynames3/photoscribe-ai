from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path

import pytest
from botocore.exceptions import ClientError

from lambdas.ingest import bedrock
from lambdas.ingest.schema import PhotoMetadata


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "sample_model_response.json"


class FakeClient:
    def __init__(self, responses: list[dict[str, object] | Exception]) -> None:
        self._responses = responses
        self.calls: list[dict[str, object]] = []

    def invoke_model(self, **kwargs: object) -> dict[str, BytesIO]:
        self.calls.append(kwargs)
        response = self._responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return {"body": BytesIO(json.dumps(response).encode("utf-8"))}


def _throttle_error() -> ClientError:
    return ClientError({"Error": {"Code": "ThrottlingException", "Message": "slow down"}}, "InvokeModel")


def test_describe_image_parses_nova_json(monkeypatch: pytest.MonkeyPatch) -> None:
    with FIXTURE_PATH.open("r", encoding="utf-8") as fixture_file:
        raw_json = fixture_file.read()

    client = FakeClient(
        [
            {
                "output": {
                    "message": {
                        "content": [
                            {
                                "text": raw_json,
                            }
                        ]
                    }
                }
            }
        ]
    )
    monkeypatch.setattr(bedrock, "IMAGE_MODEL_ID", "us.amazon.nova-lite-v1:0")
    monkeypatch.setattr(bedrock, "_bedrock_client", lambda: client)

    metadata = bedrock.describe_image(b"abc", "image/jpeg")
    request_body = json.loads(str(client.calls[0]["body"]))

    assert isinstance(metadata, PhotoMetadata)
    assert metadata.scene_type == "food"
    assert metadata.mood == "playful"
    assert client.calls[0]["modelId"] == "us.amazon.nova-lite-v1:0"
    assert request_body["schemaVersion"] == "messages-v1"
    assert request_body["messages"][0]["content"][0]["image"]["format"] == "jpeg"


def test_embed_text_retries_on_throttle(monkeypatch: pytest.MonkeyPatch) -> None:
    client = FakeClient([_throttle_error(), {"embedding": [0.1, 0.2, 0.3]}])
    monkeypatch.setattr(bedrock, "_bedrock_client", lambda: client)

    vector = bedrock.embed_text("hello")

    assert vector == [0.1, 0.2, 0.3]
