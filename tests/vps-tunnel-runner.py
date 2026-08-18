"""
Local port-forward tunnel via Paramiko so Playwright on laptop can hit
localhost:3000, 3008, 3009 on VPS directly.
"""
import socket
import select
import threading
import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASSWORD = "password"

def forward_tunnel(local_port, remote_host, remote_port, transport):
    class SubHander(threading.Thread):
        def __init__(self, sock):
            super().__init__(daemon=True)
            self.sock = sock

        def run(self):
            try:
                chan = transport.open_channel(
                    "direct-tcpip",
                    (remote_host, remote_port),
                    self.sock.getpeername(),
                )
            except Exception as e:
                self.sock.close()
                return

            while True:
                r, w, x = select.select([self.sock, chan], [], [])
                if self.sock in r:
                    data = self.sock.recv(4096)
                    if not data:
                        break
                    chan.send(data)
                if chan in r:
                    data = chan.recv(4096)
                    if not data:
                        break
                    self.sock.send(data)
            chan.close()
            self.sock.close()

    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("127.0.0.1", local_port))
    server.listen(10)
    print(f"[*] Tunnel active: 127.0.0.1:{local_port} -> {remote_host}:{remote_port}")

    def loop():
        while True:
            client_sock, _ = server.accept()
            SubHander(client_sock).start()

    threading.Thread(target=loop, daemon=True).start()

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=22, username=USER, password=PASSWORD, timeout=20)
    transport = client.get_transport()

    # Forward 13000->3000, 13008->3008, 13009->3009
    forward_tunnel(13000, "127.0.0.1", 3000, transport)
    forward_tunnel(13008, "127.0.0.1", 3008, transport)
    forward_tunnel(13009, "127.0.0.1", 3009, transport)
    print("[*] All tunnels established. Running Playwright tests...")

    import subprocess
    res = subprocess.run(["node", "tests/vps-verify-tunneled.mjs"], capture_output=False)
    client.close()
    raise SystemExit(res.returncode)

if __name__ == "__main__":
    main()
