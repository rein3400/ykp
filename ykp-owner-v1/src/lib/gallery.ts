/**
 * Owner photo gallery feed: fetch attachments from every module that
 * exposes them (warehouse/ops/investor) in parallel, normalize into one
 * list. Failure isolation per module, same as the rest of the app.
 */
import type { ModuleKey } from './types';
import { MODULE_KEYS } from './types';
import { MODULES, moduleUrl } from './modules';
import { fetchJson, extractItems } from './fetch';

export interface GalleryItem {
  id: string;
  module: ModuleKey;
  moduleLabel: string;
  entityType: string;
  entityId: string;
  /** Absolute URL to the bytes (module proxy route). */
  url: string;
  fileName: string;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
  isImage: boolean;
  /** True when stored in mock mode (bytes unavailable) — render placeholder. */
  mock: boolean;
}

export interface GalleryFeed {
  items: GalleryItem[];
  unavailable: { key: ModuleKey; label: string }[];
}

export interface GalleryQuery {
  modules?: ModuleKey[];
  entityType?: string;
  limitPerModule?: number;
}

export async function getGallery(q: GalleryQuery = {}): Promise<GalleryFeed> {
  const keys = (q.modules?.length ? q.modules : MODULE_KEYS).filter(
    (k) => MODULES[k].attachmentsPath
  );
  const limit = q.limitPerModule ?? 100;
  const results = await Promise.all(
    keys.map(async (key) => {
      const def = MODULES[key];
      const params = new URLSearchParams();
      if (q.entityType) params.set('entity_type', q.entityType);
      // attachments endpoints don't take limit; slice client-side
      const res = await fetchJson(`${moduleUrl(def, def.attachmentsPath as string)}?${params.toString()}`);
      return { key, label: def.label, rows: res.ok ? extractItems(res.data).slice(0, limit) : null };
    })
  );
  const unavailable = results
    .filter((r) => r.rows === null)
    .map(({ key, label }) => ({ key, label }));
  const items: GalleryItem[] = results.flatMap((r) =>
    (r.rows ?? []).map((row) => {
      const def = MODULES[r.key];
      return {
        id: row.attachment_id ?? '',
        module: r.key,
        moduleLabel: def.label,
        entityType: row.entity_type ?? '',
        entityId: row.entity_id ?? '',
        url: moduleUrl(def, `${def.attachmentsPath as string}/${row.attachment_id}/file`),
        fileName: row.file_name ?? '',
        mimeType: row.mime_type ?? '',
        uploadedBy: row.uploaded_by ?? '',
        createdAt: row.created_at ?? '',
        isImage: (row.mime_type ?? '').startsWith('image/'),
        mock: (row.file_id ?? '').startsWith('MOCK-')
      };
    })
  );
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items, unavailable };
}
