"""Helpers for fetching user-supplied URLs safely, and for recognising YouTube links."""
import asyncio
import ipaddress
import os
import re
import socket
from urllib.parse import urljoin, urlparse, parse_qs

import httpx

BROWSER_HEADERS = {
    # Browser-compatible, but honest about being a fetcher: sites such as Wikipedia reject
    # clients that pretend to be a plain browser and accept identified bots.
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 "
                  "ClipNestBot/1.0 (+https://clipnest-tau.vercel.app)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
MAX_REDIRECTS = 5
DEFAULT_MAX_BYTES = 5 * 1024 * 1024  # 5 MB is plenty for an HTML page


class UnsafeURLError(ValueError):
    """The URL points somewhere the server must not fetch (internal network, bad scheme...)."""


class ResponseTooLargeError(ValueError):
    """The response body exceeded the allowed size."""


def normalize_external_url(url: str) -> str:
    """Return a normalized external URL or raise UnsafeURLError."""
    normalized = (url or "").strip()
    parsed = urlparse(normalized)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise UnsafeURLError(f"Unsupported URL: {url}")
    if parsed.username or parsed.password:
        raise UnsafeURLError("URLs with credentials are not allowed")
    return parsed.geturl()


async def assert_allowed_external_url(url: str) -> str:
    """Validate user-provided URL against optional host allowlist and SSRF checks."""
    normalized = normalize_external_url(url)
    host = (urlparse(normalized).hostname or "").lower()
    allowed = {
        h.strip().lower()
        for h in os.getenv("ALLOWED_METADATA_HOSTS", "").split(",")
        if h.strip()
    }
    if allowed and host not in allowed:
        raise UnsafeURLError(f"Host is not allowed: {host}")
    await assert_public_url(normalized)
    return normalized


IPAddress = ipaddress.IPv4Address | ipaddress.IPv6Address


async def resolve_public_ips(url: str) -> list[IPAddress]:
    """Resolve the URL's host and return its addresses, or raise UnsafeURLError if the URL is
    not http(s) or *any* address is private/internal (SSRF guard)."""
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
    ips: list[IPAddress] = []
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        check = ip.ipv4_mapped if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped else ip
        if not check.is_global or check.is_multicast:  # ::ffff:127.0.0.1 is still loopback
            raise UnsafeURLError(f"Refusing to fetch internal address {check} for {parsed.hostname}")
        if ip not in ips:
            ips.append(ip)
    if not ips:
        raise UnsafeURLError(f"Cannot resolve host {parsed.hostname}")
    return ips


async def assert_public_url(url: str) -> None:
    """Reject non-http(s) URLs and hosts that resolve to private/internal addresses (SSRF guard)."""
    await resolve_public_ips(url)


def _pinned_request(client: httpx.AsyncClient, url: str, ip: IPAddress) -> httpx.Request:
    """Build a GET for ``url`` that connects to the already-validated ``ip``.

    Connecting to the checked address (instead of letting the HTTP client resolve the
    hostname a second time) closes the DNS-rebinding gap, where a hostile DNS server
    answers the check with a public IP and the real connection with an internal one.
    The original hostname is still sent as the Host header and as the TLS SNI name, so
    virtual hosting works and certificates are verified against the real hostname."""
    parsed = urlparse(url)
    port = f":{parsed.port}" if parsed.port else ""
    ip_host = f"[{ip}]" if ip.version == 6 else str(ip)
    try:
        hostname = parsed.hostname.encode("idna").decode("ascii")
    except UnicodeError as e:
        raise UnsafeURLError(f"Invalid hostname in {url}") from e
    return client.build_request(
        "GET",
        parsed._replace(netloc=ip_host + port).geturl(),
        headers={"Host": hostname + port},
        extensions={"sni_hostname": hostname},
    )


async def safe_get(
    url: str,
    *,
    timeout: float = 10.0,
    max_bytes: int = DEFAULT_MAX_BYTES,
    headers: dict | None = None,
) -> httpx.Response:
    """GET a public URL, following redirects manually so every hop is re-checked and
    connected to the validated IP, and stop reading once the body exceeds ``max_bytes``.
    The returned response's ``url`` is the logical (hostname) URL of the final hop."""
    async with httpx.AsyncClient(
        timeout=timeout, follow_redirects=False, headers=headers or BROWSER_HEADERS
    ) as client:
        current = normalize_external_url(url)
        for _ in range(MAX_REDIRECTS + 1):
            ips = await resolve_public_ips(current)
            response = await client.send(_pinned_request(client, current, ips[0]), stream=True)
            try:
                if response.is_redirect and "location" in response.headers:
                    current = normalize_external_url(urljoin(current, response.headers["location"]))
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
                # aiter_bytes() already decompressed the body (and the size cap applies to
                # the decompressed size), so drop the encoding/length headers or httpx
                # would try to decompress it a second time.
                out_headers = [
                    (k, v) for k, v in response.headers.multi_items()
                    if k.lower() not in ("content-encoding", "content-length", "transfer-encoding")
                ]
                return httpx.Response(
                    response.status_code,
                    headers=out_headers,
                    content=bytes(body),
                    request=httpx.Request("GET", current),
                )
            finally:
                await response.aclose()
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
