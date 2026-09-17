import { describe, expect, it } from 'vitest';
import { pelletsWithin } from './capture';
import type { Pellet } from './types';

const here = { lat: 55.68, lng: 12.57 };
// ~0.00009 deg lat ≈ 10 m
function pellet(id: string, dLat: number, radiusM = 25): Pellet {
  return { _id: id, name: id, lat: here.lat + dLat, lng: here.lng, radiusM, points: 1 };
}

describe('pelletsWithin', () => {
  it('returns a pellet inside its radius', () => {
    expect(pelletsWithin(here, [pellet('a', 0.0001)], new Set())).toHaveLength(1);
  });
  it('excludes a pellet outside its radius', () => {
    expect(pelletsWithin(here, [pellet('a', 0.0005)], new Set())).toHaveLength(0);
  });
  it('treats the radius as inclusive', () => {
    // 0.0002247 deg lat ≈ 25.0 m
    const p = pellet('a', 0, 10);
    p.lat = here.lat + 10 / 111_195;
    expect(pelletsWithin(here, [p], new Set())).toHaveLength(1);
  });
  it('skips pellets already eaten', () => {
    expect(pelletsWithin(here, [pellet('a', 0.0001)], new Set(['a']))).toHaveLength(0);
  });
  it('returns several pellets at once', () => {
    const list = pelletsWithin(here, [pellet('a', 0.0001), pellet('b', -0.0001), pellet('c', 0.001)], new Set());
    expect(list.map(p => p._id).sort()).toEqual(['a', 'b']);
  });
});
