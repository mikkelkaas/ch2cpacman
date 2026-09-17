import { describe, expect, it } from 'vitest';
import { parseTeamNames } from './TeamsPanel';

describe('parseTeamNames', () => {
  it('takes one name per line and drops blanks and duplicates', () => {
    expect(parseTeamNames('Ugler\n\n  Ræve \nugler\nBævere\r\n')).toEqual(['Ugler', 'Ræve', 'Bævere']);
  });
  it('is empty for empty input', () => {
    expect(parseTeamNames('  \n ')).toEqual([]);
  });
});
