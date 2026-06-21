"""Declarative ORM base + metadata bound to the `protocol_lab` schema.

All models inherit from ``Base`` and are automatically schema-qualified,
so they coexist with other projects in the same Supabase project.
"""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

SCHEMA = "protocol_lab"

# Consistent, readable constraint/index names (useful during migrations).
NAMING_CONVENTION = {
    "ix": "%(column_0_label)s_idx",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(schema=SCHEMA, naming_convention=NAMING_CONVENTION)
