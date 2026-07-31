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
        
        # Check for PDF
        if parsed_url.path.lower().endswith('.pdf'):
            from .pdf_extractor import extract_pdf_metadata
            return await extract_pdf_metadata(url, safe_url)
        
        domain = parsed_url.netloc.lower()
        is_youtube = domain == "youtube.com" or domain.endswith(".youtube.com") or domain == "youtu.be"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
        }
        
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=headers) as client:
            if is_youtube:
                import urllib.parse
                
                # Extract Video ID for Transcript and Fallback
                video_id = ""
                if "v=" in safe_url:
                    video_id = safe_url.split("v=")[1].split("&")[0]
                elif "youtu.be/" in safe_url:
                    video_id = safe_url.split("youtu.be/")[1].split("?")[0]

                # Use oEmbed API to reliably fetch YouTube metadata without bot blocking
                encoded_url = urllib.parse.quote(safe_url, safe='')
                oembed_url = f"https://www.youtube.com/oembed?url={encoded_url}&format=json"
                
                data = {}
                try:
                    response = await client.get(oembed_url)
                    response.raise_for_status()
                    data = response.json()
                except Exception as e:
                    print(f"Error with YouTube oEmbed: {e}")
                    # If oEmbed fails (e.g. embedding disabled, 401 Unauthorized), we fallback manually
                    if video_id:
                        data = {
                            "title": "YouTube Video",
                            "author_name": "Unknown",
                            "thumbnail_url": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
                        }
                    else:
                        raise e  # Let it fallback to standard HTTP scrape if not a standard video URL
                        
                transcript_text = ""
                if video_id:
                    try:
                        from youtube_transcript_api import YouTubeTranscriptApi
                        try:
                            # For version 0.6.x
                            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
                        except AttributeError:
                            # For version 1.x+
                            transcript_list = YouTubeTranscriptApi().fetch(video_id)
                        
                        html_content = f'''
                        <div class="video-container mb-6 aspect-video w-full rounded-xl overflow-hidden shadow-lg border border-border bg-black">
                            <iframe width="100%" height="100%" src="https://www.youtube.com/embed/{video_id}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
                        </div>
                        <details class="group bg-muted/30 border border-border rounded-xl p-4 mb-6 transition-all">
                            <summary class="font-medium cursor-pointer text-foreground flex items-center justify-between">
                                <span class="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                                    View Video Transcript
                                </span>
                                <span class="text-[10px] uppercase tracking-wider font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">AI Extracted</span>
                            </summary>
                            <div class="mt-4 pt-4 border-t border-border/50 text-foreground-secondary leading-relaxed text-sm">
                        '''
                        
                        current_p = []
                        for t in transcript_list:
                            # Handle both dictionary (v0.6.x) and object (v1.x)
                            text = t['text'] if isinstance(t, dict) else getattr(t, 'text', '')
                            if not text:
                                continue
                            current_p.append(text)
                            if len(current_p) >= 10 or text.strip().endswith(('.', '?', '!')):
                                html_content += f"<p class='mb-3'>{' '.join(current_p)}</p>"
                                current_p = []
                        
                        if current_p:
                            html_content += f"<p class='mb-3'>{' '.join(current_p)}</p>"
                            
                        html_content += "</div></details>"
                        transcript_text = html_content
                        
                    except Exception as e:
                        print(f"Failed to fetch YouTube transcript: {e}")
                        transcript_text = f'''
                        <div class="video-container mb-6 aspect-video w-full rounded-xl overflow-hidden shadow-lg border border-border bg-black">
                            <iframe width="100%" height="100%" src="https://www.youtube.com/embed/{video_id}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
                        </div>
                        '''

                return {
                    "title": data.get("title", ""),
                    "description": f"Video by {data.get('author_name', '')}" if data.get("author_name") else "YouTube Video",
                    "image_url": data.get("thumbnail_url", ""),
                    "favicon_url": "https://www.youtube.com/favicon.ico",
                    "content": transcript_text
                }
            
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
