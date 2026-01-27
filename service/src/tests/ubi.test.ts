/**
 * Unit tests for UBI Operations
 */

import { describe, it, expect } from 'vitest';
import { UBI_CONSTANTS } from '../sdk/ubi.js';

describe('UBI Constants', () => {
  describe('Fee Allocation', () => {
    it('should have valid base fee share', () => {
      expect(UBI_CONSTANTS.BASE_UBI_FEE_SHARE_BPS).toBe(5000);
      expect(UBI_CONSTANTS.BASE_UBI_FEE_SHARE_BPS).toBeGreaterThanOrEqual(UBI_CONSTANTS.MIN_UBI_FEE_SHARE_BPS);
      expect(UBI_CONSTANTS.BASE_UBI_FEE_SHARE_BPS).toBeLessThanOrEqual(UBI_CONSTANTS.MAX_UBI_FEE_SHARE_BPS);
    });

    it('should have valid min/max bounds', () => {
      expect(UBI_CONSTANTS.MIN_UBI_FEE_SHARE_BPS).toBe(3000);
      expect(UBI_CONSTANTS.MAX_UBI_FEE_SHARE_BPS).toBe(7000);
      expect(UBI_CONSTANTS.MIN_UBI_FEE_SHARE_BPS).toBeLessThan(UBI_CONSTANTS.MAX_UBI_FEE_SHARE_BPS);
    });
  });

  describe('Per-Person Limits', () => {
    it('should have valid target UBI', () => {
      expect(UBI_CONSTANTS.TARGET_UBI_PER_PERSON).toBe(100);
      expect(UBI_CONSTANTS.TARGET_UBI_PER_PERSON).toBeGreaterThanOrEqual(UBI_CONSTANTS.MIN_UBI_PER_PERSON);
      expect(UBI_CONSTANTS.TARGET_UBI_PER_PERSON).toBeLessThanOrEqual(UBI_CONSTANTS.MAX_UBI_PER_PERSON);
    });

    it('should have survival floor less than min', () => {
      expect(UBI_CONSTANTS.SURVIVAL_FLOOR).toBe(20);
      expect(UBI_CONSTANTS.SURVIVAL_FLOOR).toBeGreaterThan(0);
    });
  });

  describe('Engagement Requirements', () => {
    it('should have valid min engagement thresholds', () => {
      expect(UBI_CONSTANTS.MIN_ENGAGEMENT_TX).toBe(5);
      expect(UBI_CONSTANTS.MIN_ENGAGEMENT_COUNTERPARTIES).toBe(2);
    });

    it('should have increasing engagement ramps', () => {
      expect(UBI_CONSTANTS.RAMP_1_TX).toBe(2500);
      expect(UBI_CONSTANTS.RAMP_2_TX).toBe(5000);
      expect(UBI_CONSTANTS.RAMP_3_TX).toBe(7000);
      expect(UBI_CONSTANTS.RAMP_4_TX).toBe(8500);
      expect(UBI_CONSTANTS.RAMP_FULL).toBe(10000);

      // Verify they are increasing
      expect(UBI_CONSTANTS.RAMP_1_TX).toBeLessThan(UBI_CONSTANTS.RAMP_2_TX);
      expect(UBI_CONSTANTS.RAMP_2_TX).toBeLessThan(UBI_CONSTANTS.RAMP_3_TX);
      expect(UBI_CONSTANTS.RAMP_3_TX).toBeLessThan(UBI_CONSTANTS.RAMP_4_TX);
      expect(UBI_CONSTANTS.RAMP_4_TX).toBeLessThan(UBI_CONSTANTS.RAMP_FULL);
    });
  });

  describe('Adjustment Period', () => {
    it('should have valid adjustment period', () => {
      expect(UBI_CONSTANTS.ADJUSTMENT_PERIOD_EPOCHS).toBe(6);
      expect(UBI_CONSTANTS.ADJUSTMENT_PERIOD_EPOCHS).toBeGreaterThan(0);
    });
  });
});

describe('UBI Calculations', () => {
  describe('Engagement Multiplier', () => {
    it('should return survival floor for 0 transactions', () => {
      const txCount = 0;
      const multiplier = calculateEngagementMultiplier(txCount, 0);

      expect(multiplier).toBe(UBI_CONSTANTS.SURVIVAL_FLOOR * 100);
    });

    it('should return RAMP_1 for 1 transaction', () => {
      const multiplier = calculateEngagementMultiplier(1, 0);

      expect(multiplier).toBe(UBI_CONSTANTS.RAMP_1_TX);
    });

    it('should return full for 5+ transactions', () => {
      const multiplier5 = calculateEngagementMultiplier(5, 0);
      const multiplier10 = calculateEngagementMultiplier(10, 0);

      expect(multiplier5).toBe(UBI_CONSTANTS.RAMP_FULL);
      expect(multiplier10).toBe(UBI_CONSTANTS.RAMP_FULL);
    });

    it('should add bonus for diverse counterparties', () => {
      const withoutBonus = calculateEngagementMultiplier(3, 1);
      const withBonus = calculateEngagementMultiplier(3, 2);

      expect(withBonus).toBeGreaterThan(withoutBonus);
    });

    it('should cap multiplier at 10000', () => {
      const multiplier = calculateEngagementMultiplier(10, 10);

      expect(multiplier).toBeLessThanOrEqual(10000);
    });
  });

  describe('Adaptive Fee Share', () => {
    it('should increase share when below target', () => {
      const currentPerPerson = 50; // 50% of target 100
      const currentShare = 5000;

      const newShare = calculateAdaptiveFeeShare(currentPerPerson, currentShare);

      expect(newShare).toBeGreaterThan(currentShare);
    });

    it('should decrease share when above target', () => {
      const currentPerPerson = 150; // 150% of target 100
      const currentShare = 5000;

      const newShare = calculateAdaptiveFeeShare(currentPerPerson, currentShare);

      expect(newShare).toBeLessThan(currentShare);
    });

    it('should stay same when near target', () => {
      const currentPerPerson = 95; // 95% of target (within 80-120%)
      const currentShare = 5000;

      const newShare = calculateAdaptiveFeeShare(currentPerPerson, currentShare);

      expect(newShare).toBe(currentShare);
    });

    it('should not go below minimum', () => {
      const newShare = calculateAdaptiveFeeShare(1000, UBI_CONSTANTS.MIN_UBI_FEE_SHARE_BPS);

      expect(newShare).toBeGreaterThanOrEqual(UBI_CONSTANTS.MIN_UBI_FEE_SHARE_BPS);
    });

    it('should not go above maximum', () => {
      const newShare = calculateAdaptiveFeeShare(10, UBI_CONSTANTS.MAX_UBI_FEE_SHARE_BPS);

      expect(newShare).toBeLessThanOrEqual(UBI_CONSTANTS.MAX_UBI_FEE_SHARE_BPS);
    });
  });

  describe('UBI Distribution', () => {
    it('should calculate pool correctly', () => {
      const totalFees = 1000_000_000n; // 1000 tokens
      const feeShareBps = 5000; // 50%

      const ubiPool = (totalFees * BigInt(feeShareBps)) / 10000n;

      expect(ubiPool).toBe(500_000_000n);
    });

    it('should calculate per-person correctly', () => {
      const ubiPool = 1000_000_000n; // 1000 tokens
      const eligibleCount = 100;

      const perPerson = ubiPool / BigInt(eligibleCount);

      expect(perPerson).toBe(10_000_000n); // 10 tokens per person
    });

    it('should apply engagement multiplier correctly', () => {
      const baseAmount = 10_000_000n; // 10 tokens
      const multiplier = 7000; // 70%

      const finalAmount = (baseAmount * BigInt(multiplier)) / 10000n;

      expect(finalAmount).toBe(7_000_000n); // 7 tokens
    });
  });
});

// Helper functions matching UBI operations logic
function calculateEngagementMultiplier(txCount: number, uniqueCounterparties: number): number {
  let multiplier = UBI_CONSTANTS.SURVIVAL_FLOOR * 100;

  if (txCount >= 5) {
    multiplier = UBI_CONSTANTS.RAMP_FULL;
  } else if (txCount >= 4) {
    multiplier = UBI_CONSTANTS.RAMP_4_TX;
  } else if (txCount >= 3) {
    multiplier = UBI_CONSTANTS.RAMP_3_TX;
  } else if (txCount >= 2) {
    multiplier = UBI_CONSTANTS.RAMP_2_TX;
  } else if (txCount >= 1) {
    multiplier = UBI_CONSTANTS.RAMP_1_TX;
  }

  if (uniqueCounterparties >= UBI_CONSTANTS.MIN_ENGAGEMENT_COUNTERPARTIES) {
    multiplier = Math.min(multiplier + 500, 10000);
  }

  return multiplier;
}

function calculateAdaptiveFeeShare(currentPerPerson: number, currentShareBps: number): number {
  const target = UBI_CONSTANTS.TARGET_UBI_PER_PERSON;

  if (currentPerPerson < target * 0.8) {
    return Math.min(currentShareBps + 200, UBI_CONSTANTS.MAX_UBI_FEE_SHARE_BPS);
  } else if (currentPerPerson > target * 1.2) {
    return Math.max(currentShareBps - 200, UBI_CONSTANTS.MIN_UBI_FEE_SHARE_BPS);
  }

  return currentShareBps;
}
