// =============================================================================
// UltraLife Protocol — Records
// =============================================================================
//
// Transaction record accumulator.
// Aggregates individual TransactionRecords into:
// - AvatarCycleStats (per-person per-cycle)
// - BioregionCycleStats (per-bioregion per-cycle)
//
// This data drives UBI calculations — pure on-chain.
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId, AssetName, flatten}
use cardano/transaction.{Transaction, Input, Output, OutputReference, InlineDatum}
use ultralife/types.{
  TransactionRecord, AvatarCycleStats, BioregionCycleStats,
  tx_type_code, impact_sign, RecordsDatum, Record, AvatarStats, BioregionStats,
}
use ultralife/prc37.{current_cycle, cycle_end, HEALTH_UPDATE_START}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type RecordsRedeemer {
  /// Record a transaction (called by token validator)
  CreateRecord {
    record: TransactionRecord,
  }
  
  /// Aggregate records into avatar stats
  AggregateAvatar {
    pnft: AssetName,
    cycle: Int,
  }
  
  /// Aggregate avatar stats into bioregion stats
  AggregateBioregion {
    bioregion: ByteArray,
    cycle: Int,
  }
  
  /// Finalize cycle stats (lock for UBI calculations)
  FinalizeCycle {
    cycle: Int,
  }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type RecordsConfig {
  /// Token policy (only token validator can create records)
  token_policy: PolicyId,
  /// pNFT policy
  pnft_policy: PolicyId,
  /// Bioregion policy
  bioregion_policy: PolicyId,
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator records(config: RecordsConfig) {
  spend(
    datum: Option<RecordsDatum>,
    redeemer: RecordsRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      CreateRecord { record } -> {
        validate_create_record(tx, record, config)
      }
      
      AggregateAvatar { pnft, cycle } -> {
        validate_aggregate_avatar(tx, pnft, cycle, config)
      }
      
      AggregateBioregion { bioregion, cycle } -> {
        validate_aggregate_bioregion(tx, bioregion, cycle, config)
      }
      
      FinalizeCycle { cycle } -> {
        validate_finalize_cycle(tx, cycle, config)
      }
    }
  }
}

// =============================================================================
// DATUM TYPES
// =============================================================================

pub type RecordsDatum {
  /// Individual transaction record
  Record(TransactionRecord)
  /// Aggregated avatar stats
  AvatarStats(AvatarCycleStats)
  /// Aggregated bioregion stats
  BioregionStats(BioregionCycleStats)
}

// =============================================================================
// CREATE RECORD
// =============================================================================

fn validate_create_record(
  tx: Transaction,
  record: TransactionRecord,
  config: RecordsConfig,
) -> Bool {
  // 1. Must be called from token spend (verify token validator is being executed)
  let from_token_spend = verify_token_spend(tx, config.token_policy)
  
  // 2. Record slot must match transaction
  let current_slot = get_slot(tx)
  let slot_valid = record.slot == current_slot
  
  // 3. Record cycle must be correct
  let expected_cycle = current_cycle(current_slot)
  let cycle_valid = record.cycle == expected_cycle
  
  // 4. Record datum output created
  let record_created = verify_record_output(tx.outputs, record)
  
  from_token_spend && slot_valid && cycle_valid && record_created
}

// =============================================================================
// AGGREGATE AVATAR STATS
// =============================================================================

fn validate_aggregate_avatar(
  tx: Transaction,
  pnft: AssetName,
  cycle: Int,
  config: RecordsConfig,
) -> Bool {
  // Anyone can trigger aggregation (permissionless)
  
  // 1. Find all TransactionRecords for this pnft and cycle in inputs
  let records = find_avatar_records(tx.inputs, pnft, cycle)
  
  // 2. Calculate aggregated stats
  let stats = calculate_avatar_stats(records, pnft, cycle)
  
  // 3. Verify stats output created
  let stats_created = verify_avatar_stats_output(tx.outputs, stats)
  
  // 4. All consumed records must be from this pnft and cycle
  let records_valid = verify_records_match(records, pnft, cycle)
  
  stats_created && records_valid
}

fn calculate_avatar_stats(
  records: List<TransactionRecord>,
  pnft: AssetName,
  cycle: Int,
) -> AvatarCycleStats {
  list.foldl(records, initial_avatar_stats(pnft, cycle), fn(record, acc) {
    // Count transactions
    let tx_sent = if record.sender == pnft { acc.tx_sent + 1 } else { acc.tx_sent }
    let tx_received = if record.recipient == pnft { acc.tx_received + 1 } else { acc.tx_received }
    
    // Track volume
    let volume_sent = if record.sender == pnft { acc.volume_sent + record.amount } else { acc.volume_sent }
    let volume_received = if record.recipient == pnft { acc.volume_received + record.amount } else { acc.volume_received }
    
    // Count by type (using tx_type_code)
    let labor_count = if record.tx_type == 0 && record.sender == pnft { acc.labor_count + 1 } else { acc.labor_count }
    let goods_count = if record.tx_type == 1 { acc.goods_count + 1 } else { acc.goods_count }
    let services_count = if record.tx_type == 2 { acc.services_count + 1 } else { acc.services_count }
    let gift_count = if record.tx_type == 3 { acc.gift_count + 1 } else { acc.gift_count }
    let remediation_count = if record.tx_type == 5 { acc.remediation_count + 1 } else { acc.remediation_count }
    
    // Calculate net impact
    let impact_delta = record.impact_sign * record.impact_magnitude
    let net_impact = acc.net_impact + impact_delta
    
    AvatarCycleStats {
      pnft: pnft,
      cycle: cycle,
      tx_sent: tx_sent,
      tx_received: tx_received,
      volume_sent: volume_sent,
      volume_received: volume_received,
      labor_count: labor_count,
      goods_count: goods_count,
      services_count: services_count,
      gift_count: gift_count,
      remediation_count: remediation_count,
      net_impact: net_impact,
      finalized: False,
    }
  })
}

fn initial_avatar_stats(pnft: AssetName, cycle: Int) -> AvatarCycleStats {
  AvatarCycleStats {
    pnft: pnft,
    cycle: cycle,
    tx_sent: 0,
    tx_received: 0,
    volume_sent: 0,
    volume_received: 0,
    labor_count: 0,
    goods_count: 0,
    services_count: 0,
    gift_count: 0,
    remediation_count: 0,
    net_impact: 0,
    finalized: False,
  }
}

// =============================================================================
// AGGREGATE BIOREGION STATS
// =============================================================================

fn validate_aggregate_bioregion(
  tx: Transaction,
  bioregion: ByteArray,
  cycle: Int,
  config: RecordsConfig,
) -> Bool {
  // 1. Find all AvatarCycleStats for this bioregion and cycle
  let avatar_stats = find_bioregion_avatar_stats(tx.inputs, bioregion, cycle)
  
  // 2. Calculate bioregion aggregates
  let stats = calculate_bioregion_stats(avatar_stats, bioregion, cycle)
  
  // 3. Verify stats output created
  let stats_created = verify_bioregion_stats_output(tx.outputs, stats)
  
  stats_created
}

fn calculate_bioregion_stats(
  avatar_stats: List<AvatarCycleStats>,
  bioregion: ByteArray,
  cycle: Int,
) -> BioregionCycleStats {
  list.foldl(avatar_stats, initial_bioregion_stats(bioregion, cycle), fn(avatar, acc) {
    BioregionCycleStats {
      bioregion: bioregion,
      cycle: cycle,
      total_transactions: acc.total_transactions + avatar.tx_sent,
      total_volume: acc.total_volume + avatar.volume_sent,
      active_avatars: acc.active_avatars + 1,
      labor_transactions: acc.labor_transactions + avatar.labor_count,
      net_impact: acc.net_impact + avatar.net_impact,
      finalized: False,
    }
  })
}

fn initial_bioregion_stats(bioregion: ByteArray, cycle: Int) -> BioregionCycleStats {
  BioregionCycleStats {
    bioregion: bioregion,
    cycle: cycle,
    total_transactions: 0,
    total_volume: 0,
    active_avatars: 0,
    labor_transactions: 0,
    net_impact: 0,
    finalized: False,
  }
}

// =============================================================================
// FINALIZE CYCLE
// =============================================================================

fn validate_finalize_cycle(
  tx: Transaction,
  cycle: Int,
  config: RecordsConfig,
) -> Bool {
  // 1. Must be after cycle end
  let current_slot = get_slot(tx)
  let end = cycle_end(cycle)
  let after_cycle = current_slot > end
  
  // 2. Stats must be marked finalized
  let stats_finalized = verify_stats_finalized(tx.outputs, cycle)
  
  after_cycle && stats_finalized
}

// =============================================================================
// HELPERS
// =============================================================================

fn get_slot(tx: Transaction) -> Int {
  when tx.validity_range.lower_bound.bound_type is {
    Finite(slot) -> slot
    _ -> 0
  }
}

fn verify_token_spend(tx: Transaction, policy: PolicyId) -> Bool {
  // Verify token is being spent in this transaction
  list.any(tx.inputs, fn(input) {
    list.any(flatten(input.output.value), fn(asset) {
      let (p, _, qty) = asset
      p == policy && qty > 0
    })
  })
}

fn verify_record_output(outputs: List<o>, record: TransactionRecord) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: RecordsDatum = data
        when datum is {
          Record(r) -> r == record
          _ -> False
        }
      }
      _ -> False
    }
  })
}

fn find_avatar_records(inputs: List<Input>, pnft: AssetName, cycle: Int) -> List<TransactionRecord> {
  list.filter_map(inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect datum: RecordsDatum = data
        when datum is {
          Record(r) -> {
            if (r.sender == pnft || r.recipient == pnft) && r.cycle == cycle {
              Some(r)
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

fn verify_records_match(records: List<TransactionRecord>, pnft: AssetName, cycle: Int) -> Bool {
  list.all(records, fn(r) { (r.sender == pnft || r.recipient == pnft) && r.cycle == cycle })
}

fn verify_avatar_stats_output(outputs: List<o>, stats: AvatarCycleStats) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: RecordsDatum = data
        when datum is {
          AvatarStats(s) -> s == stats
          _ -> False
        }
      }
      _ -> False
    }
  })
}

fn find_bioregion_avatar_stats(inputs: List<Input>, bioregion: ByteArray, cycle: Int) -> List<AvatarCycleStats> {
  // Filter avatar stats for this bioregion and cycle
  list.filter_map(inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect datum: RecordsDatum = data
        when datum is {
          AvatarStats(s) -> {
            if s.bioregion == bioregion && s.cycle == cycle {
              Some(s)
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

fn verify_bioregion_stats_output(outputs: List<o>, stats: BioregionCycleStats) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: RecordsDatum = data
        when datum is {
          BioregionStats(s) -> s == stats
          _ -> False
        }
      }
      _ -> False
    }
  })
}

fn verify_stats_finalized(outputs: List<o>, cycle: Int) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: RecordsDatum = data
        when datum is {
          BioregionStats(s) -> s.cycle == cycle && s.finalized
          _ -> False
        }
      }
      _ -> False
    }
  })
}

// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// DATA FLOW
// =========
//
// 1. Token transaction creates TransactionRecord
// 2. Records aggregated into AvatarCycleStats (per-person)
// 3. Avatar stats aggregated into BioregionCycleStats
// 4. Stats finalized at cycle end
// 5. UBI contract reads finalized stats for distribution
//
// AGGREGATION IS PERMISSIONLESS
// =============================
//
// Anyone can trigger aggregation.
// Incentive: aggregators may receive small reward from governance.
// Stats must be finalized before UBI distribution.
//
// ON-CHAIN DATA INTEGRITY
// =======================
//
// No oracles needed — all data from token transactions.
// Stats are deterministically calculated.
// Finalization locks data for UBI calculations.
//
// =============================================================================
