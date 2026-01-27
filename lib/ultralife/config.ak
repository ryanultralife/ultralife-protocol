// =============================================================================
// UltraLife Protocol — Configuration Constants
// =============================================================================
//
// These constants define the protocol parameters.
// They were previously in aiken.toml but are now defined here for clarity.
//
// =============================================================================

// =============================================================================
// PRC-37 TIMING CONSTANTS
// =============================================================================

/// Cycle length in slots (37 days)
pub const cycle_slots: Int = 3196800

// =============================================================================
// ECONOMIC PARAMETERS
// =============================================================================

/// Total token supply: 400 billion
pub const total_supply: Int = 400000000000

/// Treasury pool: 400 billion
pub const treasury_pool: Int = 400000000000

/// Grants pool: 400 billion
pub const grants_pool: Int = 400000000000

/// Grant per new verified user
pub const grant_per_user: Int = 50

// =============================================================================
// GOVERNANCE THRESHOLDS (basis points)
// =============================================================================

/// Quorum: 37%
pub const quorum_bps: Int = 3700

/// Majority: 50%
pub const majority_bps: Int = 5000

/// Supermajority: 63%
pub const supermajority_bps: Int = 6300

/// Resonance threshold: 37
pub const resonance_threshold: Int = 37

// =============================================================================
// IMPACT PARAMETERS
// =============================================================================

/// High magnitude threshold
pub const high_magnitude_threshold: Int = 500

/// Impact fee in tokens
pub const impact_fee: Int = 5

// =============================================================================
// UBI PARAMETERS
// =============================================================================

/// Base UBI per cycle
pub const base_ubi: Int = 100

/// Minimum multiplier: 50% (5000 basis points)
pub const min_multiplier: Int = 5000

/// Maximum multiplier: 150% (15000 basis points)
pub const max_multiplier: Int = 15000

// =============================================================================
// BONDING CURVE PARAMETERS
// =============================================================================

/// Base price in micro-units
pub const base_price: Int = 1

/// Maximum price multiplier: 1000x at full distribution
pub const max_price_mult: Int = 1000

/// Sell discount: 90% of buy price (9000 basis points)
pub const sell_discount_bps: Int = 9000

// =============================================================================
// VERIFICATION LEVELS
// =============================================================================

/// Basic level (wallet only)
pub const level_basic: Int = 0

/// Standard level (DNA verified)
pub const level_standard: Int = 1

/// Verified level (bioregion residency)
pub const level_verified: Int = 2

/// Steward level (community endorsement)
pub const level_steward: Int = 3
