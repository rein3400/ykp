import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASSWORD = "password"

CONFIG = '''/**
 * Single source of truth for the YKP app family (VPS production).
 * Public subdomains — NOT internal IPs.
 */

export interface HubModuleDef {
  id: string;
  name: string;
  desc: string;
  url: string;
  probePath: string;
  probeReturnsCount: boolean;
}

export const HUB_MODULES: readonly HubModuleDef[] = [
  {
    id: "owner",
    name: "Owner Command",
    desc: "Cross-module read-only overview",
    url: process.env.NEXT_PUBLIC_YKP_OWNER_URL ?? "https://owner.oseedigital.tech",
    probePath: "/login",
    probeReturnsCount: false
  },
  {
    id: "hr",
    name: "HR",
    desc: "Attendance, employees, roster",
    url: process.env.NEXT_PUBLIC_YKP_HR_URL ?? "https://hr-v1.oseedigital.tech",
    probePath: "/api/hr/summary/count",
    probeReturnsCount: true
  },
  {
    id: "finance",
    name: "Finance",
    desc: "POS, expenses, petty cash, daily summary",
    url: process.env.NEXT_PUBLIC_YKP_FINANCE_URL ?? "https://finance-v1.oseedigital.tech",
    probePath: "/login",
    probeReturnsCount: false
  },
  {
    id: "warehouse",
    name: "Warehouse",
    desc: "Stock, receiving, usage, waste",
    url: process.env.NEXT_PUBLIC_YKP_WAREHOUSE_URL ?? "https://warehouse.oseedigital.tech",
    probePath: "/login",
    probeReturnsCount: false
  },
  {
    id: "investor",
    name: "Investor",
    desc: "Portfolio, capital, dividends",
    url: process.env.NEXT_PUBLIC_YKP_INVESTOR_URL ?? "https://investor.oseedigital.tech",
    probePath: "/api/investor/summary/count",
    probeReturnsCount: true
  },
  {
    id: "ops",
    name: "Ops",
    desc: "Daily operations, incidents, actions",
    url: process.env.NEXT_PUBLIC_YKP_OPS_URL ?? "https://ops.oseedigital.tech",
    probePath: "/login",
    probeReturnsCount: false
  }
];

export type HubModuleId = (typeof HUB_MODULES)[number]["id"];

export function findHubModule(id: string): HubModuleDef | undefined {
  return HUB_MODULES.find((m) => m.id === id);
}

/** Base URL (no trailing slash). */
export function moduleBaseUrl(def: HubModuleDef): string {
  return def.url.replace(/\\/+$/, "");
}

/** Full URL the health probe should hit for this module. */
export function moduleProbeUrl(def: HubModuleDef): string {
  return `${moduleBaseUrl(def)}${def.probePath}`;
}
'''

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

sftp = ssh.open_sftp()

# 1. Write config.ts
with sftp.open('/home/dev/ykp/ykp-hub/app/config.ts', 'w') as f:
    f.write(CONFIG)

# 2. Patch apps.ts: only ops-v1 has a GET SSO bridge.
with sftp.open('/home/dev/ykp/ykp-hub/app/components/apps.ts', 'r') as f:
    apps = f.read().decode()

old = 'export const ROLE_SSO_APPS: ReadonlySet<AppId> = new Set<AppId>(["finance", "owner", "ops"]);'
new = 'export const ROLE_SSO_APPS: ReadonlySet<AppId> = new Set<AppId>(["ops"]);'
if old in apps:
    apps = apps.replace(old, new)
    with sftp.open('/home/dev/ykp/ykp-hub/app/components/apps.ts', 'w') as f:
        f.write(apps)
    print("PATCHED apps.ts ROLE_SSO_APPS -> [ops]")
else:
    print("WARN: ROLE_SSO_APPS line not found; current value:")
    for line in apps.splitlines():
        if 'ROLE_SSO_APPS' in line:
            print("  " + line)

sftp.close()

# 3. Build + restart
cmd = (
    "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin; "
    "cd /home/dev/ykp/ykp-hub && npm run build 2>&1 | tail -25 && "
    "pm2 restart ykp-hub --update-env 2>&1 | tail -5"
)
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=600)
print(stdout.read().decode())
print(stderr.read().decode())
ssh.close()
