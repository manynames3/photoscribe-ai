from __future__ import annotations

import json
from io import BytesIO

import pytest
from botocore.exceptions import ClientError

from lambdas.search import bedrock


class FakeClient:
    def __init__(self, responses):
        self._responses = responses

    def invoke_model(self, **_kwargs):
        response = self._responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return {"body": BytesIO(json.dumps(response).encode("utf-8"))}


def _throttle_error() -> ClientError:
    return ClientError({"Error": {"Code": "ThrottlingException", "Message": "slow down"}}, "InvokeModel")


def test_embed_text_retries(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_client = FakeClient([_throttle_error(), {"embedding": [0.1, 0.2]}])
    monkeypatch.setattr(bedrock, "_bedrock_client", lambda: fake_client)

    assert bedrock.embed_text("hello") == [0.1, 0.2]
