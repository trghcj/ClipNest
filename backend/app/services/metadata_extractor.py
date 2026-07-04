import httpx
from bs4 import BeautifulSoup
from urllib.parse import urlparse

async def extract_metadata(url: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(url)
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

        return {
            "title": title.strip() if title else "",
            "description": description.strip() if description else "",
            "image_url": image_url.strip() if image_url else "",
            "favicon_url": favicon_url.strip() if favicon_url else "",
        }
    except Exception as e:
        print(f"Error extracting metadata for {url}: {e}")
        return {
            "title": "",
            "description": "",
            "image_url": "",
            "favicon_url": "",
        }
