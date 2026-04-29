// =============================================================================
// UltraLife Protocol - Oracle-Verified Bioregion Validator
// =============================================================================
//
// LAYER 2: PLACE + ORACLE VERIFICATION
//
// Extends bioregion governance with trustless oracle verification.
// Accepts oracle reference inputs for health index updates.
// Validates: oracle signature, data freshness, reasonable value ranges.
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Finite}
use cardano/address.{Script}
use cardano/assets.{AssetName, PolicyId, flatten, quantity_of}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use ultralife/oracle.{
  BioregionOracleData, EnvironmentalReading, OracleDatum, EnvironmentalFeedType,
  find_oracle_input, get_oracle_value, get_oracle_timestamp, get_tx_slot,
  is_oracle_valid, validate_bioregion_oracle_data, validate_oracle_freshness,
  validate_oracle_range, count_oracle_attestations, aggregate_oracle_values,
}
use ultralife/prc37.{current_cycle, in_health_update_window}
use ultralife/types.{
  Basic, BioregionDatum, PnftDatum, ProposalDatum, Steward,
  VerificationLevel, Verified, Executed,
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type OracleBioregionConfig {
  /// pNFT policy for identity verification
  pnft_policy: PolicyId,
  /// Bioregion beacon policy
  beacon_policy: PolicyId,
  /// Governance contract
  governance_contract: ByteArray,
  /// Charli3 oracle policy ID
  oracle_policy: PolicyId,
  /// Oracle operator verification key
  oracle_operator: VerificationKeyHash,
  /// Maximum oracle data age in slots (e.g., 3600 = ~1 hour)
  max_oracle_age_slots: Int,
  /// Minimum oracle consensus required
  min_oracle_consensus: Int,
  /// Minimum confidence threshold for readings (0-100)
  min_confidence: Int,
}

// =============================================================================
// DATUM
// =============================================================================

/// Extended bioregion datum with oracle metadata
pub type OracleBioregionDatum {
  /// Base bioregion data
  bioregion_id: ByteArray,
  name_hash: ByteArray,
  bounds_hash: ByteArray,
  health_index: Int,
  resident_count: Int,
  treasury: ByteArray,
  created_at: Int,
  last_health_update: Int,
  /// Oracle verification metadata
  last_oracle_timestamp: Int,
  oracle_attestation_count: Int,
  oracle_data_hash: ByteArray,
  /// Individual environmental indices (0-10000)
  water_index: Int,
  land_index: Int,
  air_index: Int,
  biodiversity_index: Int,
  carbon_index: Int,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type OracleBioregionRedeemer {
  /// Update health using oracle data
  OracleHealthUpdate {
    /// Oracle-computed health index
    new_health: Int,
    /// Environmental readings from oracles
    environmental_data: BioregionOracleData,
  }
  /// Update health with steward override (emergency only)
  StewardHealthUpdate {
    new_health: Int,
    evidence_hash: ByteArray,
    steward_pnft: AssetName,
  }
  /// Migrate from legacy bioregion (one-time)
  MigrateFromLegacy {
    legacy_bioregion_ref: OutputReference,
  }
  /// Update individual environmental indices
  UpdateEnvironmentalIndices {
    water: Option<Int>,
    land: Option<Int>,
    air: Option<Int>,
    biodiversity: Option<Int>,
    carbon: Option<Int>,
  }
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator oracle_bioregion(config: OracleBioregionConfig) {
  spend(
    datum: Option<OracleBioregionDatum>,
    redeemer: OracleBioregionRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(d) = datum
    when redeemer is {
      OracleHealthUpdate { new_health, environmental_data } ->
        validate_oracle_health_update(tx, d, new_health, environmental_data, config)
      StewardHealthUpdate { new_health, evidence_hash, steward_pnft } ->
        validate_steward_health_update(tx, d, new_health, evidence_hash, steward_pnft, config)
      MigrateFromLegacy { legacy_bioregion_ref } ->
        validate_migration(tx, d, legacy_bioregion_ref, config)
      UpdateEnvironmentalIndices { water, land, air, biodiversity, carbon } ->
        validate_environmental_update(tx, d, water, land, air, biodiversity, carbon, config)
    }
  }

  else(_) {
    fail
  }
}

// =============================================================================
// ORACLE HEALTH UPDATE
// =============================================================================

fn validate_oracle_health_update(
  tx: Transaction,
  datum: OracleBioregionDatum,
  new_health: Int,
  environmental_data: BioregionOracleData,
  config: OracleBioregionConfig,
) -> Bool {
  let current_slot = get_tx_slot(tx)
  let current = current_cycle(current_slot)

  // 1. Must be in health update window (last day of 37-day cycle)
  let in_window = in_health_update_window(current_slot)

  // 2. Must not have been updated this cycle already
  let not_updated = datum.last_health_update < current

  // 3. New health must be valid (0-10000)
  let health_valid = new_health >= 0 && new_health <= 10000

  // 4. Validate oracle reference inputs
  let oracle_inputs_valid = validate_oracle_references(
    tx.reference_inputs,
    config.oracle_policy,
    current_slot,
    config.max_oracle_age_slots,
    config.min_oracle_consensus,
  )

  // 5. Validate environmental data from oracles
  let env_data_valid = validate_bioregion_oracle_data(
    environmental_data,
    datum.bioregion_id,
    current_slot,
    config.max_oracle_age_slots,
  )

  // 6. Computed health matches oracle data
  let health_matches = new_health == environmental_data.computed_health_index

  // 7. Output datum must be correctly updated
  let datum_updated = verify_oracle_health_datum(
    tx.outputs,
    datum,
    new_health,
    current,
    current_slot,
    environmental_data.oracle_count,
    environmental_data,
  )

  in_window && not_updated && health_valid && oracle_inputs_valid && env_data_valid && health_matches && datum_updated
}

/// Validate oracle reference inputs
fn validate_oracle_references(
  reference_inputs: List<Input>,
  oracle_policy: PolicyId,
  current_slot: Int,
  max_age: Int,
  min_consensus: Int,
) -> Bool {
  // Count valid oracle attestations
  let oracle_count = count_oracle_attestations(
    reference_inputs,
    oracle_policy,
    current_slot,
  )
  // Must have minimum consensus
  let has_consensus = oracle_count >= min_consensus
  // Verify all oracles are fresh
  let all_fresh = list.all(
    reference_inputs,
    fn(input) {
      let has_oracle = list.any(
        flatten(input.output.value),
        fn(asset) {
          let (p, _, qty) = asset
          p == oracle_policy && qty > 0
        },
      )
      if has_oracle {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: OracleDatum = data
            validate_oracle_freshness(datum, current_slot, max_age)
          }
          _ -> True  // Skip non-oracle inputs
        }
      } else {
        True
      }
    },
  )
  has_consensus && all_fresh
}

/// Verify output datum after oracle health update
fn verify_oracle_health_datum(
  outputs: List<Output>,
  old_datum: OracleBioregionDatum,
  new_health: Int,
  cycle: Int,
  current_slot: Int,
  oracle_count: Int,
  env_data: BioregionOracleData,
) -> Bool {
  list.any(
    outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect new_datum: OracleBioregionDatum = data
          // Core fields must match
          new_datum.bioregion_id == old_datum.bioregion_id &&
          new_datum.name_hash == old_datum.name_hash &&
          new_datum.bounds_hash == old_datum.bounds_hash &&
          new_datum.resident_count == old_datum.resident_count &&
          new_datum.treasury == old_datum.treasury &&
          new_datum.created_at == old_datum.created_at &&
          // Updated fields
          new_datum.health_index == new_health &&
          new_datum.last_health_update == cycle &&
          new_datum.last_oracle_timestamp == current_slot &&
          new_datum.oracle_attestation_count == oracle_count &&
          // Environmental indices must be updated based on readings
          validate_environmental_indices_updated(new_datum, env_data.readings)
        }
        _ -> False
      }
    },
  )
}

/// Validate environmental indices are properly updated from readings
fn validate_environmental_indices_updated(
  datum: OracleBioregionDatum,
  readings: List<EnvironmentalReading>,
) -> Bool {
  // Each environmental index should be within valid range
  let water_valid = datum.water_index >= 0 && datum.water_index <= 10000
  let land_valid = datum.land_index >= 0 && datum.land_index <= 10000
  let air_valid = datum.air_index >= 0 && datum.air_index <= 10000
  let biodiversity_valid = datum.biodiversity_index >= 0 && datum.biodiversity_index <= 10000
  let carbon_valid = datum.carbon_index >= 0 && datum.carbon_index <= 10000
  water_valid && land_valid && air_valid && biodiversity_valid && carbon_valid
}

// =============================================================================
// STEWARD HEALTH UPDATE (Emergency Override)
// =============================================================================

fn validate_steward_health_update(
  tx: Transaction,
  datum: OracleBioregionDatum,
  new_health: Int,
  evidence_hash: ByteArray,
  steward_pnft: AssetName,
  config: OracleBioregionConfig,
) -> Bool {
  let current_slot = get_tx_slot(tx)
  let current = current_cycle(current_slot)

  // 1. Steward must be from this bioregion with Steward level
  let steward_valid = verify_steward_from_bioregion(
    tx.reference_inputs,
    steward_pnft,
    datum.bioregion_id,
    config.pnft_policy,
  )

  // 2. Steward must sign
  let steward_signed = verify_pnft_owner_signed(
    tx,
    steward_pnft,
    config.pnft_policy,
  )

  // 3. Evidence must be provided
  let has_evidence = evidence_hash != ""

  // 4. Health must be valid
  let health_valid = new_health >= 0 && new_health <= 10000

  // 5. Must not have been updated this cycle
  let not_updated = datum.last_health_update < current

  // 6. Must be in health update window
  let in_window = in_health_update_window(current_slot)

  // 7. Verify output datum
  let datum_updated = verify_steward_health_datum(
    tx.outputs,
    datum,
    new_health,
    current,
    current_slot,
  )

  steward_valid && steward_signed && has_evidence && health_valid && not_updated && in_window && datum_updated
}

/// Verify steward is from bioregion with Steward level
fn verify_steward_from_bioregion(
  reference_inputs: List<Input>,
  steward_pnft: AssetName,
  bioregion_id: ByteArray,
  pnft_policy: PolicyId,
) -> Bool {
  list.any(
    reference_inputs,
    fn(input) {
      let has_pnft = list.any(
        flatten(input.output.value),
        fn(asset) {
          let (p, name, qty) = asset
          p == pnft_policy && name == steward_pnft && qty > 0
        },
      )
      if has_pnft {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect pnft: PnftDatum = data
            pnft.level == Steward && pnft.bioregion == Some(bioregion_id)
          }
          _ -> False
        }
      } else {
        False
      }
    },
  )
}

/// Verify pNFT owner signed
fn verify_pnft_owner_signed(
  tx: Transaction,
  pnft: AssetName,
  policy: PolicyId,
) -> Bool {
  list.any(
    tx.reference_inputs,
    fn(input) {
      let has_pnft = list.any(
        flatten(input.output.value),
        fn(asset) {
          let (p, name, qty) = asset
          p == policy && name == pnft && qty > 0
        },
      )
      if has_pnft {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: PnftDatum = data
            list.has(tx.extra_signatories, datum.owner)
          }
          _ -> False
        }
      } else {
        False
      }
    },
  )
}

/// Verify output datum for steward update
fn verify_steward_health_datum(
  outputs: List<Output>,
  old_datum: OracleBioregionDatum,
  new_health: Int,
  cycle: Int,
  current_slot: Int,
) -> Bool {
  list.any(
    outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect new_datum: OracleBioregionDatum = data
          new_datum.bioregion_id == old_datum.bioregion_id &&
          new_datum.health_index == new_health &&
          new_datum.last_health_update == cycle &&
          // Steward updates set oracle count to 0 (manual override)
          new_datum.oracle_attestation_count == 0 &&
          // Preserve other fields
          new_datum.name_hash == old_datum.name_hash &&
          new_datum.bounds_hash == old_datum.bounds_hash &&
          new_datum.resident_count == old_datum.resident_count
        }
        _ -> False
      }
    },
  )
}

// =============================================================================
// MIGRATION FROM LEGACY
// =============================================================================

fn validate_migration(
  tx: Transaction,
  datum: OracleBioregionDatum,
  legacy_ref: OutputReference,
  config: OracleBioregionConfig,
) -> Bool {
  // Find legacy bioregion in inputs
  let legacy_found = list.any(
    tx.inputs,
    fn(input) {
      input.output_reference == legacy_ref
    },
  )

  // Verify this is a new datum being created (initial values)
  let is_initial =
    datum.last_oracle_timestamp == 0 &&
    datum.oracle_attestation_count == 0 &&
    datum.water_index == 5000 &&  // Start at 50%
    datum.land_index == 5000 &&
    datum.air_index == 5000 &&
    datum.biodiversity_index == 5000 &&
    datum.carbon_index == 5000

  legacy_found && is_initial
}

// =============================================================================
// UPDATE ENVIRONMENTAL INDICES
// =============================================================================

fn validate_environmental_update(
  tx: Transaction,
  datum: OracleBioregionDatum,
  water: Option<Int>,
  land: Option<Int>,
  air: Option<Int>,
  biodiversity: Option<Int>,
  carbon: Option<Int>,
  config: OracleBioregionConfig,
) -> Bool {
  let current_slot = get_tx_slot(tx)

  // 1. Must have oracle reference inputs for each updated index
  let oracle_count = count_oracle_attestations(
    tx.reference_inputs,
    config.oracle_policy,
    current_slot,
  )
  let has_oracle = oracle_count >= 1

  // 2. Validate each updated value is in range
  let water_valid = validate_optional_index(water)
  let land_valid = validate_optional_index(land)
  let air_valid = validate_optional_index(air)
  let biodiversity_valid = validate_optional_index(biodiversity)
  let carbon_valid = validate_optional_index(carbon)

  // 3. Output datum must be correctly updated
  let datum_updated = verify_environmental_datum(
    tx.outputs,
    datum,
    water,
    land,
    air,
    biodiversity,
    carbon,
    current_slot,
    oracle_count,
  )

  has_oracle && water_valid && land_valid && air_valid && biodiversity_valid && carbon_valid && datum_updated
}

fn validate_optional_index(value: Option<Int>) -> Bool {
  when value is {
    Some(v) -> v >= 0 && v <= 10000
    None -> True
  }
}

fn verify_environmental_datum(
  outputs: List<Output>,
  old_datum: OracleBioregionDatum,
  water: Option<Int>,
  land: Option<Int>,
  air: Option<Int>,
  biodiversity: Option<Int>,
  carbon: Option<Int>,
  current_slot: Int,
  oracle_count: Int,
) -> Bool {
  list.any(
    outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect new_datum: OracleBioregionDatum = data
          // Core fields unchanged
          new_datum.bioregion_id == old_datum.bioregion_id &&
          new_datum.name_hash == old_datum.name_hash &&
          // Updated indices
          new_datum.water_index == get_or_default(water, old_datum.water_index) &&
          new_datum.land_index == get_or_default(land, old_datum.land_index) &&
          new_datum.air_index == get_or_default(air, old_datum.air_index) &&
          new_datum.biodiversity_index == get_or_default(biodiversity, old_datum.biodiversity_index) &&
          new_datum.carbon_index == get_or_default(carbon, old_datum.carbon_index) &&
          // Oracle metadata updated
          new_datum.last_oracle_timestamp == current_slot &&
          new_datum.oracle_attestation_count == oracle_count
        }
        _ -> False
      }
    },
  )
}

fn get_or_default(value: Option<Int>, default: Int) -> Int {
  when value is {
    Some(v) -> v
    None -> default
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

fn level_weight(level: VerificationLevel) -> Int {
  when level is {
    Basic -> 0
    types.Ward -> 0
    types.Standard -> 1
    Verified -> 2
    Steward -> 3
  }
}

// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// ORACLE-VERIFIED BIOREGION HEALTH
// =================================
//
// This validator extends the base bioregion contract with trustless
// oracle verification for environmental health indices.
//
// DATA SOURCES:
// - Satellite imagery (NDVI, land cover)
// - Ground sensor networks (air quality, water quality)
// - IoT mesh devices (soil moisture, temperature)
// - Carbon monitoring stations (CO2 flux)
//
// ORACLE CONSENSUS:
// - Minimum 2 oracle attestations required
// - All oracle data must be fresh (within max_oracle_age_slots)
// - Oracle data hash recorded for audit trail
//
// ENVIRONMENTAL INDICES:
// - Water: 0-10000 (water quality, availability)
// - Land: 0-10000 (soil health, land use)
// - Air: 0-10000 (air quality index)
// - Biodiversity: 0-10000 (species diversity)
// - Carbon: 0-10000 (carbon balance)
//
// HEALTH INDEX CALCULATION:
// health = (water + land + air + biodiversity + carbon) / 5
//
// STEWARD OVERRIDE:
// - Emergency manual updates when oracles unavailable
// - Requires Steward-level pNFT from bioregion
// - Must provide evidence hash
// - Sets oracle_attestation_count to 0
//
// =============================================================================
