from fastapi import APIRouter
from .endpoints import bookmarks, collections, tags, annotations, analytics, activities

api_router = APIRouter()
api_router.include_router(bookmarks.router, prefix="/bookmarks", tags=["bookmarks"])
api_router.include_router(collections.router, prefix="/collections", tags=["collections"])
api_router.include_router(tags.router, prefix="/tags", tags=["tags"])
api_router.include_router(annotations.router, tags=["annotations"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(activities.router, prefix="/activities", tags=["activities"])
