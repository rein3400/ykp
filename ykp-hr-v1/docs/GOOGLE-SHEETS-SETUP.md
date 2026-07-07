# Google Sheets DB setup for YKP HR V1

1. **Create spreadsheet** "YKP_HR_V1" in your personal Google Drive.
2. **GCP project** → IAM & Admin → Service Accounts → Create:
   - Name: `ykp-hr-v1-svc`
   - Role: none (we use share-by-email)
3. **Create key** → JSON. Save as `gcp-service-account.json` next to `.env`.
4. **Share spreadsheet** with the service account email (the one ending in
   `@<project>.iam.gserviceaccount.com`) as **Editor**.
5. Copy the **spreadsheet ID** from the URL: `https://docs.google.com/spreadsheets/d/<THIS>/edit`.
6. Fill `.env`:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL=<the email from step 2>`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="<contents of JSON private_key field, with \n literal>"`
   - `YKP_HR_SPREADSHEET_ID=<ID from step 5>`
7. `npm run sheets:bootstrap` — creates all tabs with header rows.
8. `npm run dev` — open http://localhost:3002.

## Quotas (read before pilot)

- 60 reads/min/user, 60 writes/min/user
- For pilot 5-10 staff + 1 brand + 1 outlet: well within limits
- If usage grows, request quota increase or move to Postgres (V2)
