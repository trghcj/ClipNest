import asyncio
import io
import logging
import os
from urllib.parse import urlparse

from pypdf import PdfReader

from .url_utils import ResponseTooLargeError, safe_get

logger = logging.getLogger(__name__)

MAX_PDF_SIZE = 3 * 1024 * 1024         # PDFs fetched from a URL
MAX_UPLOAD_PDF_SIZE = 10 * 1024 * 1024  # PDFs uploaded by the user
MAX_PAGES = 10
PDF_ICON = "https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg"


def _fallback_metadata(name: str) -> dict:
    filename = os.path.basename(urlparse(name).path) or name
    return {"title": filename, "description": "PDF Document", "image_url": "", "favicon_url": PDF_ICON, "content": ""}


def _parse_pdf(pdf_bytes: bytes, fallback_title: str) -> dict:
    """CPU-bound pypdf parsing; call through asyncio.to_thread."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    title = str(reader.metadata.title) if reader.metadata and reader.metadata.title else ""
    num_pages = len(reader.pages)
    texts = []
    for i in range(min(num_pages, MAX_PAGES)):
        text = reader.pages[i].extract_text()
        if text:
            texts.append(text)
    return {
        "title": (title or fallback_title).strip(),
        "description": f"PDF Document ({num_pages} pages)",
        "image_url": "",
        "favicon_url": PDF_ICON,
        "content": "\n\n".join(texts).strip(),
        "page_count": num_pages,
    }


async def extract_pdf_metadata(url: str) -> dict:
    """Download (size-limited, SSRF-checked) and parse a PDF from a URL."""
    try:
        response = await safe_get(url, timeout=15.0, max_bytes=MAX_PDF_SIZE)
        fallback_title = os.path.basename(urlparse(url).path) or url
        return await asyncio.to_thread(_parse_pdf, response.content, fallback_title)
    except ResponseTooLargeError as e:
        logger.info("PDF too large: %s", e)
    except Exception as e:
        logger.info("Error extracting PDF %s: %s", url, e)
    return _fallback_metadata(url)


async def parse_pdf_response(pdf_bytes: bytes, url: str) -> dict:
    """Parse a PDF that was already downloaded from ``url``."""
    try:
        fallback_title = os.path.basename(urlparse(url).path) or url
        return await asyncio.to_thread(_parse_pdf, pdf_bytes, fallback_title)
    except Exception as e:
        logger.info("Error parsing PDF from %s: %s", url, e)
        return _fallback_metadata(url)


async def extract_local_pdf(pdf_bytes: bytes, filename: str) -> dict:
    try:
        return await asyncio.to_thread(_parse_pdf, pdf_bytes, filename)
    except Exception as e:
        logger.info("Error extracting uploaded PDF %s: %s", filename, e)
        return _fallback_metadata(filename)
