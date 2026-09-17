import type { Capture, NewRecord, Pellet, Settings, Team } from './types';

export const BASE = 'https://cruttelut.kaasfrich.dk/rest';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new ApiError(res.status, `${init?.method ?? 'GET'} ${url} -> ${res.status}`);
  return (await res.json()) as T;
}

/**
 * cruttelut is a flat JSON store: whole-collection reads, no filtering, no
 * uniqueness. PUT must carry the full record, so `update` takes the record.
 */
function collection<T extends { _id: string }>(name: string) {
  const url = `${BASE}/${name}`;
  return {
    name,
    list: () => request<T[]>(url),
    // POST answers `{ id }` only, not the stored record, so the record is
    // rebuilt from what was sent. Anything else the server returns wins.
    create: async (record: NewRecord<T>): Promise<T> => {
      const res = await request<Partial<T> & { id?: string }>(url, { method: 'POST', body: JSON.stringify(record) });
      const { id, ...rest } = res;
      const _id = rest._id ?? id;
      if (!_id) throw new ApiError(500, `POST ${url} returned no id`);
      return { ...record, ...rest, _id } as T;
    },
    update: (record: T) => request<T>(`${url}/${record._id}`, { method: 'PUT', body: JSON.stringify(record) }),
    remove: (id: string) => request<unknown>(`${url}/${id}`, { method: 'DELETE' }).then(() => undefined),
  };
}

export const api = {
  settings: collection<Settings>('ch2cpacman_settings'),
  teams: collection<Team>('ch2cpacman_teams'),
  pellets: collection<Pellet>('ch2cpacman_pellets'),
  captures: collection<Capture>('ch2cpacman_captures'),
};
