import os
import sys
from pathlib import Path

os.environ['VT_API_KEY'] = 'x'
os.environ['API_TOKEN'] = '0123456789abcdef0123'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def isolated_service(monkeypatch):
    main._hits.clear()
    calls = []
    response = {'data': {'id': 'fake-analysis'}}

    async def fake_request(method, path, **kwargs):
        calls.append((method, path, kwargs))
        return response

    monkeypatch.setattr(main, 'vt_request', fake_request)
    yield calls, response
    main._hits.clear()


@pytest.fixture
def client():
    with TestClient(main.app, headers={'x-api-key': os.environ['API_TOKEN']}) as client:
        yield client
