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
    # Optional explicit path to terminal64.exe. When set, MT5 SDK attaches to this
    # terminal rather than spawning a new one. Required when multiple MT5 builds
    # (e.g. MetaQuotes generic + Exness) are installed on the same host.
    terminal_path: str | None = None


def load_config() -> BridgeConfig:
    login = int(os.environ["MT5_LOGIN"])
    password = os.environ["MT5_PASSWORD"]
    server = os.environ["MT5_SERVER"]
    token = os.environ["MT5_BRIDGE_TOKEN"]
    host = os.environ.get("MT5_BRIDGE_HOST", "127.0.0.1")
    port = int(os.environ.get("MT5_BRIDGE_PORT", "8765"))
    terminal_path = os.environ.get("MT5_TERMINAL_PATH") or None
    return BridgeConfig(login=login, password=password, server=server,
                        token=token, host=host, port=port,
                        terminal_path=terminal_path)