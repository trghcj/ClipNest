import os

# app.core.config requires these at import time; tests never touch the real services.
for key, value in {
    "SUPABASE_URL": "http://localhost",
    "SUPABASE_KEY": "test",
    "SUPABASE_DB_URL": "postgresql://test:test@localhost/test",
    "FIREBASE_PROJECT_ID": "test",
    "FIREBASE_CLIENT_EMAIL": "test@example.com",
    "FIREBASE_PRIVATE_KEY": "",
    "GEMINI_API_KEY": "",
}.items():
    os.environ.setdefault(key, value)
