"""Sanity-check warstwy ORM — nie wymaga połączenia z bazą.

Sprawdza, że modele się kompilują i są kwalifikowane schematem `protocol_lab`.
"""

from app.db.base import SCHEMA, Base
from app.models import Board, Comment, Tag, Task, User


def test_tables_registered_under_schema():
    expected = {
        "users",
        "api_keys",
        "boards",
        "tasks",
        "comments",
        "tags",
        "task_tags",
    }
    names = {t.name for t in Base.metadata.tables.values()}
    assert expected <= names
    # wszystkie tabele kwalifikowane schematem protocol_lab
    assert all(t.schema == SCHEMA for t in Base.metadata.tables.values())


def test_relationships_wired():
    assert set(Board.__mapper__.relationships.keys()) >= {"owner", "tasks", "tags"}
    assert set(Task.__mapper__.relationships.keys()) >= {"board", "comments", "tags", "assignee"}
    assert set(Comment.__mapper__.relationships.keys()) >= {"task", "author"}
    assert set(User.__mapper__.relationships.keys()) >= {"boards", "api_keys"}
    assert set(Tag.__mapper__.relationships.keys()) >= {"board", "tasks"}
