import io
import httpx
from pypdf import PdfReader
from urllib.parse import urlparse
import os

MAX_PDF_SIZE = 3 * 1024 * 1024 # 3MB
MAX_PAGES = 10 # As requested, bump to 10 pages

async def extract_pdf_metadata(url: str, safe_url: str) -> dict:
    """
    Safely download and parse a PDF file.
    Returns a dictionary with title and content, or empty if it fails/exceeds limits.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, headers=headers) as client:
            # Step 1: Use HEAD request to check size
            try:
                head_resp = await client.head(safe_url)
                if head_resp.status_code == 200:
                    content_length = head_resp.headers.get("Content-Length")
                    if content_length and int(content_length) > MAX_PDF_SIZE:
                        print(f"PDF too large: {content_length} bytes. Limit is {MAX_PDF_SIZE}")
                        return _fallback_metadata(url)
            except Exception as head_err:
                # HEAD might not be supported, proceed carefully with streaming GET
                pass

            # Step 2: Stream the GET request to enforce the limit
            pdf_bytes = io.BytesIO()
            downloaded_size = 0
            
            async with client.stream("GET", safe_url) as response:
                response.raise_for_status()
                async for chunk in response.aiter_bytes(chunk_size=8192):
                    downloaded_size += len(chunk)
                    if downloaded_size > MAX_PDF_SIZE:
                        print(f"PDF exceeded 3MB limit during download.")
                        return _fallback_metadata(url)
                    pdf_bytes.write(chunk)
            
            pdf_bytes.seek(0)
            
            # Step 3: Parse PDF using pypdf
            reader = PdfReader(pdf_bytes)
            
            title = ""
            if reader.metadata and reader.metadata.title:
                title = str(reader.metadata.title)
            
            if not title:
                # Fallback to filename from URL
                parsed = urlparse(url)
                filename = os.path.basename(parsed.path)
                if filename:
                    title = filename
                else:
                    title = url
                    
            text_content = ""
            num_pages = len(reader.pages)
            pages_to_extract = min(num_pages, MAX_PAGES)
            
            for i in range(pages_to_extract):
                page = reader.pages[i]
                text = page.extract_text()
                if text:
                    text_content += text + "\n\n"
                    
            # Return matching structure
            return {
                "title": title.strip(),
                "description": f"PDF Document ({num_pages} pages)",
                "image_url": "", # PDFs don't typically have an OG image we can easily grab
                "favicon_url": "https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg",
                "content": text_content.strip()
            }
            
    except Exception as e:
        print(f"Error extracting PDF: {e}")
        return _fallback_metadata(url)

def _fallback_metadata(url: str) -> dict:
    parsed = urlparse(url)
    filename = os.path.basename(parsed.path) or url
    return {
        "title": filename,
        "description": "PDF Document",
        "image_url": "",
        "favicon_url": "https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg",
        "content": ""
    }

def extract_local_pdf(pdf_bytes: bytes, filename: str) -> dict:
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        title = ""
        if reader.metadata and reader.metadata.title:
            title = str(reader.metadata.title)
        
        if not title:
            title = filename
            
        text_content = ""
        num_pages = len(reader.pages)
        pages_to_extract = min(num_pages, MAX_PAGES)
        
        for i in range(pages_to_extract):
            page = reader.pages[i]
            text = page.extract_text()
            if text:
                text_content += text + "\n\n"
                
        return {
            "title": title.strip(),
            "description": f"PDF Document ({num_pages} pages)",
            "image_url": "", 
            "favicon_url": "https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg",
            "content": text_content.strip(),
            "page_count": num_pages
        }
    except Exception as e:
        print(f"Error extracting local PDF: {e}")
        return _fallback_metadata(filename)

