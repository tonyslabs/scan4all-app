import pytest

import main

HASH = 'a' * 32
URL_ID = 'aHR0cHM6Ly9leGFtcGxlLmNvbQ'
UPLOAD_URL = 'https://www.virustotal.com/_ah/upload/test'


@pytest.mark.parametrize('method,path,kwargs', [
    ('GET', f'/lookup/file/{HASH}', {}),
    ('GET', '/search', {'params': {'q': 'example.com'}}),
    ('POST', '/scan/url', {'json': {'url': 'https://example.com'}}),
])
def test_requires_token(client, isolated_service, method, path, kwargs):
    client.headers.pop('x-api-key')
    assert client.request(method, path, **kwargs).status_code == 401
    assert isolated_service[0] == []


@pytest.mark.parametrize('kind,ident,collection', [
    ('file', 'a' * 32, 'files'),
    ('file', 'B' * 40, 'files'),
    ('file', 'c' * 64, 'files'),
    ('url', URL_ID, 'urls'),
    ('domain', 'example.com', 'domains'),
    ('ip', '8.8.8.8', 'ip_addresses'),
    ('ip', '2001:db8::1', 'ip_addresses'),
])
def test_lookup(client, isolated_service, kind, ident, collection):
    calls, response = isolated_service
    result = client.get(f'/lookup/{kind}/{ident}')
    assert result.status_code == 200
    assert result.json() == response
    assert calls == [('GET', f'/{collection}/{ident}', {'timeout': 30})]


@pytest.mark.parametrize('kind,ident', [
    ('file', 'a' * 31), ('file', 'g' * 32), ('file', 'a' * 41),
    ('url', 'short'), ('url', 'bad!url!'),
    ('domain', 'localhost'), ('domain', '-bad.example.com'),
    ('ip', '999.1.1.1'), ('ip', '2001:xyz::1'),
    ('unknown', HASH),
])
def test_invalid_lookup(client, isolated_service, kind, ident):
    assert client.get(f'/lookup/{kind}/{ident}').status_code == 400
    assert isolated_service[0] == []


@pytest.mark.parametrize('kind,ident,collection', [
    ('file', HASH, 'files'), ('url', URL_ID, 'urls'),
    ('domain', 'example.com', 'domains'), ('ip', '8.8.8.8', 'ip_addresses'),
])
def test_rescan(client, isolated_service, kind, ident, collection):
    calls, response = isolated_service
    result = client.post(f'/lookup/{kind}/{ident}/rescan')
    assert result.status_code == 200
    assert result.json() == {'ok': True, 'vt': response}
    assert calls == [('POST', f'/{collection}/{ident}/analyse', {'timeout': 30})]


def test_relationships(client, isolated_service):
    calls, response = isolated_service
    result = client.get(f'/lookup/file/{HASH}/relationships/contacted_domains',
                        params={'limit': 7, 'cursor': 'next_page=='})
    assert result.status_code == 200
    assert result.json() == response
    assert calls == [('GET', f'/files/{HASH}/contacted_domains',
                      {'timeout': 30, 'params': {'limit': 7, 'cursor': 'next_page=='}})]


def test_invalid_relationship(client, isolated_service):
    assert client.get(f'/lookup/file/{HASH}/relationships/subdomains').status_code == 400
    assert isolated_service[0] == []


def test_get_comments(client, isolated_service):
    calls, response = isolated_service
    result = client.get(f'/lookup/file/{HASH}/comments', params={'limit': 4, 'cursor': 'next=='})
    assert result.status_code == 200
    assert result.json() == response
    assert calls == [('GET', f'/files/{HASH}/comments',
                      {'timeout': 30, 'params': {'limit': 4, 'cursor': 'next=='}})]


def test_post_comment(client, isolated_service):
    calls, response = isolated_service
    result = client.post(f'/lookup/file/{HASH}/comments', json={'text': 'A test comment'})
    assert result.status_code == 200
    assert result.json() == response
    assert calls == [('POST', f'/files/{HASH}/comments', {'timeout': 30, 'json': {
        'data': {'type': 'comment', 'attributes': {'text': 'A test comment'}}}})]


@pytest.mark.parametrize('verdict', ['harmless', 'malicious'])
def test_post_vote(client, isolated_service, verdict):
    calls, response = isolated_service
    result = client.post(f'/lookup/file/{HASH}/votes', json={'verdict': verdict})
    assert result.status_code == 200
    assert result.json() == response
    assert calls == [('POST', f'/files/{HASH}/votes', {'timeout': 30, 'json': {
        'data': {'type': 'vote', 'attributes': {'verdict': verdict}}}})]


def test_invalid_vote(client, isolated_service):
    assert client.post(f'/lookup/file/{HASH}/votes', json={'verdict': 'unknown'}).status_code == 422
    assert isolated_service[0] == []


def test_search(client, isolated_service):
    calls, response = isolated_service
    result = client.get('/search', params={'q': 'example.com', 'limit': 9})
    assert result.status_code == 200
    assert result.json() == response
    assert calls == [('GET', '/search', {'timeout': 30, 'params': {'query': 'example.com', 'limit': 9}})]


def test_scan_url(client, isolated_service):
    calls, response = isolated_service
    result = client.post('/scan/url', json={'url': 'https://example.com'})
    assert result.status_code == 200
    assert result.json() == {'ok': True, 'vt': response}
    assert calls == [('POST', '/urls', {'timeout': 30, 'data': {'url': 'https://example.com'}})]


def test_small_upload(client, isolated_service):
    calls, response = isolated_service
    result = client.post('/scan/upload', files={'file': ('sample.bin', b'x' * 1024, 'application/octet-stream')})
    assert result.status_code == 200
    assert result.json() == {'ok': True, 'vt': response}
    assert len(calls) == 1
    method, path, kwargs = calls[0]
    assert (method, path) == ('POST', '/files')
    assert kwargs['timeout'] == 120
    filename, stream, content_type = kwargs['files']['file']
    assert filename == 'sample.bin'
    assert content_type == 'application/octet-stream'


def test_empty_upload(client, isolated_service):
    assert client.post('/scan/upload', files={'file': ('empty.bin', b'')}).status_code == 400
    assert isolated_service[0] == []


@pytest.mark.parametrize('target,expected', [
    (UPLOAD_URL, 200),
    ('https://evil.example/upload', 502),
    ('https://www.virustotal.com.evil.example/upload', 502),
    ('http://www.virustotal.com/upload', 502),
])
def test_large_upload(client, isolated_service, target, expected):
    calls, response = isolated_service
    response['data'] = target
    result = client.post('/scan/upload', files={'file': ('large.bin', b'x' * (33 * 1024 * 1024))})
    assert result.status_code == expected
    assert calls[0] == ('GET', '/files/upload_url', {'timeout': 30})
    if expected == 200:
        assert result.json() == {'ok': True, 'vt': response}
        assert len(calls) == 2
        method, path, kwargs = calls[1]
        assert (method, path) == ('POST', UPLOAD_URL)
        assert kwargs['timeout'] == 900
        assert kwargs['files']['file'][0] == 'large.bin'
    else:
        assert len(calls) == 1


@pytest.mark.parametrize('size', [1024 * 1024 + 1, 2 * 1024 * 1024])
def test_upload_over_maximum(client, isolated_service, monkeypatch, size):
    monkeypatch.setattr(main, 'MAX_UPLOAD_BYTES', 1024 * 1024)
    assert client.post('/scan/upload', files={'file': ('oversize.bin', b'x' * size)}).status_code == 413
    assert isolated_service[0] == []
