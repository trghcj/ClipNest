"""Helpers for fetching user-supplied URLs safely, and for recognising YouTube links."""
import asyncio
import ipaddress
import re
import socket
from urllib.parse import urljoin, urlparse, parse_qs

import httpx

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}
MAX_REDIRECTS = 5
DEFAULT_MAX_BYTES = 5 * 1024 * 1024  # 5 MB is plenty for an HTML page


class UnsafeURLError(ValueError):
    """The URL points somewhere the server must not fetch (internal network, bad scheme...)."""


class ResponseTooLargeError(ValueError):
    """The response body exceeded the allowed size."""


async def assert_public_url(url: str) -> None:
    """Reject non-http(s) URLs and hosts that resolve to private/internal addresses (SSRF guard)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise UnsafeURLError(f"Unsupported URL: {url}")
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(
            parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80),
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as e:
        raise UnsafeURLError(f"Cannot resolve host {parsed.hostname}") from e
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped  # ::ffff:127.0.0.1 is still loopback
        if not ip.is_global or ip.is_multicast:
            raise UnsafeURLError(f"Refusing to fetch internal address {ip} for {parsed.hostname}")


async def safe_get(
    url: str,
    *,
    timeout: float = 10.0,
    max_bytes: int = DEFAULT_MAX_BYTES,
    headers: dict | None = None,
) -> httpx.Response:
    """GET a public URL, following redirects manually so every hop is re-checked,
    and stop reading once the body exceeds ``max_bytes``."""
    async with httpx.AsyncClient(
        timeout=timeout, follow_redirects=False, headers=headers or BROWSER_HEADERS
    ) as client:
        current = url
        for _ in range(MAX_REDIRECTS + 1):
            await assert_public_url(current)
            async with client.stream("GET", current) as response:
                if response.is_redirect and "location" in response.headers:
                    current = urljoin(current, response.headers["location"])
                    continue
                response.raise_for_status()
                declared = response.headers.get("content-length")
                if declared and declared.isdigit() and int(declared) > max_bytes:
                    raise ResponseTooLargeError(f"{current} is {declared} bytes")
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > max_bytes:
                        raise ResponseTooLargeError(f"{current} exceeded {max_bytes} bytes")
                return httpx.Response(
                    response.status_code,
                    headers=response.headers,
                    content=bytes(body),
                    request=response.request,
                )
        raise UnsafeURLError(f"Too many redirects for {url}")


_YOUTUBE_ID = re.compile(r"^[0-9A-Za-z_-]{11}$")


def is_youtube_url(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host in ("youtube.com", "youtu.be") or host.endswith(".youtube.com")


def youtube_video_id(url: str) -> str:
    """Return the 11-character video ID for youtube.com/watch?v=, youtu.be/, /shorts/, /embed/
    and /live/ links, or "" if the URL is not a YouTube video link."""
    if not is_youtube_url(url):
        return ""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    candidate = ""
    if host == "youtu.be":
        candidate = parsed.path.lstrip("/").split("/")[0]
    else:
        candidate = (parse_qs(parsed.query).get("v") or [""])[0]
        if not candidate:
            parts = [p for p in parsed.path.split("/") if p]
            if len(parts) >= 2 and parts[0] in ("shorts", "embed", "live", "v"):
                candidate = parts[1]
    return candidate if _YOUTUBE_ID.match(candidate) else ""
