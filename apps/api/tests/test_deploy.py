import main

HASH = 'a' * 64


def test_rate_limit_por_ip_real_detras_del_tunel(client, monkeypatch):
    monkeypatch.setattr(main, 'TRUST_PROXY', True)
    # El límite se evalúa al crear la dependencia: se registra otra con límite 1.
    limited = main.rate_limit('t', 1)
    from types import SimpleNamespace
    req = lambda ip: SimpleNamespace(headers={'cf-connecting-ip': ip}, client=SimpleNamespace(host='10.0.0.1'))
    import asyncio
    asyncio.run(limited(req('1.1.1.1')))
    asyncio.run(limited(req('2.2.2.2')))  # otra IP real: no comparte cupo
    try:
        asyncio.run(limited(req('1.1.1.1')))
        assert False, 'debió limitar'
    except main.HTTPException as e:
        assert e.status_code == 429


def test_sin_trust_proxy_se_ignora_el_header():
    from types import SimpleNamespace
    r = SimpleNamespace(headers={'cf-connecting-ip': '9.9.9.9'}, client=SimpleNamespace(host='10.0.0.1'))
    assert main.client_ip(r) == '10.0.0.1'


def test_comentarios_y_votos_se_pueden_desactivar(client, monkeypatch, isolated_service):
    monkeypatch.setattr(main, 'ALLOW_WRITES', False)
    assert client.post(f'/lookup/file/{HASH}/comments', json={'text': 'hola'}).status_code == 403
    assert client.post(f'/lookup/file/{HASH}/votes', json={'verdict': 'harmless'}).status_code == 403
    assert client.get(f'/lookup/file/{HASH}/comments').status_code == 200
    assert not [c for c in isolated_service[0] if c[0] == 'POST']
