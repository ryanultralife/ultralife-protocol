// =============================================================================
// UltraLife Protocol — PRC-37 Library Tests
// =============================================================================

use ultralife/prc37.{
  CYCLE_SLOTS, GENESIS_SLOT, QUORUM_BPS, SUPERMAJORITY_BPS, RESONANCE_THRESHOLD,
  current_cycle, cycle_start, cycle_end, in_cycle, cycle_position, cycle_progress,
  MIN_VOTING_PERIOD, EMERGENCY_VOTING_PERIOD, CONSTITUTIONAL_VOTING_PERIOD,
  UBI_WINDOW, in_ubi_window, next_ubi_start,
  HEALTH_UPDATE_START, in_health_update_window,
  VITALITY_DECAY_PER_CYCLE, calculate_vitality,
  quorum_reached, supermajority_reached, majority_reached,
}

// =============================================================================
// CYCLE CALCULATION TESTS
// =============================================================================

test cycle_0_at_genesis() {
  current_cycle(GENESIS_SLOT) == 0
}

test cycle_0_just_before_end() {
  current_cycle(GENESIS_SLOT + CYCLE_SLOTS - 1) == 0
}

test cycle_1_at_exactly_one_cycle() {
  current_cycle(GENESIS_SLOT + CYCLE_SLOTS) == 1
}

test cycle_10_calculation() {
  current_cycle(GENESIS_SLOT + CYCLE_SLOTS * 10) == 10
}

test cycle_start_for_0() {
  cycle_start(0) == GENESIS_SLOT
}

test cycle_start_for_1() {
  cycle_start(1) == GENESIS_SLOT + CYCLE_SLOTS
}

test cycle_end_for_0() {
  cycle_end(0) == GENESIS_SLOT + CYCLE_SLOTS - 1
}

test in_cycle_true_at_start() {
  in_cycle(cycle_start(5), 5)
}

test in_cycle_true_at_end() {
  in_cycle(cycle_end(5), 5)
}

test in_cycle_false_before() {
  !in_cycle(cycle_start(5) - 1, 5)
}

test in_cycle_false_after() {
  !in_cycle(cycle_end(5) + 1, 5)
}

test cycle_position_at_start() {
  cycle_position(cycle_start(3)) == 0
}

test cycle_position_at_middle() {
  cycle_position(cycle_start(3) + CYCLE_SLOTS / 2) == CYCLE_SLOTS / 2
}

test cycle_progress_at_start() {
  cycle_progress(cycle_start(1)) == 0
}

test cycle_progress_at_end() {
  // Should be close to 10000 (100%)
  cycle_progress(cycle_end(1)) > 9990
}

// =============================================================================
// UBI WINDOW TESTS
// =============================================================================

test ubi_window_true_at_cycle_start() {
  in_ubi_window(cycle_start(5))
}

test ubi_window_true_just_before_end() {
  in_ubi_window(cycle_start(5) + UBI_WINDOW - 1)
}

test ubi_window_false_after_window() {
  !in_ubi_window(cycle_start(5) + UBI_WINDOW)
}

test ubi_window_false_at_cycle_end() {
  !in_ubi_window(cycle_end(5))
}

test next_ubi_start_within_window() {
  // If in window, returns current cycle start
  let slot = cycle_start(5) + 100
  next_ubi_start(slot) == cycle_start(5)
}

test next_ubi_start_after_window() {
  // If after window, returns next cycle start
  let slot = cycle_start(5) + UBI_WINDOW + 100
  next_ubi_start(slot) == cycle_start(6)
}

// =============================================================================
// HEALTH UPDATE WINDOW TESTS
// =============================================================================

test health_window_false_at_start() {
  !in_health_update_window(cycle_start(3))
}

test health_window_false_before_last_day() {
  !in_health_update_window(cycle_start(3) + HEALTH_UPDATE_START - 1)
}

test health_window_true_at_last_day() {
  in_health_update_window(cycle_start(3) + HEALTH_UPDATE_START)
}

test health_window_true_at_cycle_end() {
  in_health_update_window(cycle_end(3))
}

// =============================================================================
// VITALITY DECAY TESTS
// =============================================================================

test vitality_no_decay_at_0_cycles() {
  calculate_vitality(10000, 0) == 10000
}

test vitality_decay_1_cycle() {
  calculate_vitality(10000, 1) == 10000 - VITALITY_DECAY_PER_CYCLE
}

test vitality_decay_5_cycles() {
  calculate_vitality(10000, 5) == 10000 - 5 * VITALITY_DECAY_PER_CYCLE
}

test vitality_bottoms_at_zero() {
  calculate_vitality(10000, 20) == 0
}

test vitality_cannot_go_negative() {
  calculate_vitality(5000, 10) == 0
}

// =============================================================================
// QUORUM AND VOTING TESTS
// =============================================================================

test quorum_exactly_37_percent() {
  quorum_reached(37, 100)
}

test quorum_above_threshold() {
  quorum_reached(50, 100)
}

test quorum_below_threshold() {
  !quorum_reached(36, 100)
}

test quorum_with_large_numbers() {
  quorum_reached(370000, 1000000)
}

test supermajority_exactly_63_percent() {
  supermajority_reached(63, 100)
}

test supermajority_above_threshold() {
  supermajority_reached(70, 100)
}

test supermajority_below_threshold() {
  !supermajority_reached(62, 100)
}

test majority_simple_win() {
  majority_reached(51, 49)
}

test majority_tie_fails() {
  !majority_reached(50, 50)
}

test majority_loss() {
  !majority_reached(40, 60)
}

// =============================================================================
// CONSTANTS VALIDATION
// =============================================================================

test cycle_slots_equals_37_days() {
  CYCLE_SLOTS == 37 * 24 * 60 * 60
}

test quorum_is_37_percent() {
  QUORUM_BPS == 3700
}

test supermajority_is_63_percent() {
  SUPERMAJORITY_BPS == 6300
}

test resonance_threshold_is_37() {
  RESONANCE_THRESHOLD == 37
}

test voting_periods_relationship() {
  EMERGENCY_VOTING_PERIOD < MIN_VOTING_PERIOD &&
  MIN_VOTING_PERIOD < CONSTITUTIONAL_VOTING_PERIOD
}

test emergency_is_tenth_of_cycle() {
  EMERGENCY_VOTING_PERIOD == CYCLE_SLOTS / 10
}

test constitutional_is_two_cycles() {
  CONSTITUTIONAL_VOTING_PERIOD == CYCLE_SLOTS * 2
}
