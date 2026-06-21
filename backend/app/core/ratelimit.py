"""Rate limiting via slowapi.

In-memory (sufficient for dev / a single instance). In production it is worth connecting
a Redis backend (storage_uri) so the limit works across processes/instances.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])
