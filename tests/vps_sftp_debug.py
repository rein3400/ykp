import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
sftp = c.open_sftp()
print("pwd:", sftp.getcwd())
# try absolute
import os
try:
    st = sftp.stat("/home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts")
    print("abs stat:", st)
except Exception as e:
    print("abs stat err:", e)
try:
    st = sftp.stat("ykp-warehouse-v1/src/db/sheets.ts")
    print("rel stat:", st)
except Exception as e:
    print("rel stat err:", e)
# list warehouse db
try:
    print("list /home/dev/ykp/ykp-warehouse-v1/src/db/:", sftp.listdir("/home/dev/ykp/ykp-warehouse-v1/src/db/"))
except Exception as e:
    print("listdir err:", e)
# maybe /home/dev is symlink?
try:
    print("readlink /home/dev:", sftp.readlink("/home/dev"))
except Exception as e:
    print("readlink err:", e)
c.close()