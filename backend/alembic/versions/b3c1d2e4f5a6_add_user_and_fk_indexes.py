"""add indexes on user_id and foreign-key columns

Every API query filters by user_id (or joins on a foreign key), but Postgres does
not index foreign keys automatically, so these were sequential scans.
Uses IF NOT EXISTS so it is safe to run against a database whose alembic history
has drifted. The same statements can be pasted into the Supabase SQL editor.

Revision ID: b3c1d2e4f5a6
Revises: a7443945550b
Create Date: 2026-11-15

"""
from typing import Sequence, Union

from alembic import op

revision: str = "b3c1d2e4f5a6"
down_revision: Union[str, Sequence[str], None] = "a7443945550b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEXES = {
    "ix_clipnest_bookmarks_user_created": "clipnest_bookmarks (user_id, created_at)",
    "ix_clipnest_bookmarks_user_url": "clipnest_bookmarks (user_id, url)",
    "ix_clipnest_tags_user_id": "clipnest_tags (user_id)",
    "ix_clipnest_bookmark_tags_tag_id": "clipnest_bookmark_tags (tag_id)",
    "ix_clipnest_collections_user_id": "clipnest_collections (user_id)",
    "ix_clipnest_collection_bookmarks_bookmark_id": "clipnest_collection_bookmarks (bookmark_id)",
    "ix_clipnest_annotations_bookmark_id": "clipnest_annotations (bookmark_id)",
    "ix_clipnest_activity_logs_user_created": "clipnest_activity_logs (user_id, created_at)",
}


def upgrade() -> None:
    for name, target in INDEXES.items():
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {target}")


def downgrade() -> None:
    for name in INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {name}")
