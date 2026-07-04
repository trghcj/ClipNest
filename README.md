<div align="center">
  <img src="frontend/public/Clipnest_Logo.png" alt="ClipNest Logo" width="120" />
  <h1>ClipNest</h1>
  <p>An intelligent, full-stack bookmark management platform supercharged by Google Gemini AI.</p>
</div>

---

## 🌟 Overview
ClipNest is not just another bookmarking app. It is a smart digital library that automatically categorizes, summarizes, and understands the content you save. Built with a modern tech stack (FastAPI + React) and seamlessly integrated with a custom Chrome Extension, ClipNest ensures you never lose track of a valuable article or video again.

## ✨ AI Superpowers (Powered by Google Gemini 2.5 Flash)
- **🤖 AI Auto-Tagging**: Forget manual organization. When you save a link, the background AI automatically reads the article and assigns highly relevant tags.
- **📝 Smart Summarization**: Every article is automatically read and summarized into two concise sentences, allowing you to instantly recall the content without re-reading it.
- **🎥 YouTube Transcript Summaries**: Save a YouTube video (tutorial, podcast, etc.) and ClipNest natively downloads the closed captions, feeding them to Gemini to extract a perfect summary of the video's core message.
- **🔍 Semantic Search ("Ask AI")**: Instead of keyword matching, click "Ask AI" to search your library using natural conversational language. The AI scans your entire bookmark database and returns exact matches along with an intelligent answer based on your saved knowledge!

## 🚀 Core Features
- **Chrome Extension Integration**: Save bookmarks instantly from any tab with a single click.
- **Automatic Metadata Extraction**: Automatically scrapes and extracts titles, descriptions, cover images, and favicons from URLs.
- **Collections & Folders**: Organize bookmarks into custom nested collections with inline renaming.
- **User Profiles**: Secure authentication via Firebase with customizable profile pictures.
- **Dark Mode**: A beautiful, modern, and highly responsive UI with seamless light/dark mode switching.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand (Global state), React Query (Server state)
- **Routing**: React Router DOM
- **Authentication**: Firebase Auth

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **AI Integration**: Google GenAI SDK (`gemini-2.5-flash`)
- **Web Scraping**: BeautifulSoup4, `youtube-transcript-api`
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

## 🎨 UI/UX Highlights
ClipNest focuses on a premium user experience featuring:
- **Glassmorphism & Micro-animations**: Smooth hover effects and transitions.
- **Bespoke Badges**: Special dynamic badges (e.g., custom red YouTube badges) for different content types.
- **Accessible Design**: Fully keyboard accessible forms and semantic HTML.

---

## 🛡️ License
This project is proprietary and confidential.
