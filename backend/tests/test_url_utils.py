"""Tests for the SSRF-safe fetcher and URL helpers.

Run from backend/:  pip install -r requirements-dev.txt && pytest
No network or database is needed: DNS and HTTP are faked.
"""
import asyncio
import gzip
import socket

import httpx
import pytest

from app.services import url_utils
from app.services.metadata_extractor import _parse_html_page, _transcript_html
from app.services.url_utils import (
    ResponseTooLargeError,
    UnsafeURLError,
    assert_public_url,
    safe_get,
    youtube_video_id,
)


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def fake_dns(monkeypatch):
    """Make getaddrinfo return addresses from a per-host queue (last answer repeats)."""
    answers: dict[str, list[str]] = {}

    def getaddrinfo(host, port, *args, **kwargs):
        queue = answers.get(host)
        if not queue:
            raise socket.gaierror(f"no fake DNS answer for {host}")
        ip = queue.pop(0) if len(queue) > 1 else queue[0]
        family = socket.AF_INET6 if ":" in ip else socket.AF_INET
        return [(family, socket.SOCK_STREAM, 6, "", (ip, port))]

    monkeypatch.setattr(socket, "getaddrinfo", getaddrinfo)
    return answers


@pytest.fixture
def fake_http(monkeypatch):
    """Route safe_get's HTTP client through a MockTransport; returns the list of sent requests."""
    sent: list[httpx.Request] = []
    routes = {}

    def handler(request: httpx.Request):
        sent.append(request)
        return routes.get(request.url.path, lambda r: httpx.Response(200, text="<title>ok</title>"))(request)

    real_client = httpx.AsyncClient
    monkeypatch.setattr(url_utils.httpx, "AsyncClient",
                        lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw))
    return sent, routes


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/", "http://169.254.169.254/latest/meta-data/", "http://10.0.0.5/",
    "http://192.168.1.1/", "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://0.0.0.0/",
    "file:///etc/passwd", "ftp://8.8.8.8/", "http:///nohost",
])
def test_blocks_internal_and_non_http(url):
    with pytest.raises(UnsafeURLError):
        run(assert_public_url(url))


def test_allows_public_ip():
    run(assert_public_url("http://8.8.8.8/"))


def test_rejects_host_resolving_to_internal(fake_dns):
    fake_dns["evil.example"] = ["10.1.2.3"]
    with pytest.raises(UnsafeURLError):
        run(assert_public_url("https://evil.example/"))


def test_connects_to_validated_ip_dns_rebinding(fake_dns, fake_http):
    sent, _ = fake_http
    # First lookup (the check) says public; any later lookup would say loopback.
    fake_dns["rebind.example"] = ["93.184.216.34", "127.0.0.1"]
    response = run(safe_get("https://rebind.example/page"))
    assert len(sent) == 1
    request = sent[0]
    assert request.url.host == "93.184.216.34"          # connected to the checked IP
    assert request.headers["host"] == "rebind.example"   # virtual host preserved
    assert request.extensions["sni_hostname"] == "rebind.example"  # TLS verified against hostname
    assert str(response.url) == "https://rebind.example/page"  # callers see the logical URL


def test_ipv6_and_port_are_preserved(fake_dns, fake_http):
    sent, _ = fake_http
    fake_dns["v6.example"] = ["2606:2800:220:1:248:1893:25c8:1946"]
    run(safe_get("http://v6.example:8080/x"))
    assert sent[0].url.host == "2606:2800:220:1:248:1893:25c8:1946"
    assert sent[0].url.port == 8080
    assert sent[0].headers["host"] == "v6.example:8080"


def test_redirect_into_internal_network_is_blocked(fake_dns, fake_http):
    _, routes = fake_http
    fake_dns["site.example"] = ["93.184.216.34"]
    routes["/go"] = lambda r: httpx.Response(302, headers={"location": "http://127.0.0.1/admin"})
    with pytest.raises(UnsafeURLError):
        run(safe_get("https://site.example/go"))


def test_redirect_is_followed_and_rechecked(fake_dns, fake_http):
    sent, routes = fake_http
    fake_dns["a.example"] = ["93.184.216.34"]
    fake_dns["b.example"] = ["93.184.216.35"]
    routes["/old"] = lambda r: httpx.Response(301, headers={"location": "https://b.example/new"})
    response = run(safe_get("https://a.example/old"))
    assert [r.url.host for r in sent] == ["93.184.216.34", "93.184.216.35"]
    assert str(response.url) == "https://b.example/new"


def test_oversized_body_rejected(fake_http):
    _, routes = fake_http
    routes["/big"] = lambda r: httpx.Response(200, content=b"x" * 2000)
    with pytest.raises(ResponseTooLargeError):
        run(safe_get("http://8.8.8.8/big", max_bytes=1000))


def test_gzip_response_is_decoded_once(fake_http):
    # Regression: the body was decompressed while streaming but the response was rebuilt
    # with Content-Encoding: gzip, so httpx tried to decompress it again and failed.
    _, routes = fake_http
    page = b"<html><title>compressed</title></html>"
    routes["/gz"] = lambda r: httpx.Response(200, content=gzip.compress(page), headers={"content-encoding": "gzip"})
    response = run(safe_get("http://8.8.8.8/gz"))
    assert response.content == page
    assert "compressed" in response.text


def test_credentials_in_url_rejected():
    with pytest.raises(UnsafeURLError):
        run(safe_get("http://user:pass@8.8.8.8/"))


@pytest.mark.parametrize("url,expected", [
    ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "dQw4w9WgXcQ"),
    ("https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"),
    ("https://m.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ("https://www.youtube.com/@somechannel", ""),
    ("https://www.youtube.com/channel/UCabcdefghijk", ""),
    ("https://example.com/watch?v=dQw4w9WgXcQ", ""),
])
def test_youtube_video_id(url, expected):
    assert youtube_video_id(url) == expected


def test_transcript_is_html_escaped():
    out = _transcript_html(["hello <img src=x onerror=alert(1)>.", "bye"])
    assert "<img" not in out and "&lt;img" in out


def test_page_parsing_resolves_relative_urls():
    meta = _parse_html_page(
        '<html><head><title> T </title><link rel="icon" href="/f.ico">'
        '<meta property="og:image" content="/i.png"></head><body><p>hi</p></body></html>',
        "https://ex.com/a/b",
    )
    assert meta["title"] == "T"
    assert meta["favicon_url"] == "https://ex.com/f.ico"
    assert meta["image_url"] == "https://ex.com/i.png"
