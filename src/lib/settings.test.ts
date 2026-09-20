import { describe, expect, it } from 'vitest';
import { withDefaults } from './settings';

describe('withDefaults', () => {
  it('fills in ghost fields an older settings document lacks', () => {
    const full = withDefaults({ _id: 's', phaseMinutes: 10, start: null });
    expect(full.ghostCount).toBe(2);
    expect(full.doubleSeconds).toBe(60);
    expect(full.ghostMaxSpeedMps).toBe(4);
    expect(full.ghostRampS).toBe(60);
    expect(full.phaseMinutes).toBe(10);
  });
  it('keeps explicit values, including zero', () => {
    expect(withDefaults({ _id: 's', phaseMinutes: 10, start: null, ghostCount: 0 }).ghostCount).toBe(0);
  });
});

describe('withDefaults, home rule', () => {
  it('fills in the home radius and the late penalty', () => {
    const full = withDefaults({ _id: 's', phaseMinutes: 10, start: null });
    expect(full.homeRadiusM).toBe(15);
    expect(full.lateStepS).toBe(10);
    expect(full.latePenaltyPerStep).toBe(1);
    expect(full.latePenaltyMax).toBe(10);
  });
});
