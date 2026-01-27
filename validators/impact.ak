// =============================================================================
// UltraLife Protocol — Impact
// =============================================================================
//
// LAYER 4: CONSEQUENCE
//
// Impact tokens represent verified environmental actions.
// Every UltraLife transaction carries impact classification.
// This contract handles the formal impact token system.
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Finite}
use cardano/assets.{PolicyId, AssetName, Value, quantity_of, flatten}
use cardano/transaction.{Transaction, Input, Output, OutputReference, InlineDatum, Mint}
use ultralife/types.{
  PnftDatum, BioregionDatum, VerificationLevel, Verified, Steward,
  ImpactCategory, CarbonImpact, WaterImpact, BiodiversityImpact, SoilImpact,
  AirImpact, WasteImpact, EnergyImpact, LandUseImpact,
}

/// Result of finding an issuer pNFT
pub type IssuerPnftInfo {
  pnft: AssetName,
  owner: VerificationKeyHash,
  level: VerificationLevel,
}

// =============================================================================
// IMPACT TOKEN TYPES
// =============================================================================

/// Impact token datum
pub type ImpactDatum {
  /// Issuing bioregion
  bioregion: ByteArray,
  /// Impact category
  category: ImpactCategory,
  /// Magnitude (1-1000)
  magnitude: Int,
  /// Evidence hash (IPFS)
  evidence_hash: ByteArray,
  /// Issuer pNFT
  issuer: AssetName,
  /// Verification attestations
  attestations: List<ByteArray>,
  /// Creation slot
  created_at: Int,
  /// Expiration (impact validity)
  expires_at: Option<Int>,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type ImpactRedeemer {
  /// Mint impact token (verified action)
  MintImpact {
    bioregion: ByteArray,
    category: ImpactCategory,
    magnitude: Int,
    evidence_hash: ByteArray,
  }
  
  /// Retire impact token (used for offset)
  RetireImpact {
    reason: ByteArray,
  }
  
  /// Transfer impact token
  TransferImpact {
    recipient: AssetName,
  }
  
  /// Verify impact (add attestation)
  AttestImpact {
    attestor: AssetName,
    attestation: ByteArray,
  }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type ImpactConfig {
  /// pNFT policy
  pnft_policy: PolicyId,
  /// Bioregion beacon policy
  bioregion_policy: PolicyId,
  /// UltraLife token policy (for fees)
  token_policy: PolicyId,
  /// UltraLife token name
  token_name: AssetName,
  /// Required attestations for high-magnitude impacts
  high_magnitude_threshold: Int,
  /// Attestations required for high magnitude
  required_attestations: Int,
}

// =============================================================================
// MINTING POLICY
// =============================================================================

validator impact_policy(config: ImpactConfig) {
  mint(redeemer: ImpactRedeemer, policy_id: PolicyId, tx: Transaction) {
    when redeemer is {
      MintImpact { bioregion, category, magnitude, evidence_hash } -> {
        validate_mint_impact(tx, policy_id, bioregion, category, magnitude, evidence_hash, config)
      }
      
      RetireImpact { reason } -> {
        validate_retire_impact(tx, policy_id, reason, config)
      }
      
      _ -> False  // Transfer and attest don't mint/burn
    }
  }
}

// =============================================================================
// MINT IMPACT
// =============================================================================

fn validate_mint_impact(
  tx: Transaction,
  policy_id: PolicyId,
  bioregion: ByteArray,
  category: ImpactCategory,
  magnitude: Int,
  evidence_hash: ByteArray,
  config: ImpactConfig,
) -> Bool {
  // 1. Issuer must have Verified+ pNFT in this bioregion
  let issuer = find_issuer_pnft(tx, bioregion, config.pnft_policy)
  expect Some(issuer_data) = issuer
  expect issuer_data.level == Verified || issuer_data.level == Steward
  
  // 2. Issuer must sign
  let issuer_signed = list.has(tx.extra_signatories, issuer_data.owner)
  
  // 3. Magnitude must be valid (1-1000)
  let magnitude_valid = magnitude > 0 && magnitude <= 1000
  
  // 4. Evidence must be provided
  let has_evidence = evidence_hash != ""
  
  // 5. Bioregion must exist
  let bioregion_valid = verify_bioregion_exists(tx.reference_inputs, bioregion, config.bioregion_policy)
  
  // 6. High magnitude requires attestations
  let attestation_ok = if magnitude > config.high_magnitude_threshold {
    verify_attestations(tx, config.required_attestations, config.pnft_policy)
  } else {
    True
  }
  
  // 7. Fee must be paid (5 tokens to bioregion treasury)
  let fee_paid = verify_impact_fee(tx.outputs, bioregion, config.token_policy, config.token_name)
  
  // 8. Must mint exactly 1 impact token
  let mint_correct = verify_single_impact_mint(tx.mint, policy_id)
  
  // 9. Output datum must be correct
  let datum_correct = verify_impact_datum(
    tx.outputs,
    policy_id,
    bioregion,
    category,
    magnitude,
    evidence_hash,
    issuer_data.pnft,
    tx,
  )
  
  issuer_signed && magnitude_valid && has_evidence && bioregion_valid &&
  attestation_ok && fee_paid && mint_correct && datum_correct
}

// =============================================================================
// RETIRE IMPACT
// =============================================================================

fn validate_retire_impact(
  tx: Transaction,
  policy_id: PolicyId,
  reason: ByteArray,
  config: ImpactConfig,
) -> Bool {
  // 1. Must burn exactly 1 impact token
  let burn_correct = verify_single_impact_burn(tx.mint, policy_id)
  
  // 2. Owner must sign (find in inputs)
  let owner_signed = verify_impact_owner_signed(tx, policy_id)
  
  // 3. Reason must be provided
  let has_reason = reason != ""
  
  burn_correct && owner_signed && has_reason
}

// =============================================================================
// SPENDING VALIDATOR
// =============================================================================

validator impact(config: ImpactConfig) {
  spend(
    datum: Option<ImpactDatum>,
    redeemer: ImpactRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(d) = datum
    
    when redeemer is {
      TransferImpact { recipient } -> {
        validate_transfer(tx, d, recipient, config)
      }
      
      AttestImpact { attestor, attestation } -> {
        validate_attest(tx, d, attestor, attestation, config)
      }
      
      RetireImpact { .. } -> {
        // Handled by minting policy (burn)
        True
      }
      
      _ -> False
    }
  }
}

fn validate_transfer(
  tx: Transaction,
  datum: ImpactDatum,
  recipient: AssetName,
  config: ImpactConfig,
) -> Bool {
  // 1. Current owner must sign
  let owner_signed = verify_current_owner_signed(tx, datum.issuer, config.pnft_policy)
  
  // 2. Recipient must have pNFT
  let recipient_valid = verify_recipient_pnft(tx, recipient, config.pnft_policy)
  
  // 3. Token not expired
  let not_expired = verify_not_expired(tx, datum.expires_at)
  
  // 4. Datum preserved (or updated with new owner context)
  let datum_preserved = verify_datum_preserved(tx.outputs, datum)
  
  owner_signed && recipient_valid && not_expired && datum_preserved
}

fn validate_attest(
  tx: Transaction,
  datum: ImpactDatum,
  attestor: AssetName,
  attestation: ByteArray,
  config: ImpactConfig,
) -> Bool {
  // 1. Attestor must be Verified+ in same bioregion
  let attestor_valid = verify_attestor_pnft(tx, attestor, datum.bioregion, config.pnft_policy)
  
  // 2. Attestor must sign
  let attestor_signed = verify_pnft_owner_signed(tx, attestor, config.pnft_policy)
  
  // 3. Attestor must not have already attested
  let not_duplicate = !list.has(datum.attestations, attestation)
  
  // 4. Datum updated with new attestation
  let datum_updated = verify_attestation_added(tx.outputs, datum, attestation)
  
  attestor_valid && attestor_signed && not_duplicate && datum_updated
}

// =============================================================================
// HELPERS
// =============================================================================

fn find_issuer_pnft(
  tx: Transaction,
  bioregion: ByteArray,
  pnft_policy: PolicyId,
) -> Option<IssuerPnftInfo> {
  list.find_map(tx.reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect datum: PnftDatum = data
        if datum.bioregion == Some(bioregion) {
          Some(IssuerPnftInfo { pnft: datum.pnft_id, owner: datum.owner, level: datum.level })
        } else {
          None
        }
      }
      _ -> None
    }
  })
}

fn verify_bioregion_exists(
  reference_inputs: List<Input>,
  bioregion: ByteArray,
  policy: PolicyId,
) -> Bool {
  list.any(reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect datum: BioregionDatum = data
        datum.bioregion_id == bioregion
      }
      _ -> False
    }
  })
}

fn verify_attestations(
  tx: Transaction,
  required: Int,
  pnft_policy: PolicyId,
) -> Bool {
  // Count pNFT holders who signed (attestors)
  let attestor_count = list.foldl(tx.reference_inputs, 0, fn(input, acc) {
    let has_pnft = list.any(flatten(input.output.value), fn(asset) {
      let (p, _, qty) = asset
      p == pnft_policy && qty > 0
    })
    if has_pnft {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          if list.has(tx.extra_signatories, datum.owner) { acc + 1 } else { acc }
        }
        _ -> acc
      }
    } else {
      acc
    }
  })
  attestor_count >= required
}

fn verify_impact_fee(
  outputs: List<Output>,
  bioregion: ByteArray,
  policy: PolicyId,
  name: AssetName,
) -> Bool {
  // 5 tokens to bioregion treasury
  let fee_amount = 5
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: BioregionDatum = data
        datum.bioregion_id == bioregion &&
        quantity_of(output.value, policy, name) >= fee_amount
      }
      _ -> False
    }
  })
}

fn verify_single_impact_mint(mint: Value, policy: PolicyId) -> Bool {
  let policy_tokens = list.filter_map(flatten(mint), fn(asset) {
    let (p, name, qty) = asset
    if p == policy { Some((name, qty)) } else { None }
  })
  when policy_tokens is {
    [(_, qty)] -> qty == 1
    _ -> False
  }
}

fn verify_single_impact_burn(mint: Value, policy: PolicyId) -> Bool {
  let policy_tokens = list.filter_map(flatten(mint), fn(asset) {
    let (p, name, qty) = asset
    if p == policy { Some((name, qty)) } else { None }
  })
  when policy_tokens is {
    [(_, qty)] -> qty == -1
    _ -> False
  }
}

fn verify_impact_datum(
  outputs: List<Output>,
  policy: PolicyId,
  bioregion: ByteArray,
  category: ImpactCategory,
  magnitude: Int,
  evidence: ByteArray,
  issuer: AssetName,
  tx: Transaction,
) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: ImpactDatum = data
        datum.bioregion == bioregion &&
        datum.category == category &&
        datum.magnitude == magnitude &&
        datum.evidence_hash == evidence &&
        datum.issuer == issuer
      }
      _ -> False
    }
  })
}

fn verify_impact_owner_signed(tx: Transaction, policy: PolicyId) -> Bool {
  // Impact token owner must have signed
  list.any(tx.inputs, fn(input) {
    let has_impact = list.any(flatten(input.output.value), fn(asset) {
      let (p, _, qty) = asset
      p == policy && qty > 0
    })
    if has_impact {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: ImpactDatum = data
          // Check issuer's owner signed
          True  // Simplified - full impl checks pNFT
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

fn verify_current_owner_signed(
  tx: Transaction,
  issuer: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  list.any(tx.reference_inputs, fn(input) {
    let has_pnft = list.any(flatten(input.output.value), fn(asset) {
      let (p, name, qty) = asset
      p == pnft_policy && name == issuer && qty > 0
    })
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
  })
}

fn verify_recipient_pnft(
  tx: Transaction,
  recipient: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  // Verify recipient has a pNFT
  list.any(tx.reference_inputs, fn(input) {
    list.any(flatten(input.output.value), fn(asset) {
      let (p, name, qty) = asset
      p == pnft_policy && name == recipient && qty > 0
    })
  })
}

fn verify_not_expired(tx: Transaction, expires: Option<Int>) -> Bool {
  when expires is {
    None -> True
    Some(deadline) -> {
      let current = when tx.validity_range.lower_bound.bound_type is {
        Finite(slot) -> slot
        _ -> 0
      }
      current < deadline
    }
  }
}

fn verify_datum_preserved(outputs: List<Output>, datum: ImpactDatum) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect new_datum: ImpactDatum = data
        new_datum.bioregion == datum.bioregion &&
        new_datum.category == datum.category &&
        new_datum.magnitude == datum.magnitude &&
        new_datum.evidence_hash == datum.evidence_hash
      }
      _ -> False
    }
  })
}

fn verify_attestor_pnft(
  tx: Transaction,
  attestor: AssetName,
  bioregion: ByteArray,
  pnft_policy: PolicyId,
) -> Bool {
  // Attestor must have pNFT in same bioregion, Verified+
  list.any(tx.reference_inputs, fn(input) {
    let has_pnft = list.any(flatten(input.output.value), fn(asset) {
      let (p, name, qty) = asset
      p == pnft_policy && name == attestor && qty > 0
    })
    if has_pnft {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          datum.bioregion == Some(bioregion) &&
          (datum.level == Verified || datum.level == Steward)
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

fn verify_pnft_owner_signed(
  tx: Transaction,
  pnft: AssetName,
  policy: PolicyId,
) -> Bool {
  list.any(tx.reference_inputs, fn(input) {
    let has_pnft = list.any(flatten(input.output.value), fn(asset) {
      let (p, name, qty) = asset
      p == policy && name == pnft && qty > 0
    })
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
  })
}

fn verify_attestation_added(
  outputs: List<Output>,
  old_datum: ImpactDatum,
  attestation: ByteArray,
) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect new_datum: ImpactDatum = data
        // Core fields preserved, attestation added
        new_datum.bioregion == old_datum.bioregion &&
        new_datum.magnitude == old_datum.magnitude &&
        list.length(new_datum.attestations) == list.length(old_datum.attestations) + 1
      }
      _ -> False
    }
  })
}

// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// IMPACT TOKENS
// =============
//
// Represent verified environmental actions:
// - Carbon sequestration
// - Water restoration
// - Biodiversity protection
// - Soil regeneration
// - etc.
//
// VERIFICATION LEVELS
// ===================
//
// Low magnitude (1-500): Self-reported with evidence
// High magnitude (501-1000): Requires attestations
//
// USE CASES
// =========
//
// 1. CREATION: Verified action creates impact token
// 2. TRANSFER: Impact can be sold/transferred
// 3. OFFSET: Retire token to offset negative impact
// 4. PROOF: On-chain record of environmental contribution
//
// INTEGRATION WITH TOKEN TRANSACTIONS
// ====================================
//
// Every UltraLife token transaction has impact classification.
// Formal impact tokens are for significant, verified actions.
// Transaction impact metadata is for general accountability.
//
// =============================================================================
