import { describe, expect, it } from 'vitest';
import {
  calculateTargetFeedForHeads,
  getAgeDay,
  getBroilerTarget,
  getLastBroilerTargetDay,
} from '../shared/utils/broilerTargets';

describe('broiler target age logic', () => {
  it('starts batch age at Day 0 on the chick unloading date', () => {
    expect(getAgeDay('2026-06-21', '2026-06-20')).toBeNull();
    expect(getAgeDay('2026-06-21', '2026-06-21')).toBe(0);
    expect(getAgeDay('2026-06-21', '2026-06-22')).toBe(1);
  });

  it('keeps the first broiler target aligned with Day 0', () => {
    const dayZeroTarget = getBroilerTarget(0);
    const dayOneTarget = getBroilerTarget(1);
    const feedTarget = calculateTargetFeedForHeads(1000, 0);

    expect(dayZeroTarget).toEqual(expect.objectContaining({
      day: 0,
      weightGrams: 53,
      bagsPerThousandHeads: 0.3,
    }));
    expect(dayOneTarget).toEqual(expect.objectContaining({
      day: 1,
      weightGrams: 67,
    }));
    expect(feedTarget).toEqual(expect.objectContaining({
      day: 0,
      heads: 1000,
      targetBags: 0.3,
      targetKg: 15,
    }));
    expect(getLastBroilerTargetDay()).toBe(32);
  });
});
