import os
import json
import httpx
import re
from bs4 import BeautifulSoup
from youtube_transcript_api import YouTubeTranscriptApi
from urllib.parse import urlparse
from google import genai
from pydantic import BaseModel
from typing import List

class AIResult(BaseModel):
    summary: str
    tags: List[str]
    suggested_collection: str | None = None

class AISearchResult(BaseModel):
    matching_ids: List[str]

# Initialize GenAI Client
def get_genai_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)

async def extract_text_from_url(url: str) -> str:
    """Fetches the webpage and extracts visible text content."""
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()

        soup = BeautifulSoup(response.text, "lxml")
        
        # Remove script and style elements
        for script in soup(["script", "style", "noscript", "header", "footer", "nav"]):
            script.decompose()

        # Extract text and collapse whitespace
        text = soup.get_text(separator=' ')
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        # Limit text length to avoid token limits (first 10,000 characters)
        return text[:10000]
    except Exception as e:
        print(f"Error extracting text from {url}: {e}")
        return ""

def extract_youtube_video_id(url: str) -> str:
    """Extracts YouTube video ID from a given URL."""
    # Matches standard youtube.com/watch?v=ID and youtu.be/ID
    pattern = r"(?:v=|\/)([0-9A-Za-z_-]{11}).*"
    match = re.search(pattern, url)
    return match.group(1) if match else ""

async def generate_bookmark_metadata(url: str, title: str, description: str, user_collections: List[str] = []) -> AIResult:
    """Uses Gemini to generate a summary, tags, and auto-categorization."""
    client = get_genai_client()
    
    # Fallback if no API key
    if not client:
        return AIResult(summary="", tags=[], suggested_collection=None)

    content_text = ""
    is_youtube = False

    # Check if URL is a YouTube video
    parsed_url = urlparse(url)
    host = (parsed_url.hostname or "").lower()
    is_youtube_host = host == "youtube.com" or host.endswith(".youtube.com") or host == "youtu.be"
    if is_youtube_host:
        video_id = extract_youtube_video_id(url)
        if video_id:
            try:
                # Fetch transcript
                transcript_list = YouTubeTranscriptApi().fetch(video_id)
                transcript_text = " ".join([t.text for t in transcript_list])
                content_text = transcript_text[:15000]  # Take first 15k chars to avoid limit
                is_youtube = True
            except Exception as e:
                print(f"Error fetching YouTube transcript: {e}")
                # Fallback to standard extraction
    
    # If not a YouTube video or transcript failed, extract normal web text
    if not content_text:
        content_text = await extract_text_from_url(url)
    
    # If standard extraction also failed, fallback to title and description
    if not content_text:
        content_text = f"Title: {title}\nDescription: {description}"

    if is_youtube:
        prompt = f"""
        You are an intelligent assistant. 
        Read the following raw transcript from a YouTube video and provide:
        1. A concise, 2-sentence summary of the main points discussed in the video.
        2. A list of 3 to 5 highly relevant, single-word tags (lowercase).
        3. A suggested collection name based on the content. Choose from this list of the user's existing collections: {user_collections}. If none fit well, suggest a new short collection name. If the list is empty, suggest a new short collection name.

        Video Transcript:
        {content_text}
        """
    else:
        prompt = f"""
        You are an intelligent assistant for a bookmarking app. 
        Read the following extracted webpage content and provide:
        1. A concise, 2-sentence summary of the main points.
        2. A list of 3 to 5 highly relevant, single-word tags (lowercase).
        3. A suggested collection name based on the content. Choose from this list of the user's existing collections: {user_collections}. If none fit well, suggest a new short collection name. If the list is empty, suggest a new short collection name.

        Webpage Content:
        {content_text}
        """

    try:
        # We use the recommended gemini-2.5-flash model
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config={
                'response_mime_type': 'application/json',
                'response_schema': AIResult,
                'temperature': 0.2
            }
        )
        
        # Parse the JSON response
        result_dict = json.loads(response.text)
        return AIResult(**result_dict)
    except Exception as e:
        print(f"Error generating AI metadata: {e}")
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
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config={
                'response_mime_type': 'application/json',
                'response_schema': AISearchResult,
                'temperature': 0.1
            }
        )
        
        result_dict = json.loads(response.text)
        return result_dict.get('matching_ids', [])
    except Exception as e:
        print(f"Error in semantic search: {e}")
        return []
