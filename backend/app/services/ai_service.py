import asyncio
import json
import logging
import os
from functools import lru_cache
from typing import List

from bs4 import BeautifulSoup
from google import genai
from google.genai import types
from pydantic import BaseModel

from .metadata_extractor import fetch_youtube_transcript
from .url_utils import is_youtube_url, safe_get, youtube_video_id

logger = logging.getLogger(__name__)

MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
MAX_CONTENT_CHARS = 15000
# google-genai 3.x switched the default Gemini API version from v1beta to v1. Structured
# JSON output (response_schema) has always been used through v1beta here, so pin it.
GEMINI_API_VERSION = os.getenv("GEMINI_API_VERSION", "v1beta")


class AIResult(BaseModel):
    summary: str
    tags: List[str]
    suggested_collection: str | None = None


class AISearchResult(BaseModel):
    matching_ids: List[str]


@lru_cache(maxsize=1)
def get_genai_client():
    """One shared client (and connection pool) per process; None when no API key is configured."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key, http_options=types.HttpOptions(api_version=GEMINI_API_VERSION))


def html_to_text(markup: str, limit: int = MAX_CONTENT_CHARS) -> str:
    """CPU-bound: strip markup and collapse whitespace. Run through asyncio.to_thread."""
    soup = BeautifulSoup(markup, "lxml")
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "iframe"]):
        tag.decompose()
    return " ".join(soup.get_text(separator=" ").split())[:limit]


async def extract_text_from_url(url: str) -> str:
    """Fetch a public web page and return its visible text."""
    try:
        response = await safe_get(url, timeout=15.0)
        return await asyncio.to_thread(html_to_text, response.text, 10000)
    except Exception as e:
        logger.info("Error extracting text from %s: %s", url, e)
        return ""


async def _content_for_ai(url: str, content: str | None) -> str:
    # 1. Reuse what the metadata extractor already pulled (article HTML, PDF text or the
    #    YouTube transcript) instead of downloading the same page/transcript again.
    if content:
        text = await asyncio.to_thread(html_to_text, content)
        if text:
            return text
    # 2. Nothing stored yet: fetch it.
    video_id = youtube_video_id(url)
    if video_id:
        try:
            captions = await asyncio.to_thread(fetch_youtube_transcript, video_id)
            text = " ".join(captions)[:MAX_CONTENT_CHARS]
            if text:
                return text
        except Exception as e:
            logger.info("Error fetching YouTube transcript for %s: %s", video_id, e)
    return await extract_text_from_url(url)


async def generate_bookmark_metadata(url: str, title: str, description: str, user_collections: List[str] | None = None, content: str | None = None) -> AIResult:
    """Uses Gemini to generate a summary, tags, and auto-categorization."""
    client = get_genai_client()
    if not client:
        return AIResult(summary="", tags=[], suggested_collection=None)

    user_collections = user_collections or []
    content_text = await _content_for_ai(url, content) or f"Title: {title}\nDescription: {description}"
    source = "raw transcript from a YouTube video" if is_youtube_url(url) else "extracted webpage content"
    label = "Video Transcript" if is_youtube_url(url) else "Webpage Content"

    prompt = f"""
    You are an intelligent assistant for a bookmarking app.
    Read the following {source} and provide:
    1. A concise, 2-sentence summary of the main points.
    2. A list of 3 to 5 highly relevant, single-word tags (lowercase).
    3. A suggested collection name based on the content. Choose from this list of the user's existing collections: {user_collections}. If none fit well, suggest a new short collection name. If the list is empty, suggest a new short collection name.

    {label}:
    {content_text}
    """

    try:
        response = await client.aio.models.generate_content(
            model=MODEL,
            contents=prompt,
            config={"response_mime_type": "application/json", "response_schema": AIResult, "temperature": 0.2},
        )
        return AIResult(**json.loads(response.text))
    except Exception as e:
        logger.warning("Error generating AI metadata for %s: %s", url, e)
        return AIResult(summary="", tags=[], suggested_collection=None)


async def perform_semantic_search(query: str, bookmarks_data: str) -> List[str]:
    """Uses Gemini to find bookmarks matching a natural language query."""
    client = get_genai_client()
    if not client:
        return []

    prompt = f"""
    You are an intelligent search assistant.
    The user is looking for bookmarks that match this query: "{query}"

    Below is a JSON list of the user's bookmarks (id, title, description, summary, tags).
    Analyze the semantics of the query and find all bookmarks that are highly relevant.
    Return ONLY a JSON object containing a list of the matching bookmark IDs under the key 'matching_ids'.
    If none match, return an empty list.

    Bookmarks:
    {bookmarks_data}
    """

    try:
        response = await client.aio.models.generate_content(
            model=MODEL,
            contents=prompt,
            config={"response_mime_type": "application/json", "response_schema": AISearchResult, "temperature": 0.1},
        )
        return json.loads(response.text).get("matching_ids", [])
    except Exception as e:
        logger.warning("Error in semantic search: %s", e)
        return []
