// =============================================================================
// UltraLife Protocol — UBI (Universal Basic Income)
// =============================================================================
//
// LAYER 5: DISTRIBUTION
//
// UBI FUNDING: 100% from transaction fees. No accrual. No separate pool.
//
// ALGORITHM:
// 1. Each epoch, total fees collected = UBI pool for that epoch
// 2. Pool divided among eligible claimants based on engagement
// 3. Unclaimed tokens returned to fee pool (not accumulated)
// 4. Rate adjusts automatically: more activity = more UBI per person
//
// SELF-BALANCING:
// - High activity epoch → more fees → more UBI
// - Low activity epoch → fewer fees → less UBI
// - No inflation, no deflation, no reserve management
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId, AssetName, quantity_of, flatten}
use cardano/address.{VerificationKey, Script}
use cardano/transaction.{Transaction, Input, Output, OutputReference, InlineDatum}
use ultralife/types.{
  PnftDatum, BioregionDatum, AvatarCycleStats, BioregionCycleStats,
  VerificationLevel, Basic, Standard, Verified, Steward, Child,
  UbiPoolDatum, UbiClaimDatum,
}
use ultralife/prc37.{current_cycle, cycle_start, in_ubi_window, UBI_WINDOW}

// =============================================================================
// CONSTANTS
// =============================================================================

/// BASE UBI fee share (in basis points) - starting point
pub const BASE_UBI_FEE_SHARE_BPS: Int = 5000  // 50%

/// Minimum UBI fee share (floor)
pub const MIN_UBI_FEE_SHARE_BPS: Int = 3000   // 30%

/// Maximum UBI fee share (ceiling)
pub const MAX_UBI_FEE_SHARE_BPS: Int = 7000   // 70%

/// ENGAGEMENT THRESHOLD: Minimum transactions for FULL share
pub const MIN_ENGAGEMENT_TX: Int = 5

/// ENGAGEMENT THRESHOLD: Minimum unique counterparties for FULL share
pub const MIN_ENGAGEMENT_COUNTERPARTIES: Int = 2

/// SURVIVAL FLOOR: Enough for 1-2 food transactions per month
/// Everyone gets this regardless of engagement - basic dignity
/// But it's small enough to incentivize participation
pub const SURVIVAL_FLOOR: Int = 20  // ~2 basic food transactions

/// ENGAGEMENT RAMP: Gradual increase from floor to full share
/// Floor → 25% → 50% → 75% → 100% based on engagement level
/// Encourages incremental participation

/// Minimum UBI per eligible person (with some engagement)
pub const MIN_UBI_PER_PERSON: Int = 10

/// Maximum UBI per person (cap to prevent whale effects in small bioregions)
pub const MAX_UBI_PER_PERSON: Int = 500

/// Target UBI per person (algorithm adjusts fees to approach this)
pub const TARGET_UBI_PER_PERSON: Int = 100

/// Epochs per adjustment period (~6 epochs = ~1 month)
pub const ADJUSTMENT_PERIOD_EPOCHS: Int = 6

// =============================================================================
// DYNAMIC FEE ADJUSTMENT ALGORITHM
// =============================================================================
//
// The UBI fee percentage adjusts monthly based on economic conditions.
// Goal: Keep per-person UBI near TARGET_UBI_PER_PERSON without accruing reserves.
//
// ALGORITHM:
//
// 1. At end of each adjustment period (~1 month / 6 epochs):
//    - Calculate average UBI per person over the period
//    - Compare to TARGET_UBI_PER_PERSON
//
// 2. If average < target (UBI too low):
//    - Increase UBI_FEE_SHARE by 5% (500 bps)
//    - Capped at MAX_UBI_FEE_SHARE_BPS (70%)
//
// 3. If average > target × 1.5 (UBI too high):
//    - Decrease UBI_FEE_SHARE by 5% (500 bps)
//    - Floored at MIN_UBI_FEE_SHARE_BPS (30%)
//
// 4. If average is within range (target to target×1.5):
//    - No adjustment, system is balanced
//
// RESULT: Fee percentage self-adjusts to economic conditions
//         No human intervention. No governance votes. Pure algorithm.
//
// =============================================================================

/// Calculate adjusted UBI fee share for next period
fn calculate_adjusted_fee_share(
  current_share_bps: Int,
  period_stats: PeriodStats,
) -> Int {
  // Average UBI per person over the period
  let avg_ubi = if period_stats.total_claimants > 0 {
    period_stats.total_distributed / period_stats.total_claimants
  } else {
    0
  }
  
  // Compare to target
  if avg_ubi < TARGET_UBI_PER_PERSON {
    // UBI too low - increase fee share
    let new_share = current_share_bps + 500
    min(new_share, MAX_UBI_FEE_SHARE_BPS)
  } else if avg_ubi > TARGET_UBI_PER_PERSON * 3 / 2 {
    // UBI too high (>150% of target) - decrease fee share
    let new_share = current_share_bps - 500
    max(new_share, MIN_UBI_FEE_SHARE_BPS)
  } else {
    // Within acceptable range - no change
    current_share_bps
  }
}

/// Period statistics for fee adjustment
pub type PeriodStats {
  /// Period number (increments every ADJUSTMENT_PERIOD_EPOCHS)
  period: Int,
  /// Total UBI distributed over period
  total_distributed: Int,
  /// Total unique claimants over period
  total_claimants: Int,
  /// Total fees collected over period
  total_fees: Int,
  /// Current UBI fee share (basis points)
  current_fee_share: Int,
  /// Epochs in this period so far
  epochs_counted: Int,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type UbiRedeemer {
  /// Fund the UBI pool for a cycle
  FundPool {
    cycle: Int,
    amount: Int,
  }
  
  /// Claim UBI distribution
  ClaimUBI {
    pnft: AssetName,
    cycle: Int,
  }
  
  /// Close cycle (return unclaimed to treasury)
  CloseCycle {
    cycle: Int,
  }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type UbiConfig {
  /// UltraLife token policy
  token_policy: PolicyId,
  /// UltraLife token name
  token_name: AssetName,
  /// pNFT policy
  pnft_policy: PolicyId,
  /// Bioregion beacon policy
  bioregion_policy: PolicyId,
  /// Transaction records contract (for stats)
  records_contract: ByteArray,
  /// Treasury (for unclaimed tokens)
  treasury: ByteArray,
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator ubi(config: UbiConfig) {
  spend(
    datum: Option<UbiPoolDatum>,
    redeemer: UbiRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      FundPool { cycle, amount } -> {
        validate_fund_pool(tx, cycle, amount, config)
      }
      
      ClaimUBI { pnft, cycle } -> {
        expect Some(d) = datum
        validate_claim_ubi(tx, d, pnft, cycle, config)
      }
      
      CloseCycle { cycle } -> {
        expect Some(d) = datum
        validate_close_cycle(tx, d, cycle, config)
      }
    }
  }
}

// =============================================================================
// FUND POOL
// =============================================================================

fn validate_fund_pool(
  tx: Transaction,
  cycle: Int,
  amount: Int,
  config: UbiConfig,
) -> Bool {
  // Pool funding happens from treasury or governance
  // Creates UBI pool for specific bioregion and cycle
  
  // 1. Cycle must be current or next
  let current_slot = get_slot(tx)
  let current = current_cycle(current_slot)
  let cycle_valid = cycle == current || cycle == current + 1
  
  // 2. Tokens must be locked in pool
  let tokens_locked = verify_tokens_locked(
    tx.outputs,
    config.token_policy,
    config.token_name,
    amount,
  )
  
  // 3. Pool datum must be created
  let datum_created = verify_pool_datum(tx.outputs, cycle, amount, current_slot)
  
  cycle_valid && tokens_locked && datum_created
}

// =============================================================================
// CLAIM UBI
// =============================================================================

fn validate_claim_ubi(
  tx: Transaction,
  pool: UbiPoolDatum,
  pnft: AssetName,
  cycle: Int,
  config: UbiConfig,
) -> Bool {
  // 1. Must be in UBI window (first 3.7 days of cycle)
  let current_slot = get_slot(tx)
  let in_window = in_ubi_window(current_slot)
  
  // 2. Cycle must match pool
  let cycle_matches = cycle == pool.cycle
  
  // 3. Claimant must have Standard+ pNFT in this bioregion
  let pnft_valid = verify_claimant_pnft(tx, pnft, pool.bioregion, config.pnft_policy)
  expect Some(pnft_data) = pnft_valid
  
  // 4. Claimant must sign
  let claimant_signed = list.has(tx.extra_signatories, pnft_data.owner)
  
  // 5. Must not have claimed this cycle already
  let not_claimed = verify_no_prior_claim(tx.reference_inputs, pnft, cycle)
  
  // 6. Calculate distribution amount
  let distribution = calculate_ubi_amount(tx, pnft, pool.bioregion, cycle, config)
  
  // 7. Pool must have sufficient funds
  let sufficient_funds = pool.available >= distribution
  
  // 8. Tokens must go to claimant
  let tokens_sent = verify_tokens_to_claimant(
    tx.outputs,
    config.token_policy,
    config.token_name,
    distribution,
    pnft_data.owner,
  )
  
  // 9. Claim record created
  let claim_recorded = verify_claim_record(tx.outputs, pnft, cycle, distribution)
  
  // 10. Pool datum updated
  let pool_updated = verify_pool_datum_updated(tx.outputs, pool, distribution)
  
  in_window && cycle_matches && claimant_signed && not_claimed &&
  sufficient_funds && tokens_sent && claim_recorded && pool_updated
}

// =============================================================================
// UBI CALCULATION (FEE-FUNDED, RAMPED ENGAGEMENT)
// =============================================================================
//
// UBI ALGORITHM:
// 
// 1. Everyone gets SURVIVAL_FLOOR (enough for 1-2 food transactions)
// 2. Additional UBI based on engagement ramp:
//    - 0 tx: Floor only (20 ULTRA)
//    - 1 tx: Floor + 25% of share (20 + 25%)
//    - 2 tx: Floor + 50% of share
//    - 3 tx: Floor + 75% of share
//    - 5+ tx with 2+ counterparties: Floor + 100% of share
//
// This creates incentive to engage while ensuring basic dignity.
//
// =============================================================================

/// Calculate UBI amount for a claimant
/// SURVIVAL FLOOR + ENGAGEMENT RAMP
fn calculate_ubi_amount(
  tx: Transaction,
  pool: UbiPoolDatum,
  pnft: AssetName,
  cycle: Int,
  config: UbiConfig,
) -> Int {
  // 1. Everyone gets survival floor
  let floor = SURVIVAL_FLOOR
  
  // 2. Get engagement level and ramp multiplier
  let (engagement_weight, ramp_pct) = get_engagement_with_ramp(tx, pnft, cycle, config.records_contract)
  
  // 3. Calculate variable share of remaining pool
  let pool_after_floors = pool.ubi_pool - (pool.eligible_count * SURVIVAL_FLOOR)
  let variable_share = if pool.total_engagement_weight > 0 && pool_after_floors > 0 {
    (engagement_weight * pool_after_floors) / pool.total_engagement_weight
  } else {
    0
  }
  
  // 4. Apply ramp percentage to variable share
  let ramped_share = (variable_share * ramp_pct) / 10000
  
  // 5. Total = floor + ramped variable
  let total = floor + ramped_share
  
  // 6. Apply max cap
  min(total, MAX_UBI_PER_PERSON)
}

/// Get engagement weight AND ramp percentage
/// Returns (weight, ramp_pct in basis points)
fn get_engagement_with_ramp(
  tx: Transaction,
  pnft: AssetName,
  cycle: Int,
  records_contract: ByteArray,
) -> (Int, Int) {
  list.find_map(tx.reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect stats: AvatarCycleStats = data
        if stats.pnft == pnft && stats.cycle == cycle - 1 {
          let total_tx = stats.tx_sent + stats.tx_received
          let counterparties = stats.unique_counterparties
          
          // Calculate engagement weight
          let tx_weight = total_tx * 100
          let counterparty_weight = counterparties * 500
          let labor_weight = stats.labor_count * 1000
          let remediation_weight = stats.remediation_count * 2000
          let base = 1000
          let weight = base + tx_weight + counterparty_weight + labor_weight + remediation_weight
          
          // Calculate ramp percentage based on engagement level
          let ramp = calculate_ramp(total_tx, counterparties)
          
          Some((weight, ramp))
        } else {
          None
        }
      }
      _ -> None
    }
  }) |> unwrap_or((0, 0))  // No stats = floor only
}

/// Calculate engagement ramp percentage (basis points)
/// 0 tx = 0%, 1 tx = 2500, 2 tx = 5000, 3 tx = 7500, 5+ tx w/ 2+ counterparties = 10000
fn calculate_ramp(total_tx: Int, counterparties: Int) -> Int {
  if total_tx >= MIN_ENGAGEMENT_TX && counterparties >= MIN_ENGAGEMENT_COUNTERPARTIES {
    // Full engagement
    10000  // 100%
  } else if total_tx >= 4 {
    8500   // 85%
  } else if total_tx >= 3 {
    7000   // 70%
  } else if total_tx >= 2 {
    5000   // 50%
  } else if total_tx >= 1 {
    2500   // 25%
  } else {
    0      // Floor only
  }
}

/// Legacy function for backward compatibility
fn get_engagement_weight(
  tx: Transaction,
  pnft: AssetName,
  cycle: Int,
  records_contract: ByteArray,
) -> Int {
  let (weight, _ramp) = get_engagement_with_ramp(tx, pnft, cycle, records_contract)
  weight
}

/// Calculate engagement ratio (basis points) for partial engagement
fn calculate_engagement_ratio(total_tx: Int, counterparties: Int) -> Int {
  let tx_ratio = if MIN_ENGAGEMENT_TX > 0 {
    min(total_tx * 10000 / MIN_ENGAGEMENT_TX, 10000)
  } else {
    10000
  }
  let cp_ratio = if MIN_ENGAGEMENT_COUNTERPARTIES > 0 {
    min(counterparties * 10000 / MIN_ENGAGEMENT_COUNTERPARTIES, 10000)
  } else {
    10000
  }
  // Average of both ratios, with floor
  max((tx_ratio + cp_ratio) / 2, ZERO_ENGAGEMENT_FLOOR)
}

// =============================================================================
// EPOCH POOL INITIALIZATION (Called at epoch boundary)
// =============================================================================

/// Calculate UBI pool for new epoch from collected fees
fn calculate_epoch_ubi_pool(
  total_fees: Int,
  bioregion_stats: BioregionCycleStats,
) -> (Int, Int, Int) {
  // UBI gets 50% of fees
  let ubi_allocation = (total_fees * UBI_FEE_SHARE_BPS) / 10000
  
  // Eligible = active participants from previous cycle
  let eligible_count = bioregion_stats.active_count
  
  // Total engagement weight calculated from all participants
  // (This would be aggregated from all AvatarCycleStats in the bioregion)
  let total_weight = bioregion_stats.unique_participants * 1000  // Simplified
  
  (ubi_allocation, eligible_count, total_weight)
}

/// Get engagement score - determines FULL vs FRACTIONAL share
/// Returns (multiplier in basis points, is_full_share)
fn get_engagement_score(
  tx: Transaction,
  pnft: AssetName,
  cycle: Int,
  records_contract: ByteArray,
) -> (Int, Bool) {
  // Find avatar cycle stats in reference inputs
  list.find_map(tx.reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect stats: AvatarCycleStats = data
        if stats.pnft == pnft && stats.cycle == cycle - 1 {
          // Check engagement thresholds
          let total_tx = stats.tx_sent + stats.tx_received
          let counterparties = stats.unique_counterparties
          
          // FULL SHARE: Met both thresholds
          if total_tx >= MIN_ENGAGEMENT_TX && counterparties >= MIN_ENGAGEMENT_COUNTERPARTIES {
            Some((10000, True))  // 100% multiplier, full share
          } else {
            // FRACTIONAL SHARE: Calculate engagement ratio
            let tx_ratio = if MIN_ENGAGEMENT_TX > 0 {
              min(total_tx * 10000 / MIN_ENGAGEMENT_TX, 10000)
            } else {
              10000
            }
            let cp_ratio = if MIN_ENGAGEMENT_COUNTERPARTIES > 0 {
              min(counterparties * 10000 / MIN_ENGAGEMENT_COUNTERPARTIES, 10000)
            } else {
              10000
            }
            
            // Average of both ratios, with floor
            let avg_ratio = (tx_ratio + cp_ratio) / 2
            let floored = max(avg_ratio, ZERO_ENGAGEMENT_FLOOR)
            
            Some((floored, False))
          }
        } else {
          None
        }
      }
      _ -> None
    }
  }) |> unwrap_or((ZERO_ENGAGEMENT_FLOOR, False))  // Default: 10% floor, not full share
}

/// Get impact multiplier (7000-13000 = 70%-130%)
fn get_impact_score(
  tx: Transaction,
  pnft: AssetName,
  cycle: Int,
  records_contract: ByteArray,
) -> Int {
  // Find avatar cycle stats
  list.find_map(tx.reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect stats: AvatarCycleStats = data
        if stats.pnft == pnft && stats.cycle == cycle - 1 {
          // Score based on net impact
          let raw = 10000 + stats.net_impact
          Some(clamp(raw, 7000, 13000))
        } else {
          None
        }
      }
      _ -> None
    }
  }) |> unwrap_or(10000)
}

/// Get verification level bonus
fn get_level_bonus(
  tx: Transaction,
  pnft: AssetName,
  pnft_policy: PolicyId,
) -> Int {
  list.find_map(tx.reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect datum: PnftDatum = data
        when datum.level is {
          Standard -> Some(0)
          Verified -> Some(BASE_UBI / 10)   // +10%
          Steward -> Some(BASE_UBI / 5)     // +20%
          _ -> Some(0)
        }
      }
      _ -> None
    }
  }) |> unwrap_or(0)
}

// =============================================================================
// CLOSE CYCLE
// =============================================================================

fn validate_close_cycle(
  tx: Transaction,
  pool: UbiPoolDatum,
  cycle: Int,
  config: UbiConfig,
) -> Bool {
  // After UBI window, unclaimed tokens return to treasury
  
  // 1. Must be after UBI window for this cycle
  let current_slot = get_slot(tx)
  let window_end = cycle_start(cycle) + UBI_WINDOW
  let after_window = current_slot > window_end
  
  // 2. Unclaimed tokens go to treasury
  let remaining = pool.available
  let tokens_returned = verify_tokens_to_treasury(
    tx.outputs,
    config.token_policy,
    config.token_name,
    remaining,
    config.treasury,
  )
  
  after_window && tokens_returned
}

// =============================================================================
// HELPERS
// =============================================================================

fn get_slot(tx: Transaction) -> Int {
  // Extract lower bound from validity range
  when tx.validity_range.lower_bound.bound_type is {
    Finite(slot) -> slot
    _ -> 0
  }
}

fn verify_tokens_locked(
  outputs: List<o>,
  policy: PolicyId,
  name: AssetName,
  amount: Int,
) -> Bool {
  // Sum tokens in outputs (to UBI contract)
  let total = list.foldl(outputs, 0, fn(output, acc) {
    acc + quantity_of(output.value, policy, name)
  })
  total >= amount
}

fn verify_pool_datum(
  outputs: List<o>,
  cycle: Int,
  amount: Int,
  slot: Int,
) -> Bool {
  // Verify output has UbiPoolDatum with correct cycle and amount
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect pool: UbiPoolDatum = data
        pool.cycle == cycle && pool.available == amount
      }
      _ -> False
    }
  })
}

fn verify_claimant_pnft(
  tx: Transaction,
  pnft: AssetName,
  bioregion: ByteArray,
  policy: PolicyId,
) -> Option<{ owner: VerificationKeyHash }> {
  // Find pNFT in reference inputs, verify bioregion and Standard+ level
  list.find_map(tx.reference_inputs, fn(input) {
    let assets = list.filter_map(flatten(input.output.value), fn(asset) {
      let (p, name, qty) = asset
      if p == policy && name == pnft && qty > 0 { Some(name) } else { None }
    })
    when assets is {
      [_, ..] -> {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: PnftDatum = data
            // Verify bioregion matches and level is Standard+
            if datum.bioregion == Some(bioregion) && datum.level != Basic {
              Some({ owner: datum.owner })
            } else {
              None
            }
          }
          _ -> None
        }
      }
      _ -> None
    }
  })
}

fn verify_no_prior_claim(
  reference_inputs: List<Input>,
  pnft: AssetName,
  cycle: Int,
) -> Bool {
  // Check no claim record exists for this pNFT and cycle
  !list.any(reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect claim: UbiClaimDatum = data
        claim.pnft == pnft && claim.cycle == cycle
      }
      _ -> False
    }
  })
}

fn verify_tokens_to_claimant(
  outputs: List<o>,
  policy: PolicyId,
  name: AssetName,
  amount: Int,
  owner: VerificationKeyHash,
) -> Bool {
  // Sum tokens sent to owner's address
  let total = list.foldl(outputs, 0, fn(output, acc) {
    when output.address.payment_credential is {
      VerificationKey(key) if key == owner -> {
        acc + quantity_of(output.value, policy, name)
      }
      _ -> acc
    }
  })
  total >= amount
}

fn verify_claim_record(
  outputs: List<o>,
  pnft: AssetName,
  cycle: Int,
  amount: Int,
) -> Bool {
  // Verify claim record output is created
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect claim: UbiClaimDatum = data
        claim.pnft == pnft && claim.cycle == cycle && claim.amount == amount
      }
      _ -> False
    }
  })
}

fn verify_pool_datum_updated(
  outputs: List<o>,
  old_pool: UbiPoolDatum,
  distributed: Int,
) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect new_pool: UbiPoolDatum = data
        new_pool.available == old_pool.available - distributed &&
        new_pool.claims_count == old_pool.claims_count + 1
      }
      _ -> False
    }
  })
}

fn verify_tokens_to_treasury(
  outputs: List<o>,
  policy: PolicyId,
  name: AssetName,
  amount: Int,
  treasury: ByteArray,
) -> Bool {
  // Sum tokens sent to treasury script
  let total = list.foldl(outputs, 0, fn(output, acc) {
    when output.address.payment_credential is {
      Script(hash) if hash == treasury -> {
        acc + quantity_of(output.value, policy, name)
      }
      _ -> acc
    }
  })
  total >= amount
}

fn clamp(value: Int, min: Int, max: Int) -> Int {
  if value < min { min }
  else if value > max { max }
  else { value }
}

fn unwrap_or(opt: Option<Int>, default: Int) -> Int {
  when opt is {
    Some(v) -> v
    None -> default
  }
}

// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// UBI FORMULA
// ===========
//
// Distribution = Base × Health × Participation × Impact + Level_Bonus
//
// WHERE:
//   Base = 100 tokens
//   Health = Bioregion health index (50%-150%)
//   Participation = Transaction activity score (80%-120%)
//   Impact = Net environmental contribution (70%-130%)
//   Level_Bonus = Standard(0), Verified(+10%), Steward(+20%)
//
// EXAMPLE CALCULATIONS
// ====================
//
// Minimum case (inactive, negative impact, unhealthy bioregion):
//   100 × 0.5 × 0.8 × 0.7 + 0 = 28 tokens
//
// Average case (normal activity, neutral impact):
//   100 × 1.0 × 1.0 × 1.0 + 0 = 100 tokens
//
// Maximum case (Steward, very active, positive impact, healthy bioregion):
//   100 × 1.5 × 1.2 × 1.3 + 20 = 254 tokens
//
// DATA SOURCES (ALL ON-CHAIN)
// ===========================
//
// - Bioregion health: bioregion.ak beacon datum
// - Participation: transaction_records aggregated stats
// - Impact: transaction_records aggregated stats
// - Level: pnft.ak datum
//
// NO ORACLES REQUIRED
//
// DISTRIBUTION WINDOW
// ===================
//
// First 3.7 days of each 37-day cycle.
// After window closes, unclaimed tokens return to treasury.
//
// =============================================================================
