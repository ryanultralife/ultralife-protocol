// =============================================================================
// UltraLife Protocol — PRC-37 (Prime Resonance Constant)
// =============================================================================
//
// All timing in UltraLife aligns to 37-day cycles.
// 37 is prime — cannot be gamed by calendar alignment.
//
// =============================================================================

// =============================================================================
// CONSTANTS
// =============================================================================

/// 37 days in seconds
pub const CYCLE_SECONDS: Int = 37 * 24 * 60 * 60  // 3,196,800

/// 37 days in slots (1 slot = 1 second on Cardano)
pub const CYCLE_SLOTS: Int = 3_196_800

/// Genesis timestamp (Preview testnet: Oct 24, 2022)
/// Adjust for mainnet
pub const GENESIS_SLOT: Int = 0

/// Quorum threshold: 37%
pub const QUORUM_BPS: Int = 3700

/// Supermajority threshold: 63% (100 - 37)
pub const SUPERMAJORITY_BPS: Int = 6300

/// Resonance threshold: 37 interpretations for emergence
pub const RESONANCE_THRESHOLD: Int = 37

/// Smoothing window: 37 samples
pub const SMOOTHING_WINDOW: Int = 37

// =============================================================================
// CYCLE CALCULATIONS
// =============================================================================

/// Get current cycle number from slot
pub fn current_cycle(slot: Int) -> Int {
  (slot - GENESIS_SLOT) / CYCLE_SLOTS
}

/// Get cycle start slot
pub fn cycle_start(cycle: Int) -> Int {
  GENESIS_SLOT + (cycle * CYCLE_SLOTS)
}

/// Get cycle end slot
pub fn cycle_end(cycle: Int) -> Int {
  cycle_start(cycle + 1) - 1
}

/// Check if slot is within a specific cycle
pub fn in_cycle(slot: Int, cycle: Int) -> Bool {
  slot >= cycle_start(cycle) && slot <= cycle_end(cycle)
}

/// Get position within cycle (0 to CYCLE_SLOTS-1)
pub fn cycle_position(slot: Int) -> Int {
  (slot - GENESIS_SLOT) % CYCLE_SLOTS
}

/// Get progress through cycle (0-10000 = 0-100.00%)
pub fn cycle_progress(slot: Int) -> Int {
  (cycle_position(slot) * 10000) / CYCLE_SLOTS
}

// =============================================================================
// GOVERNANCE TIMING
// =============================================================================

/// Minimum voting period: 37 days (1 full cycle)
pub const MIN_VOTING_PERIOD: Int = CYCLE_SLOTS

/// Emergency voting period: 3.7 days (10% of cycle)
pub const EMERGENCY_VOTING_PERIOD: Int = CYCLE_SLOTS / 10

/// Constitutional voting period: 74 days (2 full cycles)
pub const CONSTITUTIONAL_VOTING_PERIOD: Int = CYCLE_SLOTS * 2

/// Get voting period for proposal type
pub fn voting_period(proposal_type_code: Int) -> Int {
  if proposal_type_code == 3 {
    // Emergency
    EMERGENCY_VOTING_PERIOD
  } else if proposal_type_code == 4 {
    // Constitutional
    CONSTITUTIONAL_VOTING_PERIOD
  } else {
    // Budget, Policy
    MIN_VOTING_PERIOD
  }
}

// =============================================================================
// UBI TIMING
// =============================================================================

/// UBI distribution window: first 3.7 days of each cycle
pub const UBI_WINDOW: Int = CYCLE_SLOTS / 10

/// Check if slot is in UBI distribution window
pub fn in_ubi_window(slot: Int) -> Bool {
  cycle_position(slot) < UBI_WINDOW
}

/// Get next UBI distribution start
pub fn next_ubi_start(slot: Int) -> Int {
  let current = current_cycle(slot)
  if in_ubi_window(slot) {
    cycle_start(current)
  } else {
    cycle_start(current + 1)
  }
}

// =============================================================================
// HEALTH INDEX TIMING
// =============================================================================

/// Health index update: last day of each cycle
pub const HEALTH_UPDATE_START: Int = CYCLE_SLOTS - (24 * 60 * 60)

/// Check if slot is in health update window
pub fn in_health_update_window(slot: Int) -> Bool {
  cycle_position(slot) >= HEALTH_UPDATE_START
}

// =============================================================================
// VITALITY DECAY
// =============================================================================

/// Vitality decay per cycle (interpretations lose relevance without resonance)
pub const VITALITY_DECAY_PER_CYCLE: Int = 1000  // 10% per cycle

/// Calculate remaining vitality
pub fn calculate_vitality(initial: Int, cycles_elapsed: Int) -> Int {
  let decay = cycles_elapsed * VITALITY_DECAY_PER_CYCLE
  if decay >= initial {
    0
  } else {
    initial - decay
  }
}

// =============================================================================
// QUORUM CHECKS
// =============================================================================

/// Check if quorum is reached
pub fn quorum_reached(votes: Int, eligible: Int) -> Bool {
  // votes >= 37% of eligible
  votes * 10000 >= eligible * QUORUM_BPS
}

/// Check if supermajority is reached
pub fn supermajority_reached(votes_for: Int, total_votes: Int) -> Bool {
  // votes_for >= 63% of total
  votes_for * 10000 >= total_votes * SUPERMAJORITY_BPS
}

/// Check if simple majority is reached
pub fn majority_reached(votes_for: Int, votes_against: Int) -> Bool {
  votes_for > votes_against
}

// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// WHY 37?
// =======
//
// 37 is:
// - Prime (cannot be factored)
// - Not aligned to weeks (7), months (30/31), or quarters
// - Long enough for meaningful activity
// - Short enough for responsive governance
//
// This prevents:
// - Gaming by calendar alignment
// - Predictable manipulation windows
// - Weekend/month-end effects
//
// CYCLE USES:
// ===========
//
// - UBI Distribution: Every 37 days
// - Governance Voting: 37-day minimum
// - Health Index: Updated every 37 days
// - Interpretation Vitality: Decays per 37-day cycle
// - Resonance Threshold: 37 interpretations for emergence
//
// =============================================================================
