@{
    finance = @{
        id = 'finance'
        name = 'Finance'
        base = 'https://ykp-erp-finance-production.up.railway.app'
        auth = 'sso'
        role = 'OWNER'
        redirect = '/'
        session = 'ykp-qa-finance'
    }
    hrProd = @{
        id = 'hr-prod'
        name = 'HR Production'
        base = 'https://ykp-erp-hr-production.up.railway.app'
        auth = 'sso'
        role = 'OWNER'
        redirect = '/'
        session = 'ykp-qa-hr-prod'
    }
    hermez = @{
        id = 'hermez'
        name = 'Hermez AI'
        base = 'https://ykp-erp-hermez-production.up.railway.app'
        auth = 'sso'
        role = 'SUPER_ADMIN'
        redirect = '/'
        session = 'ykp-qa-hermez'
    }
    hrPilot = @{
        id = 'hr-pilot'
        name = 'HR Pilot (Sheets)'
        base = 'https://ykp-hr-v1-standalone-production.up.railway.app'
        auth = 'password'
        username = 'owner'
        password = 'owner123'
        loginPath = '/login'
        session = 'ykp-qa-hr-pilot'
    }
    warehouse = @{
        id = 'warehouse'
        name = 'Warehouse'
        base = 'https://ykp-warehouse-v1.vercel.app'
        auth = 'password'
        username = 'owner'
        password = 'owner123'
        loginPath = '/login'
        session = 'ykp-qa-warehouse'
    }
    investor = @{
        id = 'investor'
        name = 'Investor'
        base = 'https://ykp-investor-v1.vercel.app'
        auth = 'password'
        username = 'owner'
        password = 'owner123'
        loginPath = '/login'
        session = 'ykp-qa-investor'
    }
    hubOps = @{
        id = 'hub-ops'
        name = 'Hub + Ops'
        base = 'https://ykp-hub-production.up.railway.app'
        opsBase = 'https://ykp-ops-v1.vercel.app'
        auth = 'hub-form'
        username = 'owner'
        password = 'owner123'
        loginPath = '/login'
        session = 'ykp-qa-hub-ops'
    }
}
