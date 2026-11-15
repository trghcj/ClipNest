"""Tests for rate limiting, URL validation/duplicate matching and the migration history."""
import pathlib

import pytest
from fastapi import HTTPException

from app.api.endpoints.bookmarks import _url_variants, _validated_url
from app.core.rate_limit import RateLimit

BACKEND = pathlib.Path(__file__).resolve().parents[1]


def test_rate_limit_allows_up_to_limit_then_429():
    limiter = RateLimit("test", limit=3, window_seconds=60)
    for t in (0, 1, 2):
        limiter.hit("alice", now=t)
    with pytest.raises(HTTPException) as exc:
        limiter.hit("alice", now=3)
    assert exc.value.status_code == 429
    assert exc.value.headers["Retry-After"] == "57"  # oldest hit (t=0) expires at t=60


def test_rate_limit_window_slides_and_is_per_user():
    limiter = RateLimit("test", limit=2, window_seconds=10)
    limiter.hit("alice", now=0)
    limiter.hit("alice", now=5)
    limiter.hit("bob", now=5)            # other users are unaffected
    limiter.hit("alice", now=10.5)       # the t=0 hit has left the window
    with pytest.raises(HTTPException):
        limiter.hit("alice", now=11)


def test_rate_limit_can_be_disabled(monkeypatch):
    monkeypatch.setenv("RATE_LIMITS_DISABLED", "1")
    limiter = RateLimit("test", limit=1, window_seconds=60)
    for t in range(5):
        limiter.hit("alice", now=t)


@pytest.mark.parametrize("url", [
    "http://intranet.local/wiki",       # private/intranet hosts may be saved (no preview)
    "http://192.168.1.10:8080/page",
    "  https://example.com/a?b=c  ",
])
def test_validated_url_allows_saving_any_http_url(url):
    assert _validated_url(url) == url.strip()


@pytest.mark.parametrize("url", ["ftp://example.com/x", "javascript:alert(1)", "https://user:pw@example.com/", "not a url"])
def test_validated_url_rejects_bad_urls(url):
    with pytest.raises(HTTPException) as exc:
        _validated_url(url)
    assert exc.value.status_code == 400


def test_url_variants_cover_trailing_slash():
    assert set(_url_variants("https://example.com/post")) == {"https://example.com/post", "https://example.com/post/"}
    assert set(_url_variants("https://example.com/post/")) == {"https://example.com/post", "https://example.com/post/"}


def test_migrations_have_a_single_head():
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "alembic"))
    heads = ScriptDirectory.from_config(config).get_heads()
    assert len(heads) == 1, f"multiple alembic heads: {heads}"
