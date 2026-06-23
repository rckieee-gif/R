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

  it('uses Day 0 as a zero baseline before following the guide day numbers', () => {
    const dayZeroTarget = getBroilerTarget(0);
    const dayOneTarget = getBroilerTarget(1);
    const feedTarget = calculateTargetFeedForHeads(1000, 0);

    expect(dayZeroTarget).toEqual(expect.objectContaining({
      day: 0,
      weightGrams: null,
      bagsPerThousandHeads: 0,
    }));
    expect(dayOneTarget).toEqual(expect.objectContaining({
      day: 1,
      weightGrams: 53,
      bagsPerThousandHeads: 0.3,
    }));
    expect(feedTarget).toEqual(expect.objectContaining({
      day: 0,
      heads: 1000,
      targetBags: 0,
      targetKg: 0,
    }));
    expect(getLastBroilerTargetDay()).toBe(33);
  });

  it('keeps Day 30 target feed aligned to the guide row', () => {
    const dayThirtyTarget = getBroilerTarget(30);
    const dayThirtyOneTarget = getBroilerTarget(31);
    const feedTarget = calculateTargetFeedForHeads(1000, 30);

    expect(dayThirtyTarget).toEqual(expect.objectContaining({
      day: 30,
      weightGrams: 1552,
      bagsPerThousandHeads: 46.64,
      fcr: 1.52,
    }));
    expect(dayThirtyOneTarget).toEqual(expect.objectContaining({
      day: 31,
      bagsPerThousandHeads: 49.8,
    }));
    expect(feedTarget).toEqual(expect.objectContaining({
      day: 30,
      heads: 1000,
      targetBags: 46.64,
      targetKg: 2332,
    }));
  });
});
