"""Szybki test łączności z bazą — połączenie + wersja PG + listing tabel protocol_lab.

Uruchom: uv run python scripts/check_db.py
"""

import asyncio
import pathlib
import sys

# Pozwól uruchamiać skrypt bezpośrednio (dodaj katalog backend/ do ścieżki importów).
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from app.db.session import get_engine  # noqa: E402


async def main() -> None:
    engine = get_engine()
    try:
        async with engine.connect() as conn:
            version = (await conn.execute(text("select version()"))).scalar_one()
            tables = (
                (
                    await conn.execute(
                        text(
                            "select table_name from information_schema.tables "
                            "where table_schema = 'protocol_lab' order by table_name"
                        )
                    )
                )
                .scalars()
                .all()
            )
    finally:
        await engine.dispose()

    print("OK — połączono z Supabase ✅")
    print("Postgres:", version.split(" on ")[0])
    print(f"Tabele w protocol_lab ({len(tables)}):", ", ".join(tables))


if __name__ == "__main__":
    asyncio.run(main())
