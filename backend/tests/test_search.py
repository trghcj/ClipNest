"""Tests for the full-text search query builder (SQL is compiled, not executed)."""
import pytest
from sqlalchemy.dialects import postgresql

from app.services.search import full_text_matches, tsquery_text


@pytest.mark.parametrize("query,expected", [
    ("cheap flights", "cheap:* | flights:*"),
    ("  Python   python TIPS ", "python:* | tips:*"),
    ("what's new in C++?", "what:* | new:* | in:*"),           # 1-char words and punctuation dropped
    ("a:* & !b | (c) <-> d'); DROP TABLE x;--", "drop:* | table:*"),  # tsquery operators can't leak through
    ("snake_case_word", "snake:* | case:* | word:*"),
    ("über café", "über:* | café:*"),
    ("!!! ?", ""),
])
def test_tsquery_text(query, expected):
    assert tsquery_text(query) == expected


def test_term_count_is_capped():
    assert tsquery_text(" ".join(f"word{i}" for i in range(50))).count("|") == 11


def test_no_searchable_words_returns_none():
    assert full_text_matches("user-1", "?!", 10) is None


def test_query_is_scoped_to_user_and_parameterised():
    stmt = full_text_matches("user-1", "cheap flights", 100)
    compiled = stmt.compile(dialect=postgresql.dialect())
    sql = str(compiled)
    assert "clipnest_bookmarks.user_id = %(user_id_1)s" in sql
    assert "to_tsquery('english'::regconfig, %(to_tsquery_1)s)" in sql
    assert "@@" in sql and "ts_rank" in sql and "string_agg" in sql
    assert compiled.params["to_tsquery_1"] == "cheap:* | flights:*"
    assert compiled.params["user_id_1"] == "user-1"
