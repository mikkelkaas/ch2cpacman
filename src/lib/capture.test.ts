import { describe, expect, it } from 'vitest';
import { distanceToSegmentM, pelletsAlong, pelletsWithin } from './capture';
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

const M_LAT = 1 / 111_195;
const M_LNG = 1 / (111_195 * Math.cos((here.lat * Math.PI) / 180));
/** A fix `north` and `east` metres from `here`, at `atS` seconds. */
function at(north: number, east: number, atS: number) {
  return { lat: here.lat + north * M_LAT, lng: here.lng + east * M_LNG, at: atS * 1000 };
}
/** A 5 m pellet `north` and `east` metres from `here`. */
function dot(id: string, north: number, east: number, radiusM = 5): Pellet {
  return { _id: id, name: id, lat: here.lat + north * M_LAT, lng: here.lng + east * M_LNG, radiusM, points: 1 };
}

describe('distanceToSegmentM', () => {
  it('measures across to the middle of the segment', () => {
    expect(distanceToSegmentM(dot('p', 3, 10), at(0, 0, 0), at(0, 20, 0))).toBeCloseTo(3, 1);
  });
  it('measures to the nearer end beyond the segment', () => {
    expect(distanceToSegmentM(dot('p', 0, 26), at(0, 0, 0), at(0, 20, 0))).toBeCloseTo(6, 1);
  });
  it('handles a segment of zero length', () => {
    expect(distanceToSegmentM(dot('p', 4, 0), at(0, 0, 0), at(0, 0, 0))).toBeCloseTo(4, 1);
  });
});

describe('pelletsAlong', () => {
  it('eats a pellet run straight through between two fixes', () => {
    // 15 m in 5 s, fixes 7.5 m either side of the dot, both outside its 5 m radius.
    const hits = pelletsAlong(at(0, -7.5, 0), at(0, 7.5, 5), [dot('a', 0, 0)], new Set());
    expect(hits.map(p => p._id)).toEqual(['a']);
  });
  it('eats a pellet clipped at the edge of its radius', () => {
    expect(pelletsAlong(at(4, -7.5, 0), at(4, 7.5, 5), [dot('a', 0, 0)], new Set())).toHaveLength(1);
  });
  it('leaves a pellet the line passes outside', () => {
    expect(pelletsAlong(at(6, -7.5, 0), at(6, 7.5, 5), [dot('a', 0, 0)], new Set())).toHaveLength(0);
  });
  it('skips pellets already eaten', () => {
    expect(pelletsAlong(at(0, -7.5, 0), at(0, 7.5, 5), [dot('a', 0, 0)], new Set(['a']))).toHaveLength(0);
  });
  it('eats every pellet along the line', () => {
    const hits = pelletsAlong(at(0, 0, 0), at(0, 30, 5), [dot('a', 0, 10), dot('b', 2, 20), dot('c', 20, 15)], new Set());
    expect(hits.map(p => p._id).sort()).toEqual(['a', 'b']);
  });
  it('does not join a GPS jump faster than a runner', () => {
    // 100 m in 5 s is 20 m/s.
    expect(pelletsAlong(at(0, -50, 0), at(0, 50, 5), [dot('a', 0, 0)], new Set())).toHaveLength(0);
  });
  it('does not join fixes too far apart in time', () => {
    expect(pelletsAlong(at(0, -10, 0), at(0, 10, 11), [dot('a', 0, 0)], new Set())).toHaveLength(0);
  });
  it('does not join a fix older than the previous one', () => {
    expect(pelletsAlong(at(0, -7.5, 5), at(0, 7.5, 0), [dot('a', 0, 0)], new Set())).toHaveLength(0);
  });
  it('still eats a pellet at the new fix when the line is not drawn', () => {
    expect(pelletsAlong(at(0, -50, 0), at(0, 2, 5), [dot('a', 0, 0)], new Set())).toHaveLength(1);
    expect(pelletsAlong(null, at(0, 2, 5), [dot('a', 0, 0)], new Set())).toHaveLength(1);
  });
});
