import os

base = 'D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER'
apps = ['ykp-hr-v1','ykp-finance-v1','ykp-warehouse-v1','ykp-investor-v1','ykp-ops-v1','ykp-owner-v1','ykp-hub','ykp-hermez']
for d in apps:
    appdir = os.path.join(base, d, 'src', 'app')
    if not os.path.isdir(appdir):
        print('==', d, '== (no src/app)')
        continue
    print('==', d, '==')
    for r, _, fs in os.walk(appdir):
        if 'page.tsx' in fs:
            print('  ', os.path.relpath(os.path.join(r, 'page.tsx'), appdir))
