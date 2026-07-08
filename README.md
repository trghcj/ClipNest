<div align="center">
  <img src="frontend/public/Clipnest_Logo.png" alt="ClipNest Logo" width="120" />
  <h1>ClipNest</h1>
  <p>An intelligent, full-stack bookmark management platform supercharged by Google Gemini AI.</p>
</div>

---

## 🌟 Overview
ClipNest is not just another bookmarking app. It is a smart digital library that automatically categorizes, summarizes, and understands the content you save. Built with a modern tech stack (FastAPI + React) and seamlessly integrated with a custom Chrome Extension, ClipNest ensures you never lose track of a valuable article, video, or document again.

## ✨ AI Superpowers (Powered by Google Gemini 2.5 Flash)
- **🤖 AI Auto-Tagging**: Forget manual organization. When you save a link, the background AI automatically reads the article and assigns highly relevant tags.
- **📝 Smart Summarization**: Every article is automatically read and summarized into two concise sentences, allowing you to instantly recall the content without re-reading it.
- **🎥 YouTube Transcript Summaries**: Save a YouTube video (tutorial, podcast, etc.) and ClipNest natively downloads the closed captions, feeding them to Gemini to extract a perfect summary of the video's core message.
- **📄 Intelligent PDF Parsing**: Save direct PDF links. ClipNest will securely download and parse the document (with smart 3MB / 10-page guardrails to ensure efficiency), extracting the raw text for AI summarization and tagging.
- **🔍 Semantic Search ("Ask AI")**: Instead of keyword matching, click "Ask AI" to search your library using natural conversational language. The AI scans your entire bookmark database and returns exact matches along with an intelligent answer based on your saved knowledge!

## 🚀 Core Features
- **Chrome Extension Integration**: Save bookmarks instantly from any tab with a single click.
- **Knowledge Base Notes**: Attach rich markdown-supported notes directly to any bookmark to build your personal knowledge graph.
  - **Tiptap WYSIWYG Editor**: A fully-featured rich text editor with formatting, lists, and code blocks.
  - **Bi-directional Linking (@ Mentions)**: Type `@` to instantly search and link to your other saved bookmarks, turning your notes into an interconnected personal Wiki.
  - **Image Drag-and-Drop**: Drag screenshots directly into the editor for instant Cloudinary CDN hosting.
  - **Focus Mode & Split View**: Read articles and take notes side-by-side, or expand the editor full-screen for a distraction-free writing environment.
  - **Debounced Auto-Save**: Notes seamlessly sync to the cloud in the background as you type.
- **Activity Timeline**: Track your digital habits with a chronological timeline of your recent saves, favorites, and actions.
- **Local PDF Uploads**: Drag and drop local PDFs to extract text and generate AI summaries without needing a public URL.
- **Automatic Metadata Extraction**: Automatically scrapes and extracts titles, descriptions, cover images, and favicons from URLs.
- **Collections & Folders**: Organize bookmarks into custom nested collections with inline renaming.
- **User Profiles**: Secure authentication via Firebase with customizable profile pictures.
- **Dark Mode**: A beautiful, modern, and highly responsive UI with seamless light/dark mode switching.

---

## 🏗️ Architecture

```mermaid
graph TD
    A[Frontend React Client] -->|Submit URL| B(FastAPI Backend)
    B --> C{Metadata Router}
    C -->|Standard Web Page| D[BeautifulSoup Scraper]
    C -->|YouTube Video| E[Transcript Extractor]
    C -->|PDF Document| F[PyPDF Parser]
    D --> G[Unified Content Pipeline]
    E --> G
    F --> G
    G --> H[Google Gemini AI Service]
    H -->|Summary & Tags| I[(PostgreSQL Database)]
    I -->|Returns Data| A
```

---

## 🎨 UI/UX Highlights
ClipNest focuses on a premium, distraction-free reading experience:
- **Sage Library Aesthetics**: A cohesive, calming color palette utilizing warm backgrounds (`#F8F6F1`) and elegant typography (`Inter` & `Plus Jakarta Sans`).
- **Fluid Microinteractions**: Powered by `framer-motion` for buttery-smooth hover states, dynamic active selections, and seamless layout transitions.
- **Spotlight Search**: A centralized, macOS-style omnibar for navigating your digital brain.
- **Knowledge-First Layouts**: Notion-style horizontal scrolling sections for "Continue Reading" and "Recently Saved", alongside dynamic trend-tracking statistics computed instantly on the client.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS, Framer Motion
- **Editor**: Tiptap (Rich Text Editor)
- **State Management**: Zustand (Global state), React Query (Server state)
- **Routing**: React Router DOM
- **Authentication**: Firebase Auth

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **AI Integration**: Google GenAI SDK (`gemini-2.5-flash`)
- **Document Processing**: BeautifulSoup4, `youtube-transcript-api`, `pypdf`
- **Authentication**: Firebase Admin SDK

### Extension
- **Architecture**: Chrome Extension Manifest V3
- **Scripting**: Vanilla JavaScript with background service workers

---

## 💻 Local Development Setup

### 1. Prerequisites
- Node.js (v18+)
- Python (3.10+)
- PostgreSQL Database
- Firebase Project
- Google Gemini API Key

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend` directory:
```env
DATABASE_URL=postgresql://user:password@localhost/clipnest
FIREBASE_CREDENTIALS={"type":"service_account", ...} # Your Firebase Admin JSON string
GEMINI_API_KEY=your_gemini_api_key
```

Run the FastAPI server:
```bash
uvicorn app.main:app --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset
VITE_API_URL=http://localhost:8000/api
```

Run the Vite development server:
```bash
npm run dev
```

### 4. Chrome Extension Setup
1. Open Google Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the `extension` folder in this repository.
4. Pin the ClipNest extension to your browser toolbar!

---

## 🌍 Deployment

ClipNest is designed to be easily deployable on modern cloud platforms with minimal cost.

### Frontend (Vercel)
The React/Vite frontend is optimized for deployment on Vercel:
1. Connect your GitHub repository to Vercel.
2. Select the `frontend` directory as your Root Directory.
3. Vercel will automatically detect Vite.
4. Add all your `VITE_FIREBASE_*` and `VITE_API_URL` environment variables.
5. Deploy!

### Backend (Render / Railway)
The FastAPI backend can be hosted on Render or Railway:
1. Connect your GitHub repository.
2. Set the Root Directory to `backend`.
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add your `DATABASE_URL`, `FIREBASE_CREDENTIALS`, and `GEMINI_API_KEY` environment variables.

---

## 🛡️ License
This project is proprietary and confidential.
