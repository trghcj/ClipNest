from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime

class AnnotationBase(BaseModel):
    highlight_text: str
    note_text: Optional[str] = None

class AnnotationCreate(AnnotationBase):
    pass

class ExtensionAnnotationCreate(AnnotationBase):
    url: HttpUrl

class AnnotationResponse(AnnotationBase):
    id: str
    bookmark_id: str
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True
