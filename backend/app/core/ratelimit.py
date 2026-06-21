"""Rate limiting przez slowapi.

In-memory (wystarcza dla dev / pojedynczej instancji). Produkcyjnie warto podłączyć
backend Redis (storage_uri), aby limit działał między procesami/instancjami.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
