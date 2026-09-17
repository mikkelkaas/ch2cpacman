import { describe, expect, it } from 'vitest';
import { homeForOrphans, inGame, orphans } from './games';

describe('games', () => {
  it('separates orphans from scoped records', () => {
    const records = [{ _id: 'a' }, { _id: 'b', gameId: 'g1' }, { _id: 'c', gameId: 'g2' }];
    expect(orphans(records).map(r => r._id)).toEqual(['a']);
    expect(inGame(records, 'g1').map(r => r._id)).toEqual(['b']);
  });
  it('sends orphans to the oldest game, or nowhere when there is none', () => {
    expect(homeForOrphans([])).toBeNull();
    const games = [
      { _id: 'new', name: 'B', createdAt: '2026-09-20T10:00:00Z' },
      { _id: 'old', name: 'A', createdAt: '2026-09-19T10:00:00Z' },
    ];
    expect(homeForOrphans(games)?._id).toBe('old');
  });
});
