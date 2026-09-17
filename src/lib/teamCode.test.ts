import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, generateTeamCode, normalizeCode } from './teamCode';

describe('generateTeamCode', () => {
  it('makes four characters from the alphabet', () => {
    const code = generateTeamCode([]);
    expect(code).toHaveLength(4);
    for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
  });
  it('never returns a code already in use', () => {
    // rand always 0 yields AAAA; once taken the generator must move on.
    let calls = 0;
    const rand = () => {
      calls += 1;
      return calls <= 4 ? 0 : 0.5;
    };
    const code = generateTeamCode(['AAAA'], rand);
    expect(code).not.toBe('AAAA');
  });
});

describe('normalizeCode', () => {
  it('uppercases, trims and drops characters outside the alphabet', () => {
    expect(normalizeCode(' k7-pq ')).toBe('K7PQ');
    expect(normalizeCode('a0o1i')).toBe('A');
  });
});
