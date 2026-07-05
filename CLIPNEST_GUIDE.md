# ClipNest - Comprehensive Guide & Recent Updates

ClipNest is an intelligent, full-stack bookmark management platform that goes beyond simple link saving. It automatically extracts metadata, generates AI-powered summaries and tags, auto-categorizes your saved links, and offers a distraction-free reader mode.

## 🛠️ Tech Stack

### Frontend
*   **Framework**: React (built with Vite)
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS
*   **State Management/Data Fetching**: React Query
*   **Icons**: Lucide React
*   **Deployment**: Vercel

### Backend
*   **Framework**: FastAPI (Python)
*   **Database ORM**: SQLAlchemy (Async)
*   **Database Engine**: PostgreSQL (hosted on Supabase)
*   **Migrations**: Alembic
*   **Data Validation**: Pydantic
*   **Metadata Extraction**: BeautifulSoup4, readability-lxml
*   **Deployment**: Render

### AI Integration
*   **Model**: Google GenAI (Gemini)
*   **Features**: Auto-tagging, content summarization, intent-based semantic search, and automatic collection categorization.

### Chrome Extension
*   **Architecture**: Manifest V3
*   **Features**: Context menu integration for saving highlights and URLs directly to ClipNest without opening the dashboard.

---

## 🚀 Recent Updates & Features (Yesterday & Today)

Over the past two days, we have massively upgraded ClipNest's capabilities, focusing on AI integrations, reading experiences, and system stability. 

### 1. AI Semantic Search
We implemented a powerful Semantic Search feature. Instead of just searching for exact keyword matches, the backend now leverages the Gemini LLM to understand the *intent* of your search query and matches it against the context of your saved bookmarks.

### 2. Auto-Categorization (Collections)
The AI background task was upgraded. When you save a new bookmark, the AI now analyzes its content and automatically suggests a relevant **Collection** (e.g., "Technology", "Sports"). If the collection doesn't exist, it creates it automatically and categorizes the bookmark.

### 3. Reader Mode
We introduced a distraction-free **Reader Modal** on the frontend. Using the `readability-lxml` algorithm on the backend, ClipNest strips away ads and menus from saved articles and saves the pure article body. You can now read articles directly inside the ClipNest dashboard.

### 4. Chrome Extension Enhancements
*   **Full Metadata Extraction**: Previously, bookmarks saved via the extension were "silent bookmarks" (only saving the URL). We updated the backend so that extension saves now trigger the full metadata extraction pipeline (fetching titles, descriptions, and the article body for Reader Mode).
*   **CORS Preflight Fixes**: Resolved complex CORS issues that were preventing the extension from communicating with the live backend.

### 5. System Stability & Error Handling
*   **Robust Error Catching**: Added global `try-except` blocks to critical endpoints. Previously, if the database encountered an error (like a foreign key violation), the backend would crash silently, causing the browser to hide the error behind a deceptive "CORS/Network Error". Now, the backend fails gracefully and returns standard 500 errors with the correct CORS headers for easier debugging.
*   **Database Backfill**: Ran a live script on the production database to retroactively extract and save article content for older bookmarks that were missing it.

---

## ❓ Questions & Answers (Troubleshooting Log)

**Q: Why was the Chrome Extension throwing a "Network Error" when I tried to save a bookmark to a collection?**
**A:** This was a deceptive error caused by a combination of a backend crash and browser security policies. The database encountered a missing table/column issue and crashed. Because it crashed unexpectedly, FastAPI didn't attach the `Access-Control-Allow-Origin` CORS headers to the error response. Your browser saw the missing headers and flagged it as a "Network Error", hiding the true database failure. We fixed this by wrapping the logic in `try-except` blocks to ensure CORS headers are *always* returned, even during a server crash.

**Q: Why does the Reader Mode sometimes say "No article content could be extracted"?**
**A:** This happens for two reasons:
1.  **Old Extension Saves**: Previously, the Chrome Extension didn't trigger content extraction. (We fixed this and backfilled your old bookmarks).
2.  **Website Restrictions/Layouts**: ClipNest uses a "Readability" algorithm to guess where the main article text is. Some websites (like India Development Review) use non-standard HTML layouts that confuse the algorithm. Other sites (like Wikipedia or YouTube) actively block automated scrapers. 

**Q: How do I pull the latest changes to my local machine?**
**A:** Open your terminal in the project folder and run:
`git pull origin <branch_name>` (e.g., `git pull origin dev/divyansh`).

**Q: What is a CORS Preflight (`OPTIONS`) request?**
**A:** When a frontend (like your Chrome Extension or Vercel app) tries to make a `POST` or `DELETE` request to a backend on a different domain, the browser first sends an invisible `OPTIONS` request (a preflight) to ask the backend, *"Are you okay with receiving this request from this origin?"*. If the backend doesn't explicitly approve it in its CORS settings, the browser blocks the actual request.
