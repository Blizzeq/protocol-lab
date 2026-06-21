"""Deklaratywna baza ORM + metadata związana ze schematem `protocol_lab`.

Wszystkie modele dziedziczą po ``Base`` i są automatycznie kwalifikowane schematem,
więc współistnieją z innymi projektami w tym samym projekcie Supabase.
"""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

SCHEMA = "protocol_lab"

# Spójne, czytelne nazwy constraintów/indeksów (przydatne przy migracjach).
NAMING_CONVENTION = {
    "ix": "%(column_0_label)s_idx",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(schema=SCHEMA, naming_convention=NAMING_CONVENTION)
