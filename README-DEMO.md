# YKP Hermez AI Command Center — Demo

Runnable local demo of the YKP Hermez migration concept, built overnight from the open-source [Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) template.

## What is inside

- **HR module**: attendance log, payroll sample, staff summary.
- **Finance module**: POS revenue, supplier cost, petty cash, expenses, finance dashboard.
- **Hermez AI**: daily brief + alert log generated from `hr_daily_summary` and `fin_daily_summary`.
- **Master Data**: read-only brand / outlet / employee / supplier / shift-rules browser.

## How to run

```bash
cd ykp-command-center-demo
npm install
npm run build    # verify static build
npm run dev      # open http://localhost:3000
```

The app redirects `/` to `/dashboard`.

## Data layer

All data is deterministic mock JSON in `src/constants/mock-api-ykp.ts`, matching the blueprint schema so it can be replaced with real Google Sheets / DB later.

## Notes

- No real Telegram integration (in-app rendering only).
- No real Clerk auth setup (keyless mode works out of the box for local demo).
- Sentry is disabled via `.env.local`.