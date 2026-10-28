import { describe, expect, it } from 'vitest';
import { pickLang } from './lang';
import { playerDa } from './player/da';
import type { RulesInput } from './player/da';
import { playerEn } from './player/en';
import { playerNb } from './player/nb';

describe('pickLang', () => {
  it('keeps a saved choice over the browser', () => {
    expect(pickLang('nb', ['da-DK'])).toBe('nb');
  });

  it('ignores a saved value that is not a language', () => {
    expect(pickLang('xx', ['da-DK'])).toBe('da');
  });

  it('maps Norwegian variants to Bokmål', () => {
    expect(pickLang(null, ['nb-NO'])).toBe('nb');
    expect(pickLang(null, ['nn'])).toBe('nb');
    expect(pickLang(null, ['no'])).toBe('nb');
  });

  it('takes the first browser language it knows', () => {
    expect(pickLang(null, ['de-DE', 'en-GB', 'da'])).toBe('en');
    expect(pickLang(null, ['de-DE', 'DA'])).toBe('da');
  });

  it('falls back to English', () => {
    expect(pickLang(null, ['de-DE'])).toBe('en');
    expect(pickLang(null, [])).toBe('en');
  });
});

describe('rules', () => {
  const variants: RulesInput[] = [
    { minutes: 10, ghosts: true, penalty: 2, bonus: 3, hasPower: true, hasDouble: true, hungry: true, lateStep: 10, latePenalty: 1, latePenaltyMax: 10, groupStart: false, sharedDots: false },
    { minutes: 7, ghosts: false, penalty: 2, bonus: 3, hasPower: true, hasDouble: false, hungry: true, lateStep: 10, latePenalty: 0, latePenaltyMax: 10, groupStart: true, sharedDots: false },
    { minutes: 7, ghosts: true, penalty: 2, bonus: 3, hasPower: false, hasDouble: false, hungry: false, lateStep: 10, latePenalty: 1, latePenaltyMax: 10, groupStart: true, sharedDots: true },
  ];

  it.each(variants)('lists the same rules in every language', input => {
    const icons = playerDa.rules(input).map(r => r.icon);
    expect(playerEn.rules(input).map(r => r.icon)).toEqual(icons);
    expect(playerNb.rules(input).map(r => r.icon)).toEqual(icons);
  });

  it('puts the settings into the text', () => {
    const input = variants[0];
    for (const t of [playerDa, playerEn, playerNb]) {
      const text = t.rules(input).map(r => r.text).join(' ');
      expect(text).toContain('10');
      expect(text).toContain(String(input.penalty));
      expect(text).toContain(String(input.bonus));
    }
  });

  it('tells a group game that the leader starts the time', () => {
    const solo = playerDa.rules(variants[0]).map(r => r.text);
    expect(solo).toContain('Før I starter, kan I se kortet og prikkerne. Læg en plan, tiden starter først, når I trykker START.');
    const group = playerDa.rules(variants[1]).map(r => r.text);
    expect(group).toContain('Før start kan I se kortet og prikkerne. Læg en plan, tiden starter på lederens signal, for alle hold på én gang.');
    expect(group.some(text => text.includes('START.'))).toBe(false);
  });

  it('explains shared dots only when the dots are shared', () => {
    const shared = 'Prikkerne deles med de andre hold. Det hold, der først når en prik, får den, og så er den væk for alle andre.';
    expect(playerDa.rules(variants[1]).map(r => r.text)).not.toContain(shared);
    expect(playerDa.rules(variants[2]).map(r => r.text)).toContain(shared);
    for (const t of [playerEn, playerNb]) {
      expect(t.rules(variants[2]).length).toBe(t.rules({ ...variants[2], sharedDots: false }).length + 1);
    }
  });
});
