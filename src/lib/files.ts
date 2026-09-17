import { PREFIX } from './api';

/**
 * cruttelut file storage: raw PUT to /files/<bucket>/<key>, public GET at the
 * same address. Photos go in one bucket per collection prefix, keyed by game
 * and team, so a test build never touches the live bucket.
 */
export const FILES_BASE = 'https://cruttelut.kaasfrich.dk/files';
export const PHOTO_BUCKET = `${PREFIX}photos`;

export function fileUrl(bucket: string, key: string): string {
  return `${FILES_BASE}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export function photoUrl(key: string): string {
  return fileUrl(PHOTO_BUCKET, key);
}

export function teamPhotoKey(team: { _id: string; gameId?: string }): string {
  return `${team.gameId ?? 'nogame'}/${team._id}/start-${Date.now()}.jpg`;
}

export async function putFile(bucket: string, key: string, body: Blob, contentType: string): Promise<void> {
  const res = await fetch(fileUrl(bucket, key), { method: 'PUT', headers: { 'Content-Type': contentType }, body });
  if (!res.ok) throw new Error(`PUT ${bucket}/${key} -> ${res.status}`);
}

/** 404 is fine: the file is gone either way. */
export async function deleteFile(bucket: string, key: string): Promise<void> {
  const res = await fetch(fileUrl(bucket, key), { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`DELETE ${bucket}/${key} -> ${res.status}`);
}
