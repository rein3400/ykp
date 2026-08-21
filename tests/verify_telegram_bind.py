import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

SHEET_ID = '1rdKV6BJMsDr3lKhIoxQXA8hbto9s8p0rOajHFYNsPVg'

private_key = """-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDaY0/zAp3Bf1U5
9RkhUyEgIat0QoeKHim4HxQsy4U2nmAke/hCGIICwngD+HL+bGT8DY8NxPHlrJnB
vM54wOEueA+AG3HIYSKZLmtJceOsuoguGCyDqfP/dYzCc/JYGeHap67ulPL81ycn
Ya/EM9d8gJzQnaZNzR2VVyhqmaBwtfhcJ0W5uC02ws0cx6z2caDnZ87wHKfMpaq1
87y4ZAnkljZvr5Teq98kZ4QkUF2BUjdLb7SclDK7QbqgIKaSMt/XIrbzs1KFQKHt
a59hhl/PdPfd0SPcabgVDQRymZc/5iNxwLTZ658DoQYF41rP+adcClSStsoSQ1FY
2WhasffZAgMBAAECggEALSqnjRywKGYPqBw5LZN+ESFtjq64zhfFbJte5pHUFBMG
0tzh4Del4fC69iVDETw1WYzrVn9yQRxks3U7Za2MlPoHSKlEa9stFu3LCiZYHm/4
vMHKqRN0D5RN/6SPzWlS9RBDpXvgUmskIai6O7O2ID2QUTQdwk8HDI05YmyyCkUy
dqBzcKY+tgki5mKc52zam4mr65KFWQbKFvOLq2PatfOhtmapkcf7z8X+kKl3DywR
UJRkx6X1euyC7gySKGZUAQIdm8xFaPoztTDuKuimoAPfSXnCVpuU7XwFXwtA68yT
oH5Sn94la2VOpdkPsEPQxqGmfxQaMYgorHwMtL97lQKBgQD3t/rF6KI762csL/8R
3/eq+qxJg3xzrtKHLf1qZUsPl4mvzlOvuiPYVKkQNmqNEVVv0f18mRqaBfPkc9cn
TqV6MfxuB/X487Z1mMoMwGZvYMPeF9uX/sNEh+mHzySu0oG30evYOihWbZSJdeaR
Bpid5rOszWWWabsz2+bQGrRmPQKBgQDhsFCqsEB0i3MH6TWAz3mdhp+utPNAYzHB
jfwPm3VLug3K/wNJd5YSdcAxic4dv8JfBrGhS0PSlv/6Oi2zbjWDPBtcd0PwnPWm
t1A+NkPiprEm0VLWehpLZWuLMv76TYx4yYybbB2iQtjTLPQy2pvTruOG3rHf8/qX
LLrkpucNzQKBgC9Aa9hWcKPHWm3GVfw94Ys+t6BqMVILteLNNfqWicPWnw/m5nWt
puq782fBSX/RH5/tyVF8DuP0YLpiEldQHCZ75G/Emvm620IBPAFErgVuys3RdTTA
BtVKq5QZQiEKzG2Y4Ejlhw49Zsj1sV5WiMQN3pYGs+sGDgxtVNC7V0/tAoGARFDY
ujJL8HtdwKFJPsqO564enAXONElSgGJ4UEkggmG5Vx9GYXC/jqryGIy8RakMLzOZ
hVeBGjf3GEmQF+ZecHE7XwwDFsyMV4DZ21sVxX/r0/I8/wtK9lOm8CXppN7gjJeF
5m4dskZF1/adnN8rmDIyUVsLwNzbl/NER352JmkCgYB0wM2WZWcE3jwcvApBURZA
YAyeWQq94IAfFXlOaFqZYBZhi4XVyqw/hr2dNYsEr+jXuOhxfZnZ6om5/oAeVrW+
zUyh3Ett1BeeiSb8USxtH+4hrX1NRO3wS2EsCtpe4Rs2KJhR88A/tWeVxmdVQZ6L
10RMS0z9kcn3YqeGqCEUWw==
-----END PRIVATE KEY-----"""

creds = service_account.Credentials.from_service_account_info(
    {
        "type": "service_account",
        "project_id": "ykp-hr-v1",
        "private_key_id": "x",
        "private_key": private_key,
        "client_email": "ykp-hr-v1-svc@ykp-hr-v1.iam.gserviceaccount.com",
        "client_id": "x",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "x",
    },
    scopes=["https://www.googleapis.com/auth/spreadsheets"],
)

svc = build('sheets', 'v4', credentials=creds)
sheet = svc.spreadsheets()

# users tab
res = sheet.values().get(spreadsheetId=SHEET_ID, range="users!A1:M5").execute()
print('=== users (first 5 rows) ===')
for r in res.get('values', []):
    print(r)

# master_employee telegram_id (col H = index 7)
res = sheet.values().get(spreadsheetId=SHEET_ID, range="master_employee!A1:H5").execute()
print('\n=== master_employee (first 5 rows, A-H) ===')
for r in res.get('values', []):
    print(r)
