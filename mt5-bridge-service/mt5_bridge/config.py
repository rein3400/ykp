import os
from dataclasses import dataclass


@dataclass(frozen=True)
class BridgeConfig:
    login: int
    password: str
    server: str
    token: str
    host: str = "127.0.0.1"
    port: int = 8765


def load_config() -> BridgeConfig:
    login = int(os.environ["MT5_LOGIN"])
    password = os.environ["MT5_PASSWORD"]
    server = os.environ["MT5_SERVER"]
    token = os.environ["MT5_BRIDGE_TOKEN"]
    host = os.environ.get("MT5_BRIDGE_HOST", "127.0.0.1")
    port = int(os.environ.get("MT5_BRIDGE_PORT", "8765"))
    return BridgeConfig(login=login, password=password, server=server,
                        token=token, host=host, port=port)