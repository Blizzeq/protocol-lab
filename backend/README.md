# Protocol Lab - Backend

FastAPI exposing a single dataset (a collaborative task board) through
all modern information-exchange paradigms. The domain logic lives in
`app/services/` and is shared across all protocols.

## Quick start (locally)

```bash
uv sync                          # install dependencies
uv run uvicorn app.main:app --reload
# http://localhost:8000/health, /docs
```

## Tests and lint

```bash
uv run pytest
uv run ruff check .
```
