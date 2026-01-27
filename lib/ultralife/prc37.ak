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
const cycle_seconds = 3_196_800  // 37 * 24 * 60 * 60

/// 37 days in slots (1 slot = 1 second on Cardano)
const cycle_slots = 3_196_800

/// Genesis timestamp (Preview testnet: Oct 24, 2022)
/// Adjust for mainnet
const genesis_slot = 0

/// Quorum threshold: 37%
const quorum_bps = 3700

/// Supermajority threshold: 63% (100 - 37)
const supermajority_bps = 6300

/// Resonance threshold: 37 interpretations for emergence
const resonance_threshold = 37

/// Smoothing window: 37 samples
const smoothing_window = 37

// =============================================================================
// CYCLE CALCULATIONS
// =============================================================================

/// Get current cycle number from slot
pub fn current_cycle(slot: Int) -> Int {
  (slot - genesis_slot) / cycle_slots
}

/// Get cycle start slot
pub fn cycle_start(cycle: Int) -> Int {
  genesis_slot + cycle * cycle_slots
}

/// Get cycle end slot
pub fn cycle_end(cycle: Int) -> Int {
  cycle_start(cycle + 1) - 1
}

/// Check if slot is within a specific cycle
pub fn in_cycle(slot: Int, cycle: Int) -> Bool {
  slot >= cycle_start(cycle) && slot <= cycle_end(cycle)
}

/// Get position within cycle (0 to cycle_slots-1)
pub fn cycle_position(slot: Int) -> Int {
  (slot - genesis_slot) % cycle_slots
}

/// Get progress through cycle (0-10000 = 0-100.00%)
pub fn cycle_progress(slot: Int) -> Int {
  cycle_position(slot) * 10000 / cycle_slots
}

// =============================================================================
// GOVERNANCE TIMING
// =============================================================================

/// Minimum voting period: 37 days (1 full cycle)
const min_voting_period = 3_196_800

/// Emergency voting period: 3.7 days (10% of cycle)
const emergency_voting_period = 319_680

/// Constitutional voting period: 74 days (2 full cycles)
const constitutional_voting_period = 6_393_600

/// Get voting period for proposal type
pub fn voting_period(proposal_type_code: Int) -> Int {
  if proposal_type_code == 3 {
    // Emergency
    emergency_voting_period
  } else if proposal_type_code == 4 {
    // Constitutional
    constitutional_voting_period
  } else {
    // Budget, Policy
    min_voting_period
  }
}

// =============================================================================
// UBI TIMING
// =============================================================================

/// UBI distribution window: first 3.7 days of each cycle
const ubi_window = 319_680

/// Check if slot is in UBI distribution window
pub fn in_ubi_window(slot: Int) -> Bool {
  cycle_position(slot) < ubi_window
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
const health_update_start = 3_110_400  // cycle_slots - 86400

/// Check if slot is in health update window
pub fn in_health_update_window(slot: Int) -> Bool {
  cycle_position(slot) >= health_update_start
}

// =============================================================================
// VITALITY DECAY
// =============================================================================

/// Vitality decay per cycle (interpretations lose relevance without resonance)
const vitality_decay_per_cycle = 1000  // 10% per cycle

/// Calculate remaining vitality
pub fn calculate_vitality(initial: Int, cycles_elapsed: Int) -> Int {
  let decay = cycles_elapsed * vitality_decay_per_cycle
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
  votes * 10000 >= eligible * quorum_bps
}

/// Check if supermajority is reached
pub fn supermajority_reached(votes_for: Int, total_votes: Int) -> Bool {
  // votes_for >= 63% of total
  votes_for * 10000 >= total_votes * supermajority_bps
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
