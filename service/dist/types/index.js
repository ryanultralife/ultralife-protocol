/**
 * UltraLife Protocol TypeScript Types
 *
 * These mirror the Aiken types in contracts/lib/ultralife/types_universal.ak
 */
// Bonding curve: price(n) = n / 400,000,000,000
export function getBondingPrice(distributed) {
    // Returns price in USD
    return Number(distributed) / 400_000_000_000;
}
export function getTokensForUSD(usd, distributed) {
    const price = getBondingPrice(distributed);
    if (price < 0.000001)
        return BigInt(Math.floor(usd * 1_000_000_000)); // Near-zero price
    return BigInt(Math.floor(usd / price));
}
// UBI Constants (from contract)
export const UBI_CONSTANTS = {
    BASE_UBI_FEE_SHARE_BPS: 5000, // 50% starting point
    MIN_UBI_FEE_SHARE_BPS: 3000, // 30% floor
    MAX_UBI_FEE_SHARE_BPS: 7000, // 70% ceiling
    TARGET_UBI_PER_PERSON: 100, // Target per epoch
    ADJUSTMENT_PERIOD_EPOCHS: 6, // ~1 month
    MIN_ENGAGEMENT_TX: 5,
    MIN_ENGAGEMENT_COUNTERPARTIES: 2,
    SURVIVAL_FLOOR: 20, // Everyone gets this (1-2 food tx)
    MIN_UBI_PER_PERSON: 10,
    MAX_UBI_PER_PERSON: 500,
    // Engagement ramp percentages
    RAMP_1_TX: 2500, // 25%
    RAMP_2_TX: 5000, // 50%
    RAMP_3_TX: 7000, // 70%
    RAMP_4_TX: 8500, // 85%
    RAMP_FULL: 10000, // 100%
};
// Fee allocation (dynamic UBI share, fixed validator/treasury split of remainder)
export const FEE_ALLOCATION = {
    UBI_SHARE_START: 5000, // 50% initial
    UBI_SHARE_MIN: 3000, // 30% floor
    UBI_SHARE_MAX: 7000, // 70% ceiling
    VALIDATOR_SHARE: 3000, // 30% of remainder
    // Treasury gets what's left
};
//# sourceMappingURL=index.js.map