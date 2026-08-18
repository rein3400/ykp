import paramiko

def run_ssh(cmd):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('187.77.114.168', username='dev', password='password')
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    ssh.close()
    return out, err

if __name__ == '__main__':
    import sys
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'echo OK'
    out, err = run_ssh(cmd)
    print('STDOUT:\n' + out)
    if err:
        print('STDERR:\n' + err)
