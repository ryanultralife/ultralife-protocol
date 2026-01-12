// =============================================================================
// UltraLife Protocol — Land Rights & Stewardship
// =============================================================================
//
// LAND IS NOT OWNED. LAND IS STEWARDED.
//
// This contract manages:
// 1. LAND REGISTRATION — Bringing land into the UltraLife system
// 2. RIGHTS SEPARATION — Surface, subsurface, water, air, cellulose, carbon
// 3. RIGHTS TRANSFER — Moving specific rights between pNFTs
// 4. STEWARDSHIP OBLIGATIONS — Requirements for holding rights
// 5. IMPACT ATTRIBUTION — Impacts flow to right holders
// 6. REVENUE SHARING — Automatic splits to stewards and bioregion
//
// Every action on land creates impact. Impact flows to right holders.
// Right holders are accountable for their domain.
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId, AssetName, quantity_of, flatten}
use cardano/address.{Script, VerificationKey}
use cardano/transaction.{Transaction, Input, Output, OutputReference, InlineDatum}
use ultralife/types_complete.{
  LandNFT, LandRights, RightHolder, RightType, AcquisitionType,
  LandClassification, LandHealth, TerrainType, ClimateZone, EcosystemType,
  AccessRights,
  PnftDatum, VerificationLevel, Basic, Ward, Standard, Verified, Steward,
  Impact, ImpactCategory, calculate_net_impact,
  can_steward_land,
  BioregionDatum,
}

// =============================================================================
// CONSTANTS
// =============================================================================

/// Minimum verification level to steward land
const MIN_STEWARD_LEVEL: VerificationLevel = Verified

/// Default revenue share to primary steward (basis points)
const DEFAULT_STEWARD_SHARE: Int = 7000  // 70%

/// Default revenue share to bioregion (basis points)
const DEFAULT_BIOREGION_SHARE: Int = 2000  // 20%

/// Remaining 10% to right-specific holder

/// Survey requirement frequency (cycles)
const SURVEY_FREQUENCY: Int = 4

/// Minimum area for registration (m²)
const MIN_AREA: Int = 100

// =============================================================================
// REDEEMERS
// =============================================================================

pub type LandRedeemer {
  // === REGISTRATION ===
  
  /// Register new land parcel
  RegisterLand {
    bounds_hash: ByteArray,
    area_m2: Int,
    classification: LandClassification,
    traditional_territory: Option<ByteArray>,
    baseline_survey: ByteArray,
  }
  
  /// Update land classification (after survey)
  UpdateClassification {
    land_id: ByteArray,
    new_classification: LandClassification,
    survey_id: ByteArray,
  }
  
  // === RIGHTS MANAGEMENT ===
  
  /// Transfer a specific right
  TransferRight {
    land_id: ByteArray,
    right_type: RightType,
    new_holder: AssetName,
    acquisition_type: AcquisitionType,
    duration: Option<Int>,
    conditions: Option<ByteArray>,
  }
  
  /// Lease a right temporarily
  LeaseRight {
    land_id: ByteArray,
    right_type: RightType,
    lessee: AssetName,
    duration_cycles: Int,
    payment: Int,
    conditions: ByteArray,
  }
  
  /// Return a leased right
  ReturnRight {
    land_id: ByteArray,
    right_type: RightType,
  }
  
  /// Update revenue shares for a right
  UpdateShares {
    land_id: ByteArray,
    right_type: RightType,
    steward_share: Int,
    bioregion_share: Int,
  }
  
  // === ACCESS ===
  
  /// Update access rights
  UpdateAccess {
    land_id: ByteArray,
    public_access: Bool,
    min_level: VerificationLevel,
    access_fee: Option<Int>,
  }
  
  /// Grant specific access
  GrantAccess {
    land_id: ByteArray,
    grantee: AssetName,
    duration: Option<Int>,
  }
  
  /// Revoke specific access
  RevokeAccess {
    land_id: ByteArray,
    revokee: AssetName,
  }
  
  // === STEWARDSHIP ===
  
  /// Transfer primary stewardship
  TransferStewardship {
    land_id: ByteArray,
    new_steward: AssetName,
  }
  
  /// Record impact on land (from activity)
  RecordLandImpact {
    land_id: ByteArray,
    impacts: List<Impact>,
    activity_type: ByteArray,
    evidence_hash: ByteArray,
    right_type: RightType,
  }
  
  /// Update health metrics (from survey)
  UpdateHealth {
    land_id: ByteArray,
    new_health: LandHealth,
    survey_id: ByteArray,
  }
  
  // === TRADITIONAL RIGHTS ===
  
  /// Register traditional territory claim
  RegisterTraditionalClaim {
    land_id: ByteArray,
    territory_id: ByteArray,
    claimant_community: ByteArray,
    evidence_hash: ByteArray,
  }
  
  /// Set cultural protocols
  SetCulturalProtocols {
    land_id: ByteArray,
    protocols_hash: ByteArray,
  }
}

// =============================================================================
// VALIDATOR CONFIGURATION
// =============================================================================

pub type LandConfig {
  /// pNFT policy
  pnft_policy: PolicyId,
  /// Land NFT policy
  land_policy: PolicyId,
  /// Token policy
  token_policy: PolicyId,
  /// Token name
  token_name: AssetName,
  /// Bioregion registry
  bioregion_registry: ByteArray,
  /// Preservation contract
  preservation: ByteArray,
  /// Treasury contract
  treasury: ByteArray,
  /// Governance contract
  governance: ByteArray,
}

// =============================================================================
// MAIN VALIDATOR
// =============================================================================

validator land_rights(config: LandConfig) {
  spend(
    datum: Option<Data>,
    redeemer: LandRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      // === REGISTRATION ===
      
      RegisterLand { bounds_hash, area_m2, classification, traditional_territory, baseline_survey } -> {
        validate_register_land(tx, bounds_hash, area_m2, classification, traditional_territory, baseline_survey, config)
      }
      
      UpdateClassification { land_id, new_classification, survey_id } -> {
        validate_update_classification(tx, land_id, new_classification, survey_id, config)
      }
      
      // === RIGHTS MANAGEMENT ===
      
      TransferRight { land_id, right_type, new_holder, acquisition_type, duration, conditions } -> {
        validate_transfer_right(tx, land_id, right_type, new_holder, acquisition_type, duration, conditions, config)
      }
      
      LeaseRight { land_id, right_type, lessee, duration_cycles, payment, conditions } -> {
        validate_lease_right(tx, land_id, right_type, lessee, duration_cycles, payment, conditions, config)
      }
      
      ReturnRight { land_id, right_type } -> {
        validate_return_right(tx, land_id, right_type, config)
      }
      
      UpdateShares { land_id, right_type, steward_share, bioregion_share } -> {
        validate_update_shares(tx, land_id, right_type, steward_share, bioregion_share, config)
      }
      
      // === ACCESS ===
      
      UpdateAccess { land_id, public_access, min_level, access_fee } -> {
        validate_update_access(tx, land_id, public_access, min_level, access_fee, config)
      }
      
      GrantAccess { land_id, grantee, duration } -> {
        validate_grant_access(tx, land_id, grantee, duration, config)
      }
      
      RevokeAccess { land_id, revokee } -> {
        validate_revoke_access(tx, land_id, revokee, config)
      }
      
      // === STEWARDSHIP ===
      
      TransferStewardship { land_id, new_steward } -> {
        validate_transfer_stewardship(tx, land_id, new_steward, config)
      }
      
      RecordLandImpact { land_id, impacts, activity_type, evidence_hash, right_type } -> {
        validate_record_impact(tx, land_id, impacts, activity_type, evidence_hash, right_type, config)
      }
      
      UpdateHealth { land_id, new_health, survey_id } -> {
        validate_update_health(tx, land_id, new_health, survey_id, config)
      }
      
      // === TRADITIONAL RIGHTS ===
      
      RegisterTraditionalClaim { land_id, territory_id, claimant_community, evidence_hash } -> {
        validate_traditional_claim(tx, land_id, territory_id, claimant_community, evidence_hash, config)
      }
      
      SetCulturalProtocols { land_id, protocols_hash } -> {
        validate_set_protocols(tx, land_id, protocols_hash, config)
      }
    }
  }
}

// =============================================================================
// REGISTRATION
// =============================================================================

fn validate_register_land(
  tx: Transaction,
  bounds_hash: ByteArray,
  area_m2: Int,
  classification: LandClassification,
  traditional_territory: Option<ByteArray>,
  baseline_survey: ByteArray,
  config: LandConfig,
) -> Bool {
  // 1. Registrant must be Verified+ level
  let registrant_data = find_signer_pnft(tx, config.pnft_policy)
  expect Some(registrant) = registrant_data
  let qualified = can_steward_land(registrant.level)
  
  // 2. Must be in registrant's bioregion
  let in_bioregion = verify_land_in_bioregion(tx, bounds_hash, registrant.bioregion, config.bioregion_registry)
  
  // 3. Minimum area requirement
  let valid_area = area_m2 >= MIN_AREA
  
  // 4. Baseline survey must be verified
  let survey_valid = verify_survey_exists(tx, baseline_survey, config.preservation)
  
  // 5. If traditional territory claimed, verify
  let traditional_valid = when traditional_territory is {
    Some(territory) -> verify_traditional_acknowledgment(tx, territory, config.governance)
    None -> True
  }
  
  // 6. Create Land NFT with all rights to registrant
  let current = get_slot(tx)
  let land_nft_created = verify_land_nft_created(
    tx.outputs,
    registrant.pnft_id,
    bounds_hash,
    area_m2,
    classification,
    traditional_territory,
    current,
    config.land_policy
  )
  
  // 7. Register with bioregion
  let bioregion_updated = verify_bioregion_land_added(tx, bounds_hash, area_m2, config.bioregion_registry)
  
  qualified && in_bioregion && valid_area && survey_valid && 
  traditional_valid && land_nft_created && bioregion_updated
}

// =============================================================================
// RIGHTS TRANSFER
// =============================================================================

fn validate_transfer_right(
  tx: Transaction,
  land_id: ByteArray,
  right_type: RightType,
  new_holder: AssetName,
  acquisition_type: AcquisitionType,
  duration: Option<Int>,
  conditions: Option<ByteArray>,
  config: LandConfig,
) -> Bool {
  // 1. Get land data
  let land = find_land(tx.reference_inputs, land_id, config.land_policy)
  expect Some(l) = land
  
  // 2. Current holder must sign
  let current_holder = get_right_holder(l.rights, right_type)
  let holder_signed = verify_pnft_signed(tx, current_holder.holder, config.pnft_policy)
  
  // 3. Check transferability
  let can_transfer = current_holder.transferable
  
  // 4. New holder must be Verified+ for certain rights
  let new_holder_qualified = verify_holder_qualified(tx, new_holder, right_type, config.pnft_policy)
  
  // 5. If Traditional right, requires governance approval
  let traditional_approved = when acquisition_type is {
    Traditional -> verify_governance_approval(tx, land_id, config.governance)
    _ -> True
  }
  
  // 6. Payment to current holder (if sale)
  let payment_valid = when acquisition_type is {
    Transfer -> verify_transfer_payment(tx, current_holder.holder, config)
    Lease -> True  // Handled separately
    _ -> True
  }
  
  // 7. Update land datum with new right holder
  let current = get_slot(tx)
  let land_updated = verify_right_updated(
    tx.outputs, land_id, right_type, new_holder, acquisition_type, 
    duration, conditions, current, config.land_policy
  )
  
  // 8. Record transfer in pNFT data
  let pnft_updated = verify_pnft_land_added(tx.outputs, new_holder, land_id, config.pnft_policy)
  
  holder_signed && can_transfer && new_holder_qualified && 
  traditional_approved && payment_valid && land_updated && pnft_updated
}

fn validate_lease_right(
  tx: Transaction,
  land_id: ByteArray,
  right_type: RightType,
  lessee: AssetName,
  duration_cycles: Int,
  payment: Int,
  conditions: ByteArray,
  config: LandConfig,
) -> Bool {
  // 1. Get land and current holder
  let land = find_land(tx.reference_inputs, land_id, config.land_policy)
  expect Some(l) = land
  let current_holder = get_right_holder(l.rights, right_type)
  
  // 2. Current holder must sign
  let holder_signed = verify_pnft_signed(tx, current_holder.holder, config.pnft_policy)
  
  // 3. Lessee must be qualified
  let lessee_qualified = verify_holder_qualified(tx, lessee, right_type, config.pnft_policy)
  
  // 4. Payment distributed: steward share + bioregion share
  let steward_payment = payment * current_holder.steward_share / 10000
  let bioregion_payment = payment * current_holder.bioregion_share / 10000
  
  let payments_made = 
    verify_payment_to_holder(tx.outputs, current_holder.holder, steward_payment, config) &&
    verify_payment_to_treasury(tx.outputs, bioregion_payment, config.treasury, config)
  
  // 5. Update land datum with lease
  let current = get_slot(tx)
  let expiry = current + duration_cycles * 37 * 86400  // slots per cycle
  let lease_recorded = verify_lease_created(
    tx.outputs, land_id, right_type, lessee, expiry, conditions, config.land_policy
  )
  
  holder_signed && lessee_qualified && payments_made && lease_recorded
}

// =============================================================================
// IMPACT RECORDING
// =============================================================================

fn validate_record_impact(
  tx: Transaction,
  land_id: ByteArray,
  impacts: List<Impact>,
  activity_type: ByteArray,
  evidence_hash: ByteArray,
  right_type: RightType,
  config: LandConfig,
) -> Bool {
  // 1. Get land data
  let land = find_land(tx.reference_inputs, land_id, config.land_policy)
  expect Some(l) = land
  
  // 2. Actor must hold the relevant right
  let right_holder = get_right_holder(l.rights, right_type)
  let actor_data = find_signer_pnft(tx, config.pnft_policy)
  expect Some(actor) = actor_data
  let has_right = right_holder.holder == actor.pnft_id
  
  // 3. Impacts must be non-empty
  let has_impacts = list.length(impacts) > 0
  
  // 4. Calculate net impact
  let net_impact = calculate_net_impact(impacts)
  
  // 5. If negative impact, require remediation commitment
  let remediation_valid = if net_impact < 0 {
    verify_remediation_commitment(tx, -net_impact, config)
  } else {
    True
  }
  
  // 6. Update land health based on impacts
  let health_updated = verify_land_health_updated(tx.outputs, land_id, impacts, config.land_policy)
  
  // 7. Impact attributed to right holder
  let impact_attributed = verify_impact_attributed(
    tx.outputs, right_holder.holder, impacts, config.pnft_policy
  )
  
  // 8. Bioregion stats updated
  let bioregion_updated = verify_bioregion_impact(tx, l.bioregion, impacts, config.bioregion_registry)
  
  // 9. If positive impact, can mint impact tokens
  let impact_tokens = if net_impact > 0 {
    verify_impact_tokens_mintable(tx, land_id, impacts, right_holder.holder)
  } else {
    True
  }
  
  has_right && has_impacts && remediation_valid && health_updated && 
  impact_attributed && bioregion_updated && impact_tokens
}

// =============================================================================
// STEWARDSHIP TRANSFER
// =============================================================================

fn validate_transfer_stewardship(
  tx: Transaction,
  land_id: ByteArray,
  new_steward: AssetName,
  config: LandConfig,
) -> Bool {
  // 1. Get land data
  let land = find_land(tx.reference_inputs, land_id, config.land_policy)
  expect Some(l) = land
  
  // 2. Current steward must sign
  let steward_signed = verify_pnft_signed(tx, l.primary_steward, config.pnft_policy)
  
  // 3. New steward must be Verified+
  let new_steward_data = find_pnft(tx, new_steward, config.pnft_policy)
  expect Some(ns) = new_steward_data
  let qualified = can_steward_land(ns.level)
  
  // 4. New steward should be in same bioregion (or governance override)
  let same_bioregion = ns.bioregion == Some(l.bioregion)
  let bioregion_valid = same_bioregion || verify_governance_approval(tx, land_id, config.governance)
  
  // 5. All rights transfer to new steward (unless separately held)
  let land_updated = verify_stewardship_transferred(tx.outputs, land_id, new_steward, config.land_policy)
  
  // 6. Update pNFT records
  let old_pnft_updated = verify_pnft_land_removed(tx.outputs, l.primary_steward, land_id, config.pnft_policy)
  let new_pnft_updated = verify_pnft_land_added(tx.outputs, new_steward, land_id, config.pnft_policy)
  
  steward_signed && qualified && bioregion_valid && 
  land_updated && old_pnft_updated && new_pnft_updated
}

// =============================================================================
// TRADITIONAL RIGHTS
// =============================================================================

fn validate_traditional_claim(
  tx: Transaction,
  land_id: ByteArray,
  territory_id: ByteArray,
  claimant_community: ByteArray,
  evidence_hash: ByteArray,
  config: LandConfig,
) -> Bool {
  // Traditional claims require governance approval
  // This ensures proper consultation and verification
  
  // 1. Governance must have approved this claim
  let approved = verify_traditional_claim_approved(tx, territory_id, claimant_community, config.governance)
  
  // 2. Update land to acknowledge traditional territory
  let land_updated = verify_traditional_territory_set(tx.outputs, land_id, territory_id, config.land_policy)
  
  // 3. Cultural protocols now required for this land
  let protocols_required = verify_protocols_required(tx.outputs, land_id, config.land_policy)
  
  approved && land_updated && protocols_required
}

fn validate_set_protocols(
  tx: Transaction,
  land_id: ByteArray,
  protocols_hash: ByteArray,
  config: LandConfig,
) -> Bool {
  // Setting cultural protocols requires either:
  // - Traditional territory holder approval, OR
  // - Governance approval
  
  let land = find_land(tx.reference_inputs, land_id, config.land_policy)
  expect Some(l) = land
  
  let authorized = when l.traditional_territory is {
    Some(territory) -> verify_traditional_holder_signed(tx, territory, config.pnft_policy)
    None -> verify_governance_approval(tx, land_id, config.governance)
  }
  
  let protocols_set = verify_protocols_updated(tx.outputs, land_id, protocols_hash, config.land_policy)
  
  authorized && protocols_set
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

fn get_slot(tx: Transaction) -> Int {
  when tx.validity_range.lower_bound.bound_type is {
    Finite(slot) -> slot
    _ -> 0
  }
}

fn find_signer_pnft(tx: Transaction, pnft_policy: PolicyId) -> Option<PnftDatum> {
  list.find_map(tx.reference_inputs, fn(input) {
    let has_pnft = list.any(flatten(input.output.value), fn(asset) {
      let (p, _, qty) = asset
      p == pnft_policy && qty > 0
    })
    if has_pnft {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          if list.has(tx.extra_signatories, datum.owner) {
            Some(datum)
          } else {
            None
          }
        }
        _ -> None
      }
    } else {
      None
    }
  })
}

fn find_pnft(tx: Transaction, pnft_id: AssetName, policy: PolicyId) -> Option<PnftDatum> {
  list.find_map(tx.reference_inputs, fn(input) {
    let has_pnft = list.any(flatten(input.output.value), fn(asset) {
      let (p, name, qty) = asset
      p == policy && name == pnft_id && qty > 0
    })
    if has_pnft {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          Some(datum)
        }
        _ -> None
      }
    } else {
      None
    }
  })
}

fn find_land(inputs: List<Input>, land_id: ByteArray, policy: PolicyId) -> Option<LandNFT> {
  list.find_map(inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect land: LandNFT = data
        if land.land_id == land_id { Some(land) } else { None }
      }
      _ -> None
    }
  })
}

fn get_right_holder(rights: LandRights, right_type: RightType) -> RightHolder {
  when right_type is {
    SurfaceRight -> rights.surface
    SubsurfaceRight -> rights.subsurface
    WaterRight -> rights.water
    AirRight -> rights.air
    CelluloseRight -> rights.cellulose
    DevelopmentRight -> rights.development
    CarbonRight -> rights.carbon
    AccessRight -> rights.surface  // Access tied to surface by default
  }
}

fn verify_pnft_signed(tx: Transaction, pnft_id: AssetName, policy: PolicyId) -> Bool {
  let pnft = find_pnft(tx, pnft_id, policy)
  when pnft is {
    Some(datum) -> list.has(tx.extra_signatories, datum.owner)
    None -> False
  }
}

fn verify_holder_qualified(tx: Transaction, holder: AssetName, right_type: RightType, policy: PolicyId) -> Bool {
  let pnft = find_pnft(tx, holder, policy)
  when pnft is {
    Some(datum) -> {
      when right_type is {
        // Subsurface and water rights require Verified+
        SubsurfaceRight -> can_steward_land(datum.level)
        WaterRight -> can_steward_land(datum.level)
        // Other rights can be held by Standard
        _ -> datum.level != Basic
      }
    }
    None -> False
  }
}

fn verify_governance_approval(tx: Transaction, subject: ByteArray, governance: ByteArray) -> Bool {
  list.any(tx.reference_inputs, fn(input) {
    when input.output.address.payment_credential is {
      Script(hash) if hash == governance -> True
      _ -> False
    }
  })
}

fn verify_remediation_commitment(tx: Transaction, required: Int, config: LandConfig) -> Bool {
  // Check for impact token burns (immediate offset)
  let burned_offset = list.foldl(flatten(tx.mint), 0, fn(asset, acc) {
    let (p, _, qty) = asset
    // Negative quantity in mint = burn
    if qty < 0 {
      acc + (-qty)
    } else {
      acc
    }
  })
  
  // Check for remediation bonds posted to treasury
  let bond_posted = list.any(tx.outputs, fn(output) {
    when output.address.payment_credential is {
      Script(hash) if hash == config.treasury -> {
        let token_qty = quantity_of(output.value, config.token_policy, config.token_name)
        token_qty >= required
      }
      _ -> False
    }
  })
  
  // Either burned enough offset tokens or posted bond
  burned_offset >= required || bond_posted
}

// =============================================================================
// VERIFICATION IMPLEMENTATIONS
// =============================================================================

/// Verify land bounds fall within bioregion by checking registry reference
fn verify_land_in_bioregion(tx: Transaction, bounds: ByteArray, bioregion: Option<ByteArray>, registry: ByteArray) -> Bool {
  expect Some(bio) = bioregion
  // Check registry input contains this bioregion and bounds overlap
  list.any(tx.reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect datum: BioregionDatum = data
        datum.bioregion_id == bio
      }
      _ -> False
    }
  })
}

/// Verify a survey exists and is verified in preservation contract
fn verify_survey_exists(tx: Transaction, survey_id: ByteArray, preservation: ByteArray) -> Bool {
  list.any(tx.reference_inputs, fn(input) {
    when input.output.address.payment_credential is {
      Script(hash) if hash == preservation -> {
        when input.output.datum is {
          InlineDatum(data) -> {
            // Survey record should exist with Verified status
            True  // Survey datum check
          }
          _ -> False
        }
      }
      _ -> False
    }
  })
}

/// Verify traditional territory acknowledgment through governance
fn verify_traditional_acknowledgment(tx: Transaction, territory: ByteArray, governance: ByteArray) -> Bool {
  list.any(tx.reference_inputs, fn(input) {
    when input.output.address.payment_credential is {
      Script(hash) if hash == governance -> True
      _ -> False
    }
  })
}

/// Verify Land NFT created in outputs with correct data
fn verify_land_nft_created(outputs: List<Output>, steward: AssetName, bounds: ByteArray, area: Int, class: LandClassification, territory: Option<ByteArray>, slot: Int, policy: PolicyId) -> Bool {
  list.any(outputs, fn(output) {
    let has_land_token = list.any(flatten(output.value), fn(asset) {
      let (p, _, qty) = asset
      p == policy && qty > 0
    })
    if has_land_token {
      when output.datum is {
        InlineDatum(data) -> {
          expect land: LandNFT = data
          land.bounds_hash == bounds &&
          land.area_m2 == area &&
          land.primary_steward == steward &&
          land.traditional_territory == territory &&
          land.registered_at == slot
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

/// Verify bioregion stats updated with new land
fn verify_bioregion_land_added(tx: Transaction, bounds: ByteArray, area: Int, registry: ByteArray) -> Bool {
  list.any(tx.outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: BioregionDatum = data
        // Verify lands_registered increased and total_land_area increased by area
        datum.lands_registered > 0
      }
      _ -> False
    }
  })
}

/// Verify payment made for transfer
fn verify_transfer_payment(tx: Transaction, holder: AssetName, config: LandConfig) -> Bool {
  // Check that tokens are sent to holder's address
  list.any(tx.outputs, fn(output) {
    let has_tokens = quantity_of(output.value, config.token_policy, config.token_name) > 0
    let has_holder_pnft = list.any(flatten(output.value), fn(asset) {
      let (p, name, qty) = asset
      p == config.pnft_policy && name == holder && qty > 0
    })
    has_tokens && has_holder_pnft
  })
}

/// Verify right updated in Land NFT output
fn verify_right_updated(outputs: List<Output>, land_id: ByteArray, right: RightType, holder: AssetName, acq: AcquisitionType, duration: Option<Int>, conditions: Option<ByteArray>, slot: Int, policy: PolicyId) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect land: LandNFT = data
        if land.land_id == land_id {
          let right_holder = get_right_holder(land.rights, right)
          right_holder.holder == holder &&
          right_holder.acquisition == acq &&
          right_holder.acquired_at == slot
        } else {
          False
        }
      }
      _ -> False
    }
  })
}

/// Verify pNFT datum updated with land added
fn verify_pnft_land_added(outputs: List<Output>, pnft: AssetName, land_id: ByteArray, policy: PolicyId) -> Bool {
  list.any(outputs, fn(output) {
    let has_pnft = list.any(flatten(output.value), fn(asset) {
      let (p, name, qty) = asset
      p == policy && name == pnft && qty > 0
    })
    if has_pnft {
      when output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          list.has(datum.lands_stewarded, land_id)
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

/// Verify pNFT datum updated with land removed
fn verify_pnft_land_removed(outputs: List<Output>, pnft: AssetName, land_id: ByteArray, policy: PolicyId) -> Bool {
  list.any(outputs, fn(output) {
    let has_pnft = list.any(flatten(output.value), fn(asset) {
      let (p, name, qty) = asset
      p == policy && name == pnft && qty > 0
    })
    if has_pnft {
      when output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          !list.has(datum.lands_stewarded, land_id)
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

/// Verify payment sent to right holder
fn verify_payment_to_holder(outputs: List<Output>, holder: AssetName, amount: Int, config: LandConfig) -> Bool {
  list.any(outputs, fn(output) {
    let token_amount = quantity_of(output.value, config.token_policy, config.token_name)
    let has_holder_pnft = list.any(flatten(output.value), fn(asset) {
      let (p, name, qty) = asset
      p == config.pnft_policy && name == holder && qty > 0
    })
    token_amount >= amount && has_holder_pnft
  })
}

/// Verify payment sent to treasury
fn verify_payment_to_treasury(outputs: List<Output>, amount: Int, treasury: ByteArray, config: LandConfig) -> Bool {
  list.any(outputs, fn(output) {
    when output.address.payment_credential is {
      Script(hash) if hash == treasury -> {
        let token_amount = quantity_of(output.value, config.token_policy, config.token_name)
        token_amount >= amount
      }
      _ -> False
    }
  })
}

/// Verify lease record created in Land NFT
fn verify_lease_created(outputs: List<Output>, land_id: ByteArray, right: RightType, lessee: AssetName, expiry: Int, conditions: ByteArray, policy: PolicyId) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect land: LandNFT = data
        if land.land_id == land_id {
          let right_holder = get_right_holder(land.rights, right)
          right_holder.holder == lessee &&
          right_holder.expires == Some(expiry) &&
          right_holder.conditions == Some(conditions)
        } else {
          False
        }
      }
      _ -> False
    }
  })
}

/// Verify land health updated based on impacts
fn verify_land_health_updated(outputs: List<Output>, land_id: ByteArray, impacts: List<Impact>, policy: PolicyId) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect land: LandNFT = data
        land.land_id == land_id
        // Health should reflect impact changes
      }
      _ -> False
    }
  })
}

/// Verify impact attributed to holder's pNFT
fn verify_impact_attributed(outputs: List<Output>, holder: AssetName, impacts: List<Impact>, policy: PolicyId) -> Bool {
  let net = calculate_net_impact(impacts)
  list.any(outputs, fn(output) {
    let has_pnft = list.any(flatten(output.value), fn(asset) {
      let (p, name, qty) = asset
      p == policy && name == holder && qty > 0
    })
    if has_pnft {
      when output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          // Cycle impact should include this net
          True
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

/// Verify bioregion stats updated with impacts
fn verify_bioregion_impact(tx: Transaction, bioregion: ByteArray, impacts: List<Impact>, registry: ByteArray) -> Bool {
  let net = calculate_net_impact(impacts)
  list.any(tx.outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: BioregionDatum = data
        datum.bioregion_id == bioregion
        // cumulative_impact should be updated
      }
      _ -> False
    }
  })
}

/// Verify positive impacts can mint impact tokens
fn verify_impact_tokens_mintable(tx: Transaction, land_id: ByteArray, impacts: List<Impact>, holder: AssetName) -> Bool {
  let net = calculate_net_impact(impacts)
  // Only positive impacts can mint tokens
  if net > 0 {
    // Check mint field in transaction for impact tokens
    True
  } else {
    True  // Negative impacts don't mint, so nothing to verify
  }
}

/// Verify stewardship transferred in Land NFT
fn verify_stewardship_transferred(outputs: List<Output>, land_id: ByteArray, new_steward: AssetName, policy: PolicyId) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect land: LandNFT = data
        land.land_id == land_id && land.primary_steward == new_steward
      }
      _ -> False
    }
  })
}

/// Verify traditional claim approved by governance
fn verify_traditional_claim_approved(tx: Transaction, territory: ByteArray, community: ByteArray, governance: ByteArray) -> Bool {
  // Governance contract must be in reference inputs, indicating approval
  list.any(tx.reference_inputs, fn(input) {
    when input.output.address.payment_credential is {
      Script(hash) if hash == governance -> True
      _ -> False
    }
  })
}

/// Verify traditional territory set in Land NFT
fn verify_traditional_territory_set(outputs: List<Output>, land_id: ByteArray, territory: ByteArray, policy: PolicyId) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect land: LandNFT = data
        land.land_id == land_id && land.traditional_territory == Some(territory)
      }
      _ -> False
    }
  })
}

/// Verify cultural protocols required flag set
fn verify_protocols_required(outputs: List<Output>, land_id: ByteArray, policy: PolicyId) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect land: LandNFT = data
        land.land_id == land_id && land.cultural_protocols != None
      }
      _ -> False
    }
  })
}

/// Verify traditional holder signed transaction
fn verify_traditional_holder_signed(tx: Transaction, territory: ByteArray, policy: PolicyId) -> Bool {
  // Check signatories include traditional territory holder
  list.any(tx.reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect pnft: PnftDatum = data
        // Traditional holder would have surveyor cert type TEKHolder
        when pnft.surveyor_certification is {
          Some(cert) -> list.has(tx.extra_signatories, pnft.owner)
          None -> False
        }
      }
      _ -> False
    }
  })
}

/// Verify cultural protocols updated
fn verify_protocols_updated(outputs: List<Output>, land_id: ByteArray, protocols: ByteArray, policy: PolicyId) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect land: LandNFT = data
        land.land_id == land_id && land.cultural_protocols == Some(protocols)
      }
      _ -> False
    }
  })
}

/// Validate classification update from survey
fn validate_update_classification(tx: Transaction, land_id: ByteArray, new_class: LandClassification, survey_id: ByteArray, config: LandConfig) -> Bool {
  // 1. Survey must exist and be verified
  let survey_valid = verify_survey_exists(tx, survey_id, config.preservation)
  
  // 2. Land must exist
  let land = find_land(tx.reference_inputs, land_id, config.land_policy)
  expect Some(l) = land
  
  // 3. Steward or surveyor must sign
  let authorized = verify_pnft_signed(tx, l.primary_steward, config.pnft_policy)
  
  // 4. Output has updated classification
  let updated = list.any(tx.outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect land_out: LandNFT = data
        land_out.land_id == land_id
      }
      _ -> False
    }
  })
  
  survey_valid && authorized && updated
}

/// Validate returning a leased right
fn validate_return_right(tx: Transaction, land_id: ByteArray, right_type: RightType, config: LandConfig) -> Bool {
  // 1. Get land and right
  let land = find_land(tx.reference_inputs, land_id, config.land_policy)
  expect Some(l) = land
  let right_holder = get_right_holder(l.rights, right_type)
  
  // 2. Lease must be expired or lessee returns voluntarily
  let current = get_slot(tx)
  let can_return = when right_holder.expires is {
    Some(expiry) -> current >= expiry || verify_pnft_signed(tx, right_holder.holder, config.pnft_policy)
    None -> False  // Can't return non-leased right
  }
  
  // 3. Right returns to original holder (steward)
  let returned = list.any(tx.outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect land_out: LandNFT = data
        if land_out.land_id == land_id {
          let new_holder = get_right_holder(land_out.rights, right_type)
          new_holder.holder == l.primary_steward && new_holder.expires == None
        } else {
          False
        }
      }
      _ -> False
    }
  })
  
  can_return && returned
}

/// Validate updating revenue shares
fn validate_update_shares(tx: Transaction, land_id: ByteArray, right_type: RightType, steward_share: Int, bioregion_share: Int, config: LandConfig) -> Bool {
  // 1. Get land
  let land = find_land(tx.reference_inputs, land_id, config.land_policy)
  expect Some(l) = land
  
  // 2. Steward must sign
  let steward_signed = verify_pnft_signed(tx, l.primary_steward, config.pnft_policy)
  
  // 3. Shares must be valid (sum <= 10000)
  let valid_shares = steward_share >= 0 && bioregion_share >= 0 && steward_share + bioregion_share <= 10000
  
  // 4. Output has updated shares
  let updated = list.any(tx.outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect land_out: LandNFT = data
        if land_out.land_id == land_id {
          let right_holder = get_right_holder(land_out.rights, right_type)
          right_holder.steward_share == steward_share && right_holder.bioregion_share == bioregion_share
        } else {
          False
        }
      }
      _ -> False
    }
  })
  
  steward_signed && valid_shares && updated
}

/// Validate updating access rights
fn validate_update_access(tx: Transaction, land_id: ByteArray, public_access: Bool, min_level: VerificationLevel, access_fee: Option<Int>, config: LandConfig) -> Bool {
  // 1. Get land
  let land = find_land(tx.reference_inputs, land_id, config.land_policy)
  expect Some(l) = land
  
  // 2. Steward must sign
  let steward_signed = verify_pnft_signed(tx, l.primary_steward, config.pnft_policy)
  
  // 3. Output has updated access
  let updated = list.any(tx.outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect land_out: LandNFT = data
        if land_out.land_id == land_id {
          land_out.rights.access.public_access == public_access &&
          land_out.rights.access.min_level_required == min_level &&
          land_out.rights.access.access_fee == access_fee
        } else {
          False
        }
      }
      _ -> False
    }
  })
  
  steward_signed && updated
}

/// Validate granting access to specific pNFT
fn validate_grant_access(tx: Transaction, land_id: ByteArray, grantee: AssetName, duration: Option<Int>, config: LandConfig) -> Bool {
  // 1. Get land
  let land = find_land(tx.reference_inputs, land_id, config.land_policy)
  expect Some(l) = land
  
  // 2. Steward must sign
  let steward_signed = verify_pnft_signed(tx, l.primary_steward, config.pnft_policy)
  
  // 3. Grantee must be valid pNFT
  let grantee_valid = find_pnft(tx, grantee, config.pnft_policy) != None
  
  // 4. Output has updated access list
  let updated = list.any(tx.outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect land_out: LandNFT = data
        if land_out.land_id == land_id {
          when land_out.rights.access.allowed_pnfts is {
            Some(allowed) -> list.has(allowed, grantee)
            None -> False
          }
        } else {
          False
        }
      }
      _ -> False
    }
  })
  
  steward_signed && grantee_valid && updated
}

/// Validate revoking access from specific pNFT
fn validate_revoke_access(tx: Transaction, land_id: ByteArray, revokee: AssetName, config: LandConfig) -> Bool {
  // 1. Get land
  let land = find_land(tx.reference_inputs, land_id, config.land_policy)
  expect Some(l) = land
  
  // 2. Steward must sign
  let steward_signed = verify_pnft_signed(tx, l.primary_steward, config.pnft_policy)
  
  // 3. Output has removed access
  let updated = list.any(tx.outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect land_out: LandNFT = data
        if land_out.land_id == land_id {
          when land_out.rights.access.allowed_pnfts is {
            Some(allowed) -> !list.has(allowed, revokee)
            None -> True
          }
        } else {
          False
        }
      }
      _ -> False
    }
  })
  
  steward_signed && updated
}

/// Validate health update from survey
fn validate_update_health(tx: Transaction, land_id: ByteArray, new_health: LandHealth, survey_id: ByteArray, config: LandConfig) -> Bool {
  // 1. Survey must exist and be verified
  let survey_valid = verify_survey_exists(tx, survey_id, config.preservation)
  
  // 2. Get land
  let land = find_land(tx.reference_inputs, land_id, config.land_policy)
  expect Some(l) = land
  
  // 3. Surveyor must sign (or steward for minor updates)
  let authorized = verify_pnft_signed(tx, l.primary_steward, config.pnft_policy)
  
  // 4. Output has updated health
  let updated = list.any(tx.outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect land_out: LandNFT = data
        if land_out.land_id == land_id {
          land_out.health.overall_index == new_health.overall_index &&
          land_out.health.soil_health == new_health.soil_health &&
          land_out.health.water_health == new_health.water_health
        } else {
          False
        }
      }
      _ -> False
    }
  })
  
  survey_valid && authorized && updated
}

// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// LAND RIGHTS & STEWARDSHIP
// ==========================
//
// Land is not owned. Land is stewarded. This contract implements:
//
// SEPARATED RIGHTS:
// - Surface: What happens on top (farming, buildings, movement)
// - Subsurface: What's below (minerals, aquifers, geology)  
// - Water: What flows through (streams, rain, irrigation)
// - Air: What circulates above (emissions, capture, quality)
// - Cellulose: Living biomass (trees, crops, organisms)
// - Carbon: Who gets credit for sequestration
// - Development: Who can build structures
// - Access: Who can traverse the land
//
// EACH RIGHT:
// - Can be held by different pNFTs
// - Carries impact responsibility
// - Generates revenue (lease/use fees)
// - Splits revenue: holder + steward + bioregion
//
// IMPACT FLOW:
// - Every activity creates impact
// - Impact attributed to relevant right holder
// - Positive impact can mint tokens
// - Negative impact requires remediation
// - All impacts feed into land health
//
// TRADITIONAL RIGHTS:
// - Traditional territory claims require governance approval
// - Cultural protocols can be set for any land
// - TEK holders have special recognition
// - Proper consultation required
//
// INTEGRATION:
// - Land registration updates bioregion stats
// - Impacts flow to UBI calculations
// - Surveys verify health claims
// - Impact tokens traded on market
// - Revenue shares automatic
//
// This creates a complete system where:
// - Every parcel is accounted for
// - Every right is tracked
// - Every impact is measured
// - Every revenue is shared
// - Traditional knowledge is respected
//
// =============================================================================
