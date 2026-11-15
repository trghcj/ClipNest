import asyncio
import html
import logging
from urllib.parse import quote, urljoin, urlparse

from bs4 import BeautifulSoup
from readability import Document

from .url_utils import UnsafeURLError, assert_allowed_external_url, is_youtube_url, safe_get, youtube_video_id

logger = logging.getLogger(__name__)

EMPTY_METADATA = {"title": "", "description": "", "image_url": "", "favicon_url": "", "content": ""}


def fetch_youtube_transcript(video_id: str) -> list[str]:
    """Blocking: returns the transcript as a list of caption strings (run in a thread)."""
    from youtube_transcript_api import YouTubeTranscriptApi
    try:
        items = YouTubeTranscriptApi().fetch(video_id)  # youtube-transcript-api 1.x
    except AttributeError:
        items = YouTubeTranscriptApi.get_transcript(video_id)  # 0.6.x fallback
    texts = []
    for item in items:
        text = item["text"] if isinstance(item, dict) else getattr(item, "text", "")
        if text:
            texts.append(text)
    return texts


def _youtube_embed(video_id: str) -> str:
    return (
        '<div class="video-container mb-6 aspect-video w-full rounded-xl overflow-hidden shadow-lg border border-border bg-black">'
        f'<iframe width="100%" height="100%" src="https://www.youtube.com/embed/{video_id}" title="YouTube video player" '
        'frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" '
        "allowfullscreen></iframe></div>"
    )


def _transcript_html(captions: list[str]) -> str:
    """Group captions into paragraphs. Caption text is attacker-controlled, so it is HTML-escaped."""
    paragraphs, current = [], []
    for text in captions:
        current.append(text)
        if len(current) >= 10 or text.strip().endswith((".", "?", "!")):
            paragraphs.append(" ".join(current))
            current = []
    if current:
        paragraphs.append(" ".join(current))
    body = "".join(f"<p class='mb-3'>{html.escape(p)}</p>" for p in paragraphs)
    return (
        '<details class="group bg-muted/30 border border-border rounded-xl p-4 mb-6 transition-all">'
        '<summary class="font-medium cursor-pointer text-foreground flex items-center justify-between">'
        '<span class="flex items-center gap-2">'
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary">'
        '<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>'
        "View Video Transcript</span>"
        '<span class="text-[10px] uppercase tracking-wider font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">AI Extracted</span>'
        "</summary>"
        f'<div class="mt-4 pt-4 border-t border-border/50 text-foreground-secondary leading-relaxed text-sm">{body}</div>'
        "</details>"
    )


async def _extract_youtube(url: str) -> dict:
    video_id = youtube_video_id(url)
    data: dict = {}
    try:
        oembed = await safe_get(f"https://www.youtube.com/oembed?url={quote(url, safe='')}&format=json")
        data = oembed.json()
    except Exception as e:
        logger.info("YouTube oEmbed failed for %s: %s", url, e)
        if not video_id:
            raise
        data = {"title": "YouTube Video", "thumbnail_url": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"}

    content = ""
    if video_id:
        content = _youtube_embed(video_id)
        try:
            captions = await asyncio.to_thread(fetch_youtube_transcript, video_id)
            if captions:
                content += _transcript_html(captions)
        except Exception as e:
            logger.info("YouTube transcript unavailable for %s: %s", video_id, e)

    author = data.get("author_name")
    return {
        "title": data.get("title", ""),
        "description": f"Video by {author}" if author else "YouTube Video",
        "image_url": data.get("thumbnail_url", ""),
        "favicon_url": "https://www.youtube.com/favicon.ico",
        "content": content,
    }


def _parse_html_page(page_html: str, url: str) -> dict:
    """CPU-bound parsing (BeautifulSoup + readability); run in a thread."""
    soup = BeautifulSoup(page_html, "lxml")

    def meta(**attrs) -> str:
        tag = soup.find("meta", attrs=attrs)
        return (tag.get("content") or "").strip() if tag else ""

    title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""
    title = title or meta(property="og:title")
    description = meta(property="og:description") or meta(name="description")
    image_url = meta(property="og:image")

    icon = soup.find("link", rel="icon") or soup.find("link", rel="shortcut icon")
    parsed = urlparse(url)
    if icon and icon.get("href"):
        favicon_url = urljoin(url, icon["href"])
    else:
        favicon_url = f"{parsed.scheme}://{parsed.netloc}/favicon.ico"

    content = ""
    try:
        content = Document(page_html).summary()
    except Exception as e:
        logger.info("Readability extraction failed for %s: %s", url, e)

    return {
        "title": title,
        "description": description,
        "image_url": urljoin(url, image_url) if image_url else "",
        "favicon_url": favicon_url,
        "content": content,
    }


async def extract_metadata(url: str) -> dict:
    try:
        safe_url = await assert_allowed_external_url(url)
        if urlparse(safe_url).path.lower().endswith(".pdf"):
            from .pdf_extractor import extract_pdf_metadata
            return await extract_pdf_metadata(safe_url)
        if is_youtube_url(safe_url):
            return await _extract_youtube(safe_url)
        response = await safe_get(safe_url)
        if response.headers.get("content-type", "").lower().startswith("application/pdf"):
            # PDF served from a URL that doesn't end in .pdf (e.g. arxiv.org/pdf/<id>).
            from .pdf_extractor import parse_pdf_response
            return await parse_pdf_response(response.content, str(response.url))
        return await asyncio.to_thread(_parse_html_page, response.text, str(response.url))
    except UnsafeURLError as e:
        logger.warning("Blocked metadata fetch: %s", e)
        return dict(EMPTY_METADATA)
    except Exception as e:
        logger.info("Error extracting metadata for %s: %s", url, e)
        return dict(EMPTY_METADATA)
