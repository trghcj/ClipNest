import httpx
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from readability import Document

async def extract_metadata(url: str) -> dict:
    try:
        parsed_url = urlparse(url)
        if parsed_url.scheme not in ("http", "https"):
            return {}
            
        # Reconstruct URL to prevent SSRF tricks
        safe_url = parsed_url.geturl()
        
        domain = parsed_url.netloc.lower()
        is_youtube = domain == "youtube.com" or domain.endswith(".youtube.com") or domain == "youtu.be"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
        }
        
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=headers) as client:
            if is_youtube:
                # Use oEmbed API to reliably fetch YouTube metadata without bot blocking
                oembed_url = f"https://www.youtube.com/oembed?url={safe_url}&format=json"
                try:
                    response = await client.get(oembed_url)
                    response.raise_for_status()
                    data = response.json()
                    return {
                        "title": data.get("title", ""),
                        "description": f"Video by {data.get('author_name', '')}",
                        "image_url": data.get("thumbnail_url", ""),
                        "favicon_url": "https://www.youtube.com/favicon.ico"
                    }
                except Exception as e:
                    print(f"Error with YouTube oEmbed: {e}")
                    # Fallback to standard HTTP scrape if oEmbed fails
            
            response = await client.get(safe_url)
            response.raise_for_status()

        soup = BeautifulSoup(response.text, "lxml")
        
        # Extract title
        title = ""
        if soup.title:
            title = soup.title.string
        if not title:
            og_title = soup.find("meta", property="og:title")
            title = og_title["content"] if og_title else ""

        # Extract description
        description = ""
        og_desc = soup.find("meta", property="og:description")
        if og_desc:
            description = og_desc["content"]
        else:
            meta_desc = soup.find("meta", attrs={"name": "description"})
            if meta_desc:
                description = meta_desc["content"]

        # Extract image
        image_url = ""
        og_image = soup.find("meta", property="og:image")
        if og_image:
            image_url = og_image["content"]

        # Extract favicon
        favicon_url = ""
        icon_link = soup.find("link", rel="icon") or soup.find("link", rel="shortcut icon")
        if icon_link and icon_link.get("href"):
            href = icon_link["href"]
            if href.startswith("http"):
                favicon_url = href
            else:
                parsed_uri = urlparse(url)
                base = f"{parsed_uri.scheme}://{parsed_uri.netloc}"
                favicon_url = f"{base}{href}" if href.startswith("/") else f"{base}/{href}"
        else:
            parsed_uri = urlparse(url)
            favicon_url = f"{parsed_uri.scheme}://{parsed_uri.netloc}/favicon.ico"

        # Extract Readability Content
        clean_content = ""
        try:
            doc = Document(response.text)
            clean_content = doc.summary()
        except Exception as e:
            print(f"Readability extraction failed: {e}")

        return {
            "title": title.strip() if title else "",
            "description": description.strip() if description else "",
            "image_url": image_url.strip() if image_url else "",
            "favicon_url": favicon_url.strip() if favicon_url else "",
            "content": clean_content
        }
    except Exception as e:
        print(f"Error extracting metadata for {url}: {e}")
        return {
            "title": "",
            "description": "",
            "image_url": "",
            "favicon_url": "",
            "content": ""
        }
