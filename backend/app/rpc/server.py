"""Connect RPC service implementation, mounted under FastAPI at /rpc.

connect-python serves the Connect, gRPC and gRPC-Web protocols from one ASGI app,
so the browser can call it directly (no Envoy/grpc-web proxy needed).
"""

from __future__ import annotations

# Importing this module triggers app/rpc/__init__.py first, which puts gen/ on sys.path,
# so the generated `protocollab.*` imports below resolve.
from protocollab.v1.greet_connect import GreetServiceASGIApplication
from protocollab.v1.greet_pb2 import GreetRequest, GreetResponse

SERVED_BY = "Protocol Lab (Connect/Python)"


class GreetServiceImpl:
    async def greet(self, request: GreetRequest, ctx) -> GreetResponse:
        name = request.name or "world"
        return GreetResponse(greeting=f"Hello, {name}!", served_by=SERVED_BY)


rpc_app = GreetServiceASGIApplication(GreetServiceImpl())
