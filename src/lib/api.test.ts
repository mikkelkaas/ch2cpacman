import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('cruttelut client', () => {
  it('lists a whole collection', async () => {
    const fetchMock = stubFetch(200, [{ _id: '1', name: 'A' }]);
    const teams = await api.teams.list();
    expect(teams).toEqual([{ _id: '1', name: 'A' }]);
    expect(fetchMock.mock.calls[0][0]).toBe('https://cruttelut.kaasfrich.dk/rest/ch2cpacman_teams');
  });

  it('sends a filter as URL-encoded JSON so the server returns only matching records', async () => {
    const fetchMock = stubFetch(200, []);
    await api.captures.list({ teamId: 't1' });
    const url = fetchMock.mock.calls[0][0];
    expect(url).toBe(`https://cruttelut.kaasfrich.dk/rest/ch2cpacman_captures?filter=${encodeURIComponent('{"teamId":"t1"}')}`);
  });

  it('creates without sending an _id and rebuilds the record around the returned id', async () => {
    // cruttelut answers a bare `{ id }` on POST, not the stored document.
    const fetchMock = stubFetch(201, { id: 'new' });
    const pellet = await api.pellets.create({ name: 'Prik 1', lat: 1, lng: 2, radiusM: 25, points: 1 });
    expect(pellet).toEqual({ _id: 'new', name: 'Prik 1', lat: 1, lng: 2, radiusM: 25, points: 1 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://cruttelut.kaasfrich.dk/rest/ch2cpacman_pellets');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).not.toHaveProperty('_id');
  });

  it('fails loudly when a create returns no id', async () => {
    stubFetch(201, { message: 'success' });
    await expect(api.teams.create({ name: 'x', code: 'ABCD', color: '#fff', createdAt: 'now', startedAt: null })).rejects.toBeInstanceOf(ApiError);
  });

  it('updates with the full object at the id url', async () => {
    const record = { _id: 's1', phaseMinutes: 12, start: null };
    const fetchMock = stubFetch(200, record);
    await api.settings.update(record);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://cruttelut.kaasfrich.dk/rest/ch2cpacman_settings/s1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual(record);
  });

  it('deletes by id', async () => {
    const fetchMock = stubFetch(200, { message: 'success' });
    await api.captures.remove('c1');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://cruttelut.kaasfrich.dk/rest/ch2cpacman_captures/c1');
    expect(init.method).toBe('DELETE');
  });

  it('throws ApiError with the status on a non-ok response', async () => {
    stubFetch(500, { error: 'boom' });
    await expect(api.teams.list()).rejects.toBeInstanceOf(ApiError);
    await expect(api.teams.list()).rejects.toMatchObject({ status: 500 });
  });
});
