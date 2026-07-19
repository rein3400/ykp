/**
 * Google Drive photo/document storage, same service account as Sheets.
 * Files live in ONE shared Drive folder (YKP_DRIVE_FOLDER_ID) that must be
 * shared with the service account as Editor ΓÇö uploads count against the
 * folder owner's quota (service accounts have none).
 *
 * Sheets rows only store the Drive file_id; bytes are served through
 * /api/ops/attachments/[id]/file (public GET, unguessable ids).
 */
import { google, type drive_v3 } from 'googleapis';
import { Readable } from 'stream';

const SCOPES = ['https://www.googleapis.com/auth/drive'];
let cached: drive_v3.Drive | null = null;

export function isDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
    process.env.YKP_DRIVE_FOLDER_ID
  );
}

function getDriveClient(): drive_v3.Drive {
  if (cached) return cached;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !privateKey) throw new Error('Google Drive not configured (service account missing)');
  const auth = new google.auth.JWT({ email, key: privateKey.replace(/\\n/g, '\n'), scopes: SCOPES });
  cached = google.drive({ version: 'v3', auth });
  return cached;
}

function getFolderId(): string {
  const id = process.env.YKP_DRIVE_FOLDER_ID;
  if (!id) throw new Error('YKP_DRIVE_FOLDER_ID not set');
  return id;
}

/** Upload bytes to the shared folder; returns the Drive file id. */
export async function uploadToDrive(
  fileName: string,
  mimeType: string,
  data: Buffer
): Promise<string> {
  const drive = getDriveClient();
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [getFolderId()] },
    media: { mimeType, body: Readable.from(data) },
    fields: 'id'
  });
  const id = res.data.id;
  if (!id) throw new Error('Drive upload returned no file id');
  return id;
}

/** Download a file's bytes + mime type for the proxy route. */
export async function getFileFromDrive(fileId: string): Promise<{ data: Buffer; mimeType: string }> {
  const drive = getDriveClient();
  const meta = await drive.files.get({ fileId, fields: 'mimeType' });
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  return {
    data: Buffer.from(res.data as ArrayBuffer),
    mimeType: meta.data.mimeType ?? 'application/octet-stream'
  };
}
