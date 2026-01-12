// =============================================================================
// UltraLife Protocol — Bioregion
// =============================================================================
//
// LAYER 2: PLACE
//
// Bioregions are ecological boundaries (not political).
// - Required for Standard+ verification
// - Health index affects UBI distribution
// - Local governance scope
// - Economic activity is geographically situated
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId, AssetName, Value, quantity_of, flatten}
use cardano/transaction.{Transaction, Input, Output, OutputReference, InlineDatum}
use ultralife/types.{BioregionDatum, PnftDatum, ProposalDatum, ProposalStatus, Executed, VerificationLevel, Basic, Ward, Standard, Verified, Steward}
use ultralife/prc37.{current_cycle, in_health_update_window}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type BioregionConfig {
  /// pNFT policy for identity verification
  pnft_policy: PolicyId,
  /// Bioregion beacon policy
  beacon_policy: PolicyId,
  /// Governance contract
  governance_contract: ByteArray,
  /// Minimum residents to form bioregion
  min_residents: Int,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type BioregionRedeemer {
  /// Register a new bioregion
  CreateBioregion {
    bioregion_id: ByteArray,
    name_hash: ByteArray,
    bounds_hash: ByteArray,
    founding_residents: List<AssetName>,
  }
  
  /// Register residency in a bioregion
  RegisterResidency {
    pnft: AssetName,
  }
  
  /// Transfer residency to different bioregion
  TransferResidency {
    pnft: AssetName,
    new_bioregion: ByteArray,
  }
  
  /// Update bioregion health index (37-day cycle)
  UpdateHealth {
    new_health: Int,
    evidence_hash: ByteArray,
  }
  
  /// Update bioregion metadata (governance approved)
  UpdateMetadata {
    new_bounds_hash: Option<ByteArray>,
    new_name_hash: Option<ByteArray>,
    governance_approval: ByteArray,
  }
}

// =============================================================================
// BEACON MINTING POLICY
// =============================================================================

validator bioregion_beacon(config: BioregionConfig) {
  mint(redeemer: BioregionRedeemer, policy_id: PolicyId, tx: Transaction) {
    when redeemer is {
      CreateBioregion { bioregion_id, name_hash, bounds_hash, founding_residents } -> {
        // 1. Must have minimum founding residents
        let enough_founders = list.length(founding_residents) >= config.min_residents
        
        // 2. All founders must have Verified+ pNFTs
        let founders_valid = verify_founders(
          tx.reference_inputs,
          founding_residents,
          config.pnft_policy,
        )
        
        // 3. Mint exactly one beacon token
        let mint_correct = verify_beacon_mint(tx.mint, policy_id, bioregion_id)
        
        // 4. Output must have correct datum
        let datum_correct = verify_create_datum(
          tx.outputs,
          policy_id,
          bioregion_id,
          name_hash,
          bounds_hash,
          list.length(founding_residents),
          tx,
        )
        
        enough_founders && founders_valid && mint_correct && datum_correct
      }
      
      _ -> False  // Other actions don't mint beacons
    }
  }
}

// =============================================================================
// BIOREGION VALIDATOR
// =============================================================================

validator bioregion(config: BioregionConfig) {
  spend(
    datum: Option<BioregionDatum>,
    redeemer: BioregionRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(d) = datum
    
    when redeemer is {
      CreateBioregion { .. } -> {
        // Handled by beacon minting policy
        False
      }
      
      RegisterResidency { pnft } -> {
        validate_register_residency(tx, d, pnft, config)
      }
      
      TransferResidency { pnft, new_bioregion } -> {
        validate_transfer_residency(tx, d, pnft, new_bioregion, config)
      }
      
      UpdateHealth { new_health, evidence_hash } -> {
        validate_update_health(tx, d, new_health, evidence_hash, config)
      }
      
      UpdateMetadata { new_bounds_hash, new_name_hash, governance_approval } -> {
        validate_update_metadata(tx, d, new_bounds_hash, new_name_hash, governance_approval, config)
      }
    }
  }
}

// =============================================================================
// REGISTER RESIDENCY
// =============================================================================

fn validate_register_residency(
  tx: Transaction,
  datum: BioregionDatum,
  pnft: AssetName,
  config: BioregionConfig,
) -> Bool {
  // 1. pNFT must be in transaction (reference input OK)
  let pnft_present = find_pnft_reference(tx, pnft, config.pnft_policy)
  expect Some(pnft_data) = pnft_present
  
  // 2. pNFT must be Standard level (upgrading to Verified)
  // Or already Verified/Steward (changing bioregion handled by TransferResidency)
  
  // 3. pNFT owner must sign
  let owner_signed = list.has(tx.extra_signatories, pnft_data.owner)
  
  // 4. Output datum must increment resident_count
  let datum_updated = verify_residency_datum(tx.outputs, datum)
  
  // 5. Residency record must be created (separate UTXO)
  let record_created = verify_residency_record(tx.outputs, pnft, datum.bioregion_id)
  
  owner_signed && datum_updated && record_created
}

fn verify_residency_datum(outputs: List<o>, old_datum: BioregionDatum) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect new_datum: BioregionDatum = data
        new_datum.bioregion_id == old_datum.bioregion_id &&
        new_datum.resident_count == old_datum.resident_count + 1 &&
        // All other fields unchanged
        new_datum.health_index == old_datum.health_index &&
        new_datum.name_hash == old_datum.name_hash &&
        new_datum.bounds_hash == old_datum.bounds_hash
      }
      _ -> False
    }
  })
}

fn verify_residency_record(
  outputs: List<o>,
  pnft: AssetName,
  bioregion_id: ByteArray,
) -> Bool {
  // Residency record links pNFT to bioregion
  // Verify an output exists with residency record datum
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        // Residency record should have pNFT and bioregion
        expect record: { pnft: AssetName, bioregion: ByteArray } = data
        record.pnft == pnft && record.bioregion == bioregion_id
      }
      _ -> False
    }
  })
}

// =============================================================================
// TRANSFER RESIDENCY
// =============================================================================

fn validate_transfer_residency(
  tx: Transaction,
  datum: BioregionDatum,
  pnft: AssetName,
  new_bioregion: ByteArray,
  config: BioregionConfig,
) -> Bool {
  // 1. pNFT must currently be resident in THIS bioregion
  let pnft_present = find_pnft_reference(tx, pnft, config.pnft_policy)
  expect Some(pnft_data) = pnft_present
  expect pnft_data.bioregion == Some(datum.bioregion_id)
  
  // 2. Owner must sign
  let owner_signed = list.has(tx.extra_signatories, pnft_data.owner)
  
  // 3. This bioregion's datum decrements resident_count
  let from_updated = verify_transfer_from_datum(tx.outputs, datum)
  
  // 4. New bioregion's datum increments resident_count
  // This requires the new bioregion UTXO to also be in the transaction
  let to_updated = verify_transfer_to_datum(tx.outputs, new_bioregion)
  
  owner_signed && from_updated && to_updated
}

fn verify_transfer_from_datum(outputs: List<o>, old_datum: BioregionDatum) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect new_datum: BioregionDatum = data
        new_datum.bioregion_id == old_datum.bioregion_id &&
        new_datum.resident_count == old_datum.resident_count - 1
      }
      _ -> False
    }
  })
}

fn verify_transfer_to_datum(outputs: List<o>, bioregion_id: ByteArray) -> Bool {
  // Find the destination bioregion output and verify it exists
  // The increment is validated by the destination bioregion's validator
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: BioregionDatum = data
        datum.bioregion_id == bioregion_id
      }
      _ -> False
    }
  })
}

// =============================================================================
// UPDATE HEALTH
// =============================================================================

fn validate_update_health(
  tx: Transaction,
  datum: BioregionDatum,
  new_health: Int,
  evidence_hash: ByteArray,
  config: BioregionConfig,
) -> Bool {
  // Health updates happen in the last day of each 37-day cycle
  
  // 1. Must be in health update window
  let current_slot = get_current_slot(tx)
  let in_window = in_health_update_window(current_slot)
  
  // 2. New health must be valid (0-10000)
  let health_valid = new_health >= 0 && new_health <= 10000
  
  // 3. Must not have been updated this cycle already
  let current = current_cycle(current_slot)
  let not_updated = datum.last_health_update < current
  
  // 4. Evidence must be provided (environmental metrics hash)
  let has_evidence = evidence_hash != ""
  
  // 5. Must have Steward signatures from this bioregion
  let steward_approved = verify_steward_approval(
    tx,
    datum.bioregion_id,
    config.pnft_policy,
  )
  
  // 6. Output datum must be updated
  let datum_updated = verify_health_datum(tx.outputs, datum, new_health, current)
  
  in_window && health_valid && not_updated && has_evidence && 
  steward_approved && datum_updated
}

fn verify_health_datum(
  outputs: List<o>,
  old_datum: BioregionDatum,
  new_health: Int,
  cycle: Int,
) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect new_datum: BioregionDatum = data
        new_datum.bioregion_id == old_datum.bioregion_id &&
        new_datum.health_index == new_health &&
        new_datum.last_health_update == cycle &&
        // Other fields unchanged
        new_datum.resident_count == old_datum.resident_count
      }
      _ -> False
    }
  })
}

// =============================================================================
// UPDATE METADATA
// =============================================================================

fn validate_update_metadata(
  tx: Transaction,
  datum: BioregionDatum,
  new_bounds_hash: Option<ByteArray>,
  new_name_hash: Option<ByteArray>,
  governance_approval: ByteArray,
  config: BioregionConfig,
) -> Bool {
  // Metadata changes require governance approval
  
  // 1. Verify governance approval (passed proposal)
  let gov_valid = verify_governance_approval(
    tx.reference_inputs,
    governance_approval,
    datum.bioregion_id,
    config.governance_contract,
  )
  
  // 2. Update datum with new values
  let bounds = when new_bounds_hash is {
    Some(h) -> h
    None -> datum.bounds_hash
  }
  
  let name = when new_name_hash is {
    Some(h) -> h
    None -> datum.name_hash
  }
  
  let datum_updated = verify_metadata_datum(tx.outputs, datum, bounds, name)
  
  gov_valid && datum_updated
}

fn verify_metadata_datum(
  outputs: List<o>,
  old_datum: BioregionDatum,
  new_bounds: ByteArray,
  new_name: ByteArray,
) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect new_datum: BioregionDatum = data
        new_datum.bioregion_id == old_datum.bioregion_id &&
        new_datum.bounds_hash == new_bounds &&
        new_datum.name_hash == new_name &&
        // Preserve other fields
        new_datum.health_index == old_datum.health_index &&
        new_datum.resident_count == old_datum.resident_count
      }
      _ -> False
    }
  })
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

fn verify_founders(
  reference_inputs: List<Input>,
  founders: List<AssetName>,
  pnft_policy: PolicyId,
) -> Bool {
  // All founders must have Verified or Steward level pNFTs
  list.all(founders, fn(pnft) {
    verify_pnft_level_min(reference_inputs, pnft, pnft_policy, Verified)
  })
}

fn verify_pnft_level_min(
  reference_inputs: List<Input>,
  pnft: AssetName,
  policy: PolicyId,
  min_level: VerificationLevel,
) -> Bool {
  // Find pNFT in reference inputs and check level meets minimum
  list.any(reference_inputs, fn(input) {
    let has_pnft = list.any(flatten(input.output.value), fn(asset) {
      let (p, name, qty) = asset
      p == policy && name == pnft && qty > 0
    })
    if has_pnft {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          level_weight(datum.level) >= level_weight(min_level)
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

fn level_weight(level: VerificationLevel) -> Int {
  when level is {
    Basic -> 0
    Ward -> 0
    Standard -> 1
    Verified -> 2
    Steward -> 3
  }
}

fn verify_beacon_mint(mint: Value, policy_id: PolicyId, bioregion_id: ByteArray) -> Bool {
  // Verify exactly one beacon minted with bioregion_id as asset name
  let policy_tokens = list.filter_map(flatten(mint), fn(asset) {
    let (p, name, qty) = asset
    if p == policy_id { Some((name, qty)) } else { None }
  })
  when policy_tokens is {
    [(name, qty)] -> name == bioregion_id && qty == 1
    _ -> False
  }
}

fn verify_create_datum(
  outputs: List<o>,
  policy_id: PolicyId,
  bioregion_id: ByteArray,
  name_hash: ByteArray,
  bounds_hash: ByteArray,
  resident_count: Int,
  tx: Transaction,
) -> Bool {
  let current_slot = get_current_slot(tx)
  
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: BioregionDatum = data
        datum.bioregion_id == bioregion_id &&
        datum.name_hash == name_hash &&
        datum.bounds_hash == bounds_hash &&
        datum.health_index == 5000 &&  // Start at 50%
        datum.resident_count == resident_count &&
        datum.created_at == current_slot &&
        datum.last_health_update == 0
      }
      _ -> False
    }
  })
}

fn find_pnft_reference(
  tx: Transaction,
  pnft: AssetName,
  policy: PolicyId,
) -> Option<{ owner: VerificationKeyHash, bioregion: Option<ByteArray> }> {
  // Find pNFT in reference inputs or inputs
  let from_refs = list.find_map(tx.reference_inputs, fn(input) {
    extract_pnft_by_name(input.output, pnft, policy)
  })
  when from_refs is {
    Some(data) -> Some(data)
    None -> list.find_map(tx.inputs, fn(input) {
      extract_pnft_by_name(input.output, pnft, policy)
    })
  }
}

fn extract_pnft_by_name(
  output: Output,
  pnft: AssetName,
  policy: PolicyId,
) -> Option<{ owner: VerificationKeyHash, bioregion: Option<ByteArray> }> {
  let has_token = list.any(flatten(output.value), fn(asset) {
    let (p, name, qty) = asset
    p == policy && name == pnft && qty > 0
  })
  if has_token {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: PnftDatum = data
        Some({ owner: datum.owner, bioregion: datum.bioregion })
      }
      _ -> None
    }
  } else {
    None
  }
}

fn verify_steward_approval(
  tx: Transaction,
  bioregion_id: ByteArray,
  pnft_policy: PolicyId,
) -> Bool {
  // Verify at least one Steward-level pNFT holder in this bioregion signed
  list.any(tx.reference_inputs, fn(input) {
    let has_pnft = list.any(flatten(input.output.value), fn(asset) {
      let (p, _, qty) = asset
      p == pnft_policy && qty > 0
    })
    if has_pnft {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          datum.level == Steward &&
          datum.bioregion == Some(bioregion_id) &&
          list.has(tx.extra_signatories, datum.owner)
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

fn verify_governance_approval(
  reference_inputs: List<Input>,
  approval: ByteArray,
  bioregion_id: ByteArray,
  governance_contract: ByteArray,
) -> Bool {
  // Verify passed governance proposal exists in reference inputs
  list.any(reference_inputs, fn(input) {
    when input.output.address.payment_credential is {
      Script(hash) if hash == governance_contract -> {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect proposal: ProposalDatum = data
            proposal.bioregion == bioregion_id &&
            proposal.status == Executed
          }
          _ -> False
        }
      }
      _ -> False
    }
  })
}

fn get_current_slot(tx: Transaction) -> Int {
  when tx.validity_range.lower_bound.bound_type is {
    Finite(slot) -> slot
    _ -> 0
  }
}

// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// BIOREGIONS
// ==========
//
// Bioregions are ecological boundaries that organize UltraLife:
// - Sierra Nevada, Pacific Northwest, Great Lakes, etc.
// - Defined by watersheds, ecosystems, not political lines
// - Health index reflects environmental state
//
// HEALTH INDEX
// ============
//
// 0-10000 scale (0-100.00%)
// Updated every 37-day cycle
// Based on environmental metrics:
// - Air quality
// - Water quality
// - Biodiversity
// - Carbon balance
// - Soil health
//
// UBI IMPACT
// ==========
//
// UBI distribution is multiplied by bioregion health:
// - 100% health → 1.0x UBI
// - 50% health → 0.5x UBI
// - 150% health → 1.5x UBI (thriving bioregion)
//
// This incentivizes environmental stewardship.
//
// GOVERNANCE SCOPE
// ================
//
// Each bioregion has its own governance:
// - Local proposals
// - Local treasury
// - Local health updates
// - Cross-bioregion coordination through federation
//
// =============================================================================
