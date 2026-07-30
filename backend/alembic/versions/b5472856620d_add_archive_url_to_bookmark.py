"""Add archive_url to Bookmark

Revision ID: b5472856620d
Revises: a7443945550b
Create Date: 2026-07-31 01:07:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5472856620d'
down_revision: Union[str, None] = 'a7443945550b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('clipnest_bookmarks', sa.Column('archive_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('clipnest_bookmarks', 'archive_url')
