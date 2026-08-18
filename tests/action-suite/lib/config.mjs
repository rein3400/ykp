export const APPS = {
  finance: {
    id: 'finance',
    name: 'Finance',
    base: 'https://ykp-erp-finance-production.up.railway.app',
    auth: 'sso',
    role: 'OWNER',
    redirect: '/',
  },
  hrProd: {
    id: 'hr-prod',
    name: 'HR Production',
    base: 'https://ykp-erp-hr-production.up.railway.app',
    auth: 'sso',
    role: 'OWNER',
    redirect: '/',
  },
  hermez: {
    id: 'hermez',
    name: 'Hermez AI',
    base: 'https://ykp-erp-hermez-production.up.railway.app',
    auth: 'sso',
    role: 'SUPER_ADMIN',
    redirect: '/',
  },
  hrPilot: {
    id: 'hr-pilot',
    name: 'HR Pilot (Sheets)',
    base: 'https://ykp-hr-v1-standalone-production.up.railway.app',
    auth: 'password',
    username: 'owner',
    password: 'owner123',
    loginPath: '/login',
  },
  warehouse: {
    id: 'warehouse',
    name: 'Warehouse',
    base: 'https://ykp-warehouse-v1.vercel.app',
    auth: 'password',
    username: 'owner',
    password: 'owner123',
    loginPath: '/login',
  },
  investor: {
    id: 'investor',
    name: 'Investor',
    base: 'https://ykp-investor-v1.vercel.app',
    auth: 'password',
    username: 'owner',
    password: 'owner123',
    loginPath: '/login',
  },
  hub: {
    id: 'hub',
    name: 'Hub',
    base: 'https://ykp-hub-production.up.railway.app',
    auth: 'hub-form',
    username: 'owner',
    password: 'owner123',
    loginPath: '/login',
  },
};

export function getApp(id) {
  const app = APPS[id];
  if (!app) throw new Error(`Unknown app id: ${id}`);
  return app;
}
