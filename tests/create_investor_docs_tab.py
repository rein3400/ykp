#!/usr/bin/env python3
"""Create the investor_documents tab in the production Google Sheet."""
import json
import urllib.request

# Import google-api-client via pip inside the script env
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "google-api-python-client", "google-auth"])
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
import os, sys

SPREADSHEET_ID = "1rdKV6BJMsDr3lKhIoxQXA8hbto9s8p0rOajHFYNsPVg"
TAB_NAME = "investor_documents"
HEADERS = ["doc_id", "investor_id", "doc_type", "attachment_id", "signed_date", "expiry_date", "note", "created_at"]

email = os.environ.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")
key = os.environ.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "").replace("\\n", "\n")
if not email or not key:
    print("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")
    sys.exit(1)

creds = service_account.Credentials.from_service_account_info(
    {"type": "service_account", "client_email": email, "private_key": key,
     "token_uri": "https://oauth2.googleapis.com/token"},
    scopes=["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
)
svc = build("sheets", "v4", credentials=creds)

# Check if tab already exists
result = svc.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
tabs = [s["properties"]["title"] for s in result["sheets"]]
print(f"Existing tabs: {tabs}")

if TAB_NAME in tabs:
    print(f"Tab '{TAB_NAME}' already exists — skipping.")
    # Check headers
    r = svc.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range=f"{TAB_NAME}!A1:H1").execute()
    existing = r.get("values", [])
    if not existing or existing[0] != HEADERS:
        print("Headers missing or wrong — writing headers...")
        svc.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID, range=f"{TAB_NAME}!A1:H1",
            valueInputOption="RAW", body={"values": [HEADERS]}
        ).execute()
        print("Headers written.")
    else:
        print("Headers already correct.")
else:
    print(f"Creating tab '{TAB_NAME}'...")
    body = {"requests": [{"addSheet": {"properties": {"title": TAB_NAME}}}]}
    svc.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body=body).execute()
    print("Tab created.")
    # Write headers
    svc.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID, range=f"{TAB_NAME}!A1:H1",
        valueInputOption="RAW", body={"values": [HEADERS]}
    ).execute()
    print("Headers written.")

print("DONE.")
