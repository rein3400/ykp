#!/usr/bin/env python3
"""SSH helper: run commands on VPS, avoiding PowerShell parsing issues."""
import paramiko
import sys

def run(cmd):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect("187.77.114.168", username="dev", password="password", timeout=15)
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    ssh.close()
    return out, err

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "uname -a"
    out, err = run(cmd)
    if out:
        print("OUT:", out)
    if err:
        print("ERR:", err)
