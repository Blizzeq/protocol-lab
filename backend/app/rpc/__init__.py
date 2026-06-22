"""gRPC/Connect layer.

The buf-generated code (under ``gen/``) uses absolute imports like
``protocollab.v1.greet_pb2``, so the ``gen`` directory must be importable.
"""

import pathlib
import sys

_GEN_DIR = pathlib.Path(__file__).resolve().parent / "gen"
if str(_GEN_DIR) not in sys.path:
    sys.path.insert(0, str(_GEN_DIR))
