# Protocol Lab — Backend

FastAPI udostępniający jeden zbiór danych (kolaboracyjna tablica zadań) przez
wszystkie nowoczesne paradygmaty wymiany informacji. Logika domenowa żyje w
`app/services/` i jest współdzielona przez wszystkie protokoły.

## Szybki start (lokalnie)

```bash
uv sync                          # zainstaluj zależności
uv run uvicorn app.main:app --reload
# http://localhost:8000/health, /docs
```

## Testy i lint

```bash
uv run pytest
uv run ruff check .
```
