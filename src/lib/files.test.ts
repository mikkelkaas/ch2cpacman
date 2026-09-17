import { describe, expect, it } from 'vitest';
import { fileUrl, teamPhotoKey } from './files';

describe('files', () => {
  it('builds a public url, encoding each path segment', () => {
    expect(fileUrl('b', 'g1/t 1/a.jpg')).toBe('https://cruttelut.kaasfrich.dk/files/b/g1/t%201/a.jpg');
  });
  it('keys team photos by game and team', () => {
    expect(teamPhotoKey({ _id: 't1', gameId: 'g1' })).toMatch(/^g1\/t1\/start-\d+\.jpg$/);
  });
});
