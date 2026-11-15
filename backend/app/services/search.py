"""Postgres full-text search over a user's bookmarks, used to pick candidates for AI search."""
import re

from sqlalchemy import Select, func, literal_column, select

from app.models.bookmark import Bookmark
from app.models.tag import BookmarkTag, Tag

_ENGLISH = literal_column("'english'::regconfig")
MAX_TERMS = 12


def tsquery_text(query: str) -> str:
    """Turn free text into a safe to_tsquery() string: alphanumeric words only, each a prefix
    match, OR-ed together ("cheap flights" -> "cheap:* | flights:*"). Returns "" if no words."""
    words = []
    for word in re.findall(r"[^\W_]+", query.lower()):
        if len(word) >= 2 and word not in words:
            words.append(word)
    return " | ".join(f"{w}:*" for w in words[:MAX_TERMS])


def _document():
    """Searchable text of a bookmark: title, description, AI summary and tag names."""
    tag_names = (
        select(func.string_agg(Tag.name, " "))
        .select_from(BookmarkTag)
        .join(Tag, Tag.id == BookmarkTag.tag_id)
        .where(BookmarkTag.bookmark_id == Bookmark.id)
        .correlate(Bookmark)
        .scalar_subquery()
    )
    return func.to_tsvector(
        _ENGLISH,
        func.concat_ws(" ", Bookmark.title, Bookmark.description, Bookmark.summary, tag_names),
    )


def full_text_matches(user_id: str, query: str, limit: int, *options) -> Select | None:
    """SELECT of the user's bookmarks matching ``query``, best match first, or None when the
    query has no searchable words."""
    text = tsquery_text(query)
    if not text:
        return None
    document = _document()
    tsquery = func.to_tsquery(_ENGLISH, text)
    return (
        select(Bookmark)
        .options(*options)
        .where(Bookmark.user_id == user_id, document.op("@@")(tsquery))
        .order_by(func.ts_rank(document, tsquery).desc(), Bookmark.created_at.desc())
        .limit(limit)
    )
