import os
import json
import httpx
from bs4 import BeautifulSoup
from google import genai
from pydantic import BaseModel
from typing import List

class AIResult(BaseModel):
    summary: str
    tags: List[str]

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

async def generate_bookmark_metadata(url: str, title: str, description: str) -> AIResult:
    """Uses Gemini to generate a summary and tags based on webpage content."""
    client = get_genai_client()
    
    # Fallback if no API key
    if not client:
        return AIResult(summary="", tags=[])

    # Extract full text
    content_text = await extract_text_from_url(url)
    
    # If extraction failed, fallback to title and description
    if not content_text:
        content_text = f"Title: {title}\nDescription: {description}"

    prompt = f"""
    You are an intelligent assistant for a bookmarking app. 
    Read the following extracted webpage content and provide:
    1. A concise, 2-sentence summary of the main points.
    2. A list of 3 to 5 highly relevant, single-word tags (lowercase).

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
        return AIResult(summary="", tags=[])
