import { describe, expect, it } from 'vitest';
import { haversineM, headingDeg } from './geo';

const raadhus = { lat: 55.6759, lng: 12.5655 };
const noerreport = { lat: 55.6833, lng: 12.5714 };

describe('haversineM', () => {
  it('measures Rådhuspladsen to Nørreport at roughly 900 m', () => {
    const d = haversineM(raadhus, noerreport);
    expect(d).toBeGreaterThan(850);
    expect(d).toBeLessThan(950);
  });
  it('is zero for identical points', () => {
    expect(haversineM(raadhus, raadhus)).toBe(0);
  });
});

describe('headingDeg', () => {
  it('is 0 heading north and 90 heading east', () => {
    expect(headingDeg(raadhus, { lat: raadhus.lat + 0.001, lng: raadhus.lng })).toBeCloseTo(0, 0);
    expect(headingDeg(raadhus, { lat: raadhus.lat, lng: raadhus.lng + 0.001 })).toBeCloseTo(90, 0);
  });
  it('wraps into 0..360', () => {
    const west = headingDeg(raadhus, { lat: raadhus.lat, lng: raadhus.lng - 0.001 });
    expect(west).toBeCloseTo(270, 0);
  });
});
