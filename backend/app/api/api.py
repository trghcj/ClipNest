from fastapi import APIRouter
from .endpoints import bookmarks

api_router = APIRouter()
api_router.include_router(bookmarks.router, prefix="/bookmarks", tags=["bookmarks"])
