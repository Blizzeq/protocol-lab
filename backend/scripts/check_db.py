"""Quick database connectivity check — connection + PG version + listing protocol_lab tables.

Run: uv run python scripts/check_db.py
"""

import asyncio
import pathlib
import sys

# Allow running the script directly (add the backend/ directory to the import path).
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

    print("OK — connected to Supabase ✅")
    print("Postgres:", version.split(" on ")[0])
    print(f"Tables in protocol_lab ({len(tables)}):", ", ".join(tables))


if __name__ == "__main__":
    asyncio.run(main())
