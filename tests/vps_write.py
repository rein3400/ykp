#!/usr/bin/env python3
"""Upload a file to VPS via SFTP."""
import paramiko, sys, os

def upload(local_path, remote_path):
    host = "187.77.114.168"
    user, pwd = "dev", "password"
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=pwd, timeout=15)
    sftp = ssh.open_sftp()
    sftp.put(local_path, remote_path)
    sftp.close()
    ssh.close()
    print(f"UPLOADED: {local_path} -> {remote_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python vps_write.py <local> <remote>")
        sys.exit(1)
    upload(sys.argv[1], sys.argv[2])
