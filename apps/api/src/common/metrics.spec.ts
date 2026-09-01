import { percentageDelta } from './metrics';

describe('percentageDelta', () => {
  it('computes growth and decline', () => {
    expect(percentageDelta(150, 100)).toBe(50);
    expect(percentageDelta(75, 100)).toBe(-25);
  });

  it('rounds to one decimal place', () => {
    expect(percentageDelta(349, 157)).toBe(122.3);
  });

  it('returns null when there is no baseline to compare against', () => {
    // Growth from zero is undefined as a percentage. The card shows nothing
    // rather than an invented number.
    expect(percentageDelta(12, 0)).toBeNull();
  });

  it('reports no change when both windows are empty', () => {
    expect(percentageDelta(0, 0)).toBe(0);
  });

  it('reports -100% when activity stops entirely', () => {
    expect(percentageDelta(0, 40)).toBe(-100);
  });
});
