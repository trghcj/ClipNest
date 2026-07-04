from fastapi import APIRouter
from .endpoints import bookmarks, collections

api_router = APIRouter()
api_router.include_router(bookmarks.router, prefix="/bookmarks", tags=["bookmarks"])
api_router.include_router(collections.router, prefix="/collections", tags=["collections"])
