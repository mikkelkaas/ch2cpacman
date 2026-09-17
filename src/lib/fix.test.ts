import { describe, expect, it } from 'vitest';
import { isUsableFix, MAX_FIX_ACCURACY_M } from './fix';

describe('isUsableFix', () => {
  it('accepts fixes up to the limit and rejects worse ones', () => {
    expect(isUsableFix({ accuracyM: 5 })).toBe(true);
    expect(isUsableFix({ accuracyM: MAX_FIX_ACCURACY_M })).toBe(true);
    expect(isUsableFix({ accuracyM: MAX_FIX_ACCURACY_M + 1 })).toBe(false);
  });
  it('rejects missing or non-numeric accuracy', () => {
    expect(isUsableFix(null)).toBe(false);
    expect(isUsableFix({ accuracyM: NaN })).toBe(false);
  });
});
