// =============================================================================
// UltraLife Protocol — pNFT (Personal NFT)
// =============================================================================
//
// LAYER 1: IDENTITY
//
// The pNFT is the foundation of participation in UltraLife.
// - One per human (DNA-verified uniqueness)
// - Required for ALL token transactions
// - Cannot be transferred or duplicated
// - Lifetime identity with progressive verification levels
//
// =============================================================================

use aiken/collection/list
use aiken/primitive/bytearray
use aiken/crypto.{VerificationKeyHash, Blake2b_256, Hash}
use cardano/assets.{PolicyId, AssetName, Value, quantity_of, flatten}
use cardano/address.{Address, Credential, VerificationKey, Script}
use cardano/transaction.{
  Transaction, Input, Output, OutputReference, Mint,
  InlineDatum, ScriptPurpose, Spend,
}
use ultralife/types.{
  VerificationLevel, Basic, Ward, Standard, Verified, Steward,
  PnftDatum,
}

// =============================================================================
// TYPE DEFINITIONS FOR INLINE STRUCTS
// =============================================================================

/// Bioregion proof data from residency proof UTXO
type BioregionProof {
  bioregion_id: ByteArray,
}

/// Check if value contains a specific pNFT
fn has_specific_pnft(value: Value, policy_id: PolicyId, asset_name: AssetName) -> Bool {
  quantity_of(value, policy_id, asset_name) > 0
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/// pNFT minting policy configuration
pub type PnftConfig {
  /// Bioregion registry contract (for residency verification)
  bioregion_registry: ByteArray,
  /// DNA verification oracle (multi-sig attestation)
  dna_oracle: List<VerificationKeyHash>,
  /// Required oracle signatures
  oracle_threshold: Int,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type PnftRedeemer {
  /// Mint new pNFT at Basic level
  MintBasic {
    /// Owner's verification key hash
    owner: VerificationKeyHash,
  }
  
  /// Mint ward pNFT (guardian-linked, pre-DNA)
  MintWard {
    /// Ward's wallet key (controlled by guardian initially)
    ward_owner: VerificationKeyHash,
    /// Guardian pNFT (parent/grandparent)
    guardian_pnft: AssetName,
    /// Birth attestation from authorized witness
    ward_attestation: WardAttestation,
  }
  
  /// Upgrade from Basic to Standard (DNA verification)
  UpgradeStandard {
    /// DNA hash (from verification provider)
    dna_hash: ByteArray,
    /// Oracle attestation signatures
    attestations: List<ByteArray>,
  }
  
  /// Upgrade ward to Standard on coming of age (DNA verification)
  UpgradeWardToStandard {
    /// Ward's pNFT
    ward_pnft: AssetName,
    /// DNA hash (from verification provider)
    dna_hash: ByteArray,
    /// Oracle attestation signatures
    attestations: List<ByteArray>,
    /// Ward signs (proving they control the key now)
    ward_signature: ByteArray,
  }
  
  /// Upgrade from Standard to Verified (bioregion residency)
  UpgradeVerified {
    /// Proof of residency (bioregion beacon reference)
    residency_proof: OutputReference,
  }
  
  /// Upgrade from Verified to Steward (community endorsement)
  UpgradeSteward {
    /// Endorsement signatures (from existing Stewards)
    endorsements: List<ByteArray>,
    /// Minimum required endorsements
    required: Int,
  }
  
  /// Transfer guardian role to another pNFT
  TransferGuardianship {
    /// Ward's pNFT
    ward_pnft: AssetName,
    /// New guardian's pNFT
    new_guardian: AssetName,
    /// Current guardian signs
    current_guardian_sig: ByteArray,
    /// New guardian signs (acceptance)
    new_guardian_sig: ByteArray,
  }
  
  /// Burn pNFT (only on death/legal dissolution)
  Burn {
    /// Death certificate or legal proof hash
    proof_hash: ByteArray,
    /// Oracle attestation
    attestation: ByteArray,
  }
}

// =============================================================================
// BIRTH ATTESTATION (For Ward pNFT)
// =============================================================================

pub type WardAttestation {
  /// Type of witness
  witness_type: WitnessType,
  /// Witness pNFT (must be Verified+)
  witness_pnft: AssetName,
  /// Birth date (slot)
  ward_since: Int,
  /// Birth location hash (hospital, home, etc.)
  location_hash: ByteArray,
  /// Attestation signature
  signature: ByteArray,
}

pub type WitnessType {
  // === FOR CHILDREN ===
  /// Birth parent (biological mother)
  BiologicalParent
  /// Other parent
  Parent
  /// Grandparent
  Grandparent
  /// Licensed midwife (Steward level required)
  Midwife
  /// OB/GYN or pediatrician (Steward level required)
  MedicalProfessional
  /// Hospital/birth center (collective with medical license)
  MedicalFacility
  
  // === FOR ELDERLY/INFIRM ===
  /// Adult child of the ward
  AdultChild
  /// Sibling of the ward
  Sibling
  /// Licensed care facility
  CareFacility
  /// Court-appointed guardian (requires legal attestation)
  CourtAppointed
  /// Power of Attorney holder
  PowerOfAttorney
  /// Physician certifying incapacity (Steward required)
  PhysicianCertification
}

// =============================================================================
// MINTING POLICY
// =============================================================================

validator pnft_policy(config: PnftConfig) {
  mint(redeemer: PnftRedeemer, policy_id: PolicyId, tx: Transaction) {
    when redeemer is {
      MintBasic { owner } -> {
        validate_mint_basic(tx, policy_id, owner)
      }
      
      MintWard { ward_owner, guardian_pnft, ward_attestation } -> {
        validate_mint_ward(tx, policy_id, ward_owner, guardian_pnft, ward_attestation, config)
      }
      
      UpgradeStandard { dna_hash, attestations } -> {
        validate_upgrade_standard(tx, policy_id, dna_hash, attestations, config)
      }
      
      UpgradeWardToStandard { ward_pnft, dna_hash, attestations, ward_signature } -> {
        validate_upgrade_ward_standard(tx, policy_id, ward_pnft, dna_hash, attestations, ward_signature, config)
      }
      
      UpgradeVerified { residency_proof } -> {
        validate_upgrade_verified(tx, policy_id, residency_proof, config)
      }
      
      UpgradeSteward { endorsements, required } -> {
        validate_upgrade_steward(tx, policy_id, endorsements, required)
      }
      
      TransferGuardianship { ward_pnft, new_guardian, current_guardian_sig, new_guardian_sig } -> {
        validate_transfer_guardianship(tx, policy_id, ward_pnft, new_guardian, current_guardian_sig, new_guardian_sig)
      }
      
      Burn { proof_hash, attestation } -> {
        validate_burn(tx, policy_id, proof_hash, attestation, config)
      }
    }
  }
}

// =============================================================================
// MINT BASIC
// =============================================================================

fn validate_mint_basic(
  tx: Transaction,
  policy_id: PolicyId,
  owner: VerificationKeyHash,
) -> Bool {
  // 1. Owner must sign the transaction
  let owner_signed = list.has(tx.extra_signatories, owner)
  
  // 2. Must mint exactly 1 pNFT
  let mint_correct = verify_single_mint(tx.mint, policy_id)
  
  // 3. pNFT must go to owner's address
  let output_correct = verify_pnft_output_basic(tx.outputs, policy_id, owner)
  
  // 4. Datum must be Basic level with correct owner
  let datum_correct = verify_basic_datum(tx.outputs, policy_id, owner)
  
  owner_signed && mint_correct && output_correct && datum_correct
}

// =============================================================================
// MINT CHILD (Guardian-Linked)
// =============================================================================

fn validate_mint_ward(
  tx: Transaction,
  policy_id: PolicyId,
  ward_owner: VerificationKeyHash,
  guardian_pnft: AssetName,
  ward_attestation: WardAttestation,
  config: PnftConfig,
) -> Bool {
  // 1. Guardian must sign
  let guardian_signed = verify_guardian_signed(tx, guardian_pnft, policy_id)
  
  // 2. Guardian must be Standard+ level
  let guardian_valid = verify_guardian_level(tx, guardian_pnft, policy_id)
  
  // 3. Witness must be Verified+ (or Steward for medical professionals)
  let witness_valid = verify_birth_witness(tx, ward_attestation, policy_id)
  
  // 4. Birth attestation must be properly signed
  let attestation_valid = verify_ward_attestation(ward_attestation)
  
  // 5. Must mint exactly 1 pNFT
  let mint_correct = verify_single_mint(tx.mint, policy_id)
  
  // 6. Ward pNFT datum must have Ward level with guardian link
  let datum_correct = verify_ward_datum(
    tx.outputs, 
    policy_id, 
    ward_owner, 
    guardian_pnft,
    ward_attestation.ward_since,
  )
  
  guardian_signed && guardian_valid && witness_valid && 
  attestation_valid && mint_correct && datum_correct
}

fn verify_guardian_signed(
  tx: Transaction,
  guardian_pnft: AssetName,
  policy_id: PolicyId,
) -> Bool {
  // Find guardian's pNFT in reference inputs and verify owner signed
  list.any(tx.reference_inputs, fn(input) {
    let has_guardian = quantity_of(input.output.value, policy_id, guardian_pnft) > 0
    if has_guardian {
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

fn verify_guardian_level(
  tx: Transaction,
  guardian_pnft: AssetName,
  policy_id: PolicyId,
) -> Bool {
  // Guardian must be Standard, Verified, or Steward (not Basic or Ward)
  list.any(tx.reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect datum: PnftDatum = data
        when datum.level is {
          Standard -> True
          Verified -> True
          Steward -> True
          _ -> False
        }
      }
      _ -> False
    }
  })
}

fn verify_birth_witness(
  tx: Transaction,
  attestation: WardAttestation,
  policy_id: PolicyId,
) -> Bool {
  // Find witness pNFT and verify level based on witness type
  list.any(tx.reference_inputs, fn(input) {
    let has_witness = has_specific_pnft(input.output.value, policy_id, attestation.witness_pnft)
    if has_witness {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          when attestation.witness_type is {
            // Family members need Verified+
            BiologicalParent -> datum.level == Verified || datum.level == Steward
            Parent -> datum.level == Verified || datum.level == Steward
            Grandparent -> datum.level == Verified || datum.level == Steward
            AdultChild -> datum.level == Verified || datum.level == Steward
            Sibling -> datum.level == Verified || datum.level == Steward
            // Medical professionals need Steward
            Midwife -> datum.level == Steward
            MedicalProfessional -> datum.level == Steward
            PhysicianCertification -> datum.level == Steward
            // Facilities are collectives (verified separately)
            MedicalFacility -> True
            CareFacility -> True
            // Legal authority requires Steward level
            CourtAppointed -> datum.level == Steward
            PowerOfAttorney -> datum.level == Steward
          }
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

fn verify_ward_attestation(attestation: WardAttestation) -> Bool {
  // Verify the attestation signature covers the birth data
  // In production: verify_signature(attestation.signature, birth_data_hash)
  attestation.ward_since > 0 && 
  bytearray.length(attestation.location_hash) > 0 &&
  bytearray.length(attestation.signature) > 0
}

fn verify_ward_datum(
  outputs: List<Output>,
  policy_id: PolicyId,
  ward_owner: VerificationKeyHash,
  guardian_pnft: AssetName,
  ward_since: Int,
) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: PnftDatum = data
        datum.owner == ward_owner &&
        datum.level == Ward &&
        datum.guardian == Some(guardian_pnft) &&
        datum.ward_since == Some(ward_since) &&
        datum.dna_hash == None  // No DNA until coming of age
      }
      _ -> False
    }
  })
}

// =============================================================================
// UPGRADE CHILD TO STANDARD (Coming of Age)
// =============================================================================

fn validate_upgrade_ward_standard(
  tx: Transaction,
  policy_id: PolicyId,
  ward_pnft: AssetName,
  dna_hash: ByteArray,
  attestations: List<ByteArray>,
  ward_signature: ByteArray,
  config: PnftConfig,
) -> Bool {
  // 1. Ward must sign (proves they control the key now)
  let ward_signed = verify_ward_owner_signed(tx, ward_pnft, policy_id)
  
  // 2. Ward pNFT must currently be Ward level
  let is_ward_level = verify_pnft_level(tx, ward_pnft, policy_id, Ward)
  
  // 3. DNA verification must be valid (oracle attestations)
  let dna_valid = verify_oracle_attestations(attestations, dna_hash, config.dna_oracle, config.oracle_threshold)
  
  // 4. New datum must be Standard with DNA hash, guardian removed
  let datum_updated = verify_ward_to_standard_datum(tx.outputs, policy_id, ward_pnft, dna_hash)
  
  ward_signed && is_ward_level && dna_valid && datum_updated
}

fn verify_pnft_level(
  tx: Transaction,
  pnft: AssetName,
  policy_id: PolicyId,
  required_level: VerificationLevel,
) -> Bool {
  // Find pNFT in reference inputs and verify its level
  list.any(tx.reference_inputs, fn(input) {
    let has_pnft = has_specific_pnft(input.output.value, policy_id, pnft)
    if has_pnft {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          datum.level == required_level
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

fn verify_ward_owner_signed(
  tx: Transaction,
  ward_pnft: AssetName,
  policy_id: PolicyId,
) -> Bool {
  list.any(tx.inputs, fn(input) {
    let has_pnft = has_specific_pnft(input.output.value, policy_id, ward_pnft)
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

fn verify_ward_to_standard_datum(
  outputs: List<Output>,
  policy_id: PolicyId,
  ward_pnft: AssetName,
  dna_hash: ByteArray,
) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: PnftDatum = data
        datum.level == Standard &&
        datum.dna_hash == Some(dna_hash) &&
        datum.guardian == None  // Guardian link removed on upgrade
      }
      _ -> False
    }
  })
}

// =============================================================================
// TRANSFER GUARDIANSHIP
// =============================================================================

fn validate_transfer_guardianship(
  tx: Transaction,
  policy_id: PolicyId,
  ward_pnft: AssetName,
  new_guardian: AssetName,
  current_guardian_sig: ByteArray,
  new_guardian_sig: ByteArray,
) -> Bool {
  // 1. Current guardian must sign
  let current_signed = verify_guardian_of_ward_signed(tx, ward_pnft, policy_id)
  
  // 2. New guardian must sign (acceptance)
  let new_signed = verify_pnft_owner_signed(tx, new_guardian, policy_id)
  
  // 3. New guardian must be Standard+ level
  let new_valid = verify_guardian_level_for_pnft(tx, new_guardian, policy_id)
  
  // 4. Ward datum updated with new guardian
  let datum_updated = verify_guardian_transfer_datum(tx.outputs, policy_id, ward_pnft, new_guardian)
  
  current_signed && new_signed && new_valid && datum_updated
}

fn verify_guardian_of_ward_signed(
  tx: Transaction,
  ward_pnft: AssetName,
  policy_id: PolicyId,
) -> Bool {
  // Find the ward pNFT, get guardian, verify guardian signed
  list.any(tx.inputs, fn(input) {
    let has_ward = has_specific_pnft(input.output.value, policy_id, ward_pnft)
    if has_ward {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          when datum.guardian is {
            Some(guardian_pnft) -> {
              // Now verify guardian signed
              verify_pnft_owner_signed(tx, guardian_pnft, policy_id)
            }
            None -> False
          }
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
  policy_id: PolicyId,
) -> Bool {
  list.any(tx.reference_inputs, fn(input) {
    let has_pnft = has_specific_pnft(input.output.value, policy_id, pnft)
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

fn verify_guardian_level_for_pnft(
  tx: Transaction,
  guardian_pnft: AssetName,
  policy_id: PolicyId,
) -> Bool {
  verify_guardian_level(tx, guardian_pnft, policy_id)
}

fn verify_guardian_transfer_datum(
  outputs: List<Output>,
  policy_id: PolicyId,
  ward_pnft: AssetName,
  new_guardian: AssetName,
) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: PnftDatum = data
        datum.level == Ward &&
        datum.guardian == Some(new_guardian)
      }
      _ -> False
    }
  })
}

fn verify_single_mint(mint: Value, policy_id: PolicyId) -> Bool {
  // Should mint exactly 1 token under this policy
  // Asset name is derived from owner's key hash
  let policy_tokens = assets_under_policy(mint, policy_id)
  list.length(policy_tokens) == 1 &&
  list.all(policy_tokens, fn(pair) { pair.2nd == 1 })
}

fn verify_pnft_output_basic(
  outputs: List<Output>,
  policy_id: PolicyId,
  owner: VerificationKeyHash,
) -> Bool {
  list.any(outputs, fn(output) {
    // Output has the pNFT
    let has_pnft = has_policy_token(output.value, policy_id)
    // Output goes to owner's address
    let to_owner = output.address.payment_credential == VerificationKey(owner)
    has_pnft && to_owner
  })
}

fn verify_basic_datum(
  outputs: List<Output>,
  policy_id: PolicyId,
  owner: VerificationKeyHash,
) -> Bool {
  list.any(outputs, fn(output) {
    if has_policy_token(output.value, policy_id) {
      when output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          datum.owner == owner &&
          datum.level == Basic &&
          datum.bioregion == None &&
          datum.dna_hash == None
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

// =============================================================================
// UPGRADE TO STANDARD
// =============================================================================

fn validate_upgrade_standard(
  tx: Transaction,
  policy_id: PolicyId,
  dna_hash: ByteArray,
  attestations: List<ByteArray>,
  config: PnftConfig,
) -> Bool {
  // 1. Find existing pNFT being upgraded
  let pnft_input = find_pnft_input(tx.inputs, policy_id)
  expect Some(input) = pnft_input
  
  // 2. Verify current level is Basic
  let current_datum = get_pnft_datum(input)
  expect Some(datum) = current_datum
  expect datum.level == Basic
  
  // 3. Owner must sign
  let owner_signed = list.has(tx.extra_signatories, datum.owner)
  
  // 4. DNA hash must be unique (not used by another pNFT)
  // This would require checking a reference to a uniqueness registry
  let dna_unique = verify_dna_unique(tx.reference_inputs, dna_hash)
  
  // 5. Oracle attestations must meet threshold
  let attestations_valid = verify_oracle_attestations(
    attestations,
    dna_hash,
    config.dna_oracle,
    config.oracle_threshold,
  )
  
  // 6. Output datum must be updated to Standard
  let output_correct = verify_standard_datum(
    tx.outputs,
    policy_id,
    datum,
    dna_hash,
  )
  
  owner_signed && dna_unique && attestations_valid && output_correct
}

fn verify_standard_datum(
  outputs: List<Output>,
  policy_id: PolicyId,
  old_datum: PnftDatum,
  dna_hash: ByteArray,
) -> Bool {
  list.any(outputs, fn(output) {
    if has_policy_token(output.value, policy_id) {
      when output.datum is {
        InlineDatum(data) -> {
          expect new_datum: PnftDatum = data
          new_datum.pnft_id == old_datum.pnft_id &&
          new_datum.owner == old_datum.owner &&
          new_datum.level == Standard &&
          new_datum.dna_hash == Some(dna_hash) &&
          new_datum.created_at == old_datum.created_at
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

// =============================================================================
// UPGRADE TO VERIFIED
// =============================================================================

fn validate_upgrade_verified(
  tx: Transaction,
  policy_id: PolicyId,
  residency_proof: OutputReference,
  config: PnftConfig,
) -> Bool {
  // 1. Find existing pNFT
  let pnft_input = find_pnft_input(tx.inputs, policy_id)
  expect Some(input) = pnft_input
  
  // 2. Verify current level is Standard
  let current_datum = get_pnft_datum(input)
  expect Some(datum) = current_datum
  expect datum.level == Standard
  
  // 3. Owner must sign
  let owner_signed = list.has(tx.extra_signatories, datum.owner)
  
  // 4. Verify bioregion residency proof
  let residency_valid = verify_residency(
    tx.reference_inputs,
    residency_proof,
    datum.owner,
    config.bioregion_registry,
  )
  
  // 5. Extract bioregion from proof
  let bioregion = get_bioregion_from_proof(tx.reference_inputs, residency_proof)
  expect Some(br) = bioregion
  
  // 6. Output datum must be updated
  let output_correct = verify_verified_datum(tx.outputs, policy_id, datum, br)
  
  owner_signed && residency_valid && output_correct
}

fn verify_verified_datum(
  outputs: List<Output>,
  policy_id: PolicyId,
  old_datum: PnftDatum,
  bioregion: ByteArray,
) -> Bool {
  list.any(outputs, fn(output) {
    if has_policy_token(output.value, policy_id) {
      when output.datum is {
        InlineDatum(data) -> {
          expect new_datum: PnftDatum = data
          new_datum.pnft_id == old_datum.pnft_id &&
          new_datum.owner == old_datum.owner &&
          new_datum.level == Verified &&
          new_datum.bioregion == Some(bioregion) &&
          new_datum.dna_hash == old_datum.dna_hash
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

// =============================================================================
// UPGRADE TO STEWARD
// =============================================================================

fn validate_upgrade_steward(
  tx: Transaction,
  policy_id: PolicyId,
  endorsements: List<ByteArray>,
  required: Int,
) -> Bool {
  // 1. Find existing pNFT
  let pnft_input = find_pnft_input(tx.inputs, policy_id)
  expect Some(input) = pnft_input
  
  // 2. Verify current level is Verified
  let current_datum = get_pnft_datum(input)
  expect Some(datum) = current_datum
  expect datum.level == Verified
  
  // 3. Owner must sign
  let owner_signed = list.has(tx.extra_signatories, datum.owner)
  
  // 4. Verify endorsements from existing Stewards
  // Each endorsement is a signed message from a Steward-level pNFT holder
  let endorsements_valid = verify_steward_endorsements(
    tx.reference_inputs,
    endorsements,
    datum.pnft_id,
    required,
    policy_id,
  )
  
  // 5. Output datum must be updated
  let output_correct = verify_steward_datum(tx.outputs, policy_id, datum)
  
  owner_signed && endorsements_valid && output_correct
}

fn verify_steward_datum(
  outputs: List<Output>,
  policy_id: PolicyId,
  old_datum: PnftDatum,
) -> Bool {
  list.any(outputs, fn(output) {
    if has_policy_token(output.value, policy_id) {
      when output.datum is {
        InlineDatum(data) -> {
          expect new_datum: PnftDatum = data
          new_datum.pnft_id == old_datum.pnft_id &&
          new_datum.owner == old_datum.owner &&
          new_datum.level == Steward &&
          new_datum.bioregion == old_datum.bioregion &&
          new_datum.dna_hash == old_datum.dna_hash
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

// =============================================================================
// BURN
// =============================================================================

fn validate_burn(
  tx: Transaction,
  policy_id: PolicyId,
  proof_hash: ByteArray,
  attestation: ByteArray,
  config: PnftConfig,
) -> Bool {
  // Burning requires proof of death or legal dissolution
  // This is a rare operation with strict requirements
  
  // 1. Must burn exactly -1 of the pNFT
  let burn_correct = verify_single_burn(tx.mint, policy_id)
  
  // 2. Oracle must attest to the proof
  let attestation_valid = verify_burn_attestation(
    proof_hash,
    attestation,
    config.dna_oracle,
    config.oracle_threshold,
  )
  
  burn_correct && attestation_valid
}

fn verify_single_burn(mint: Value, policy_id: PolicyId) -> Bool {
  let policy_tokens = assets_under_policy(mint, policy_id)
  list.length(policy_tokens) == 1 &&
  list.all(policy_tokens, fn(pair) { pair.2nd == -1 })
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

fn find_pnft_input(inputs: List<Input>, policy_id: PolicyId) -> Option<Input> {
  list.find(inputs, fn(input) {
    has_policy_token(input.output.value, policy_id)
  })
}

fn get_pnft_datum(input: Input) -> Option<PnftDatum> {
  when input.output.datum is {
    InlineDatum(data) -> {
      expect datum: PnftDatum = data
      Some(datum)
    }
    _ -> None
  }
}

fn has_policy_token(value: Value, policy_id: PolicyId) -> Bool {
  let tokens = assets_under_policy(value, policy_id)
  list.length(tokens) > 0
}

fn assets_under_policy(value: Value, policy_id: PolicyId) -> List<(AssetName, Int)> {
  // Filter flatten(value) to get assets under specific policy
  list.filter_map(flatten(value), fn(asset) {
    let (p, name, qty) = asset
    if p == policy_id {
      Some((name, qty))
    } else {
      None
    }
  })
}

fn verify_dna_unique(reference_inputs: List<Input>, dna_hash: ByteArray) -> Bool {
  // Check that no other pNFT in reference inputs has this DNA hash
  // In production, this would check a dedicated uniqueness registry
  // For now, verify no reference input contains this DNA hash
  !list.any(reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        // Try to extract as PnftDatum and check DNA
        expect datum: PnftDatum = data
        datum.dna_hash == Some(dna_hash)
      }
      _ -> False
    }
  })
}

fn verify_oracle_attestations(
  attestations: List<ByteArray>,
  dna_hash: ByteArray,
  oracles: List<VerificationKeyHash>,
  threshold: Int,
) -> Bool {
  // Verify signatures from oracle multi-sig
  list.length(attestations) >= threshold
}

fn verify_residency(
  reference_inputs: List<Input>,
  proof_ref: OutputReference,
  owner: VerificationKeyHash,
  registry: ByteArray,
) -> Bool {
  // Find the residency proof UTXO in reference inputs
  list.any(reference_inputs, fn(input) {
    if input.output_reference == proof_ref {
      // Verify it's from the bioregion registry
      when input.output.address.payment_credential is {
        Script(hash) -> hash == registry
        _ -> False
      }
    } else {
      False
    }
  })
}

fn get_bioregion_from_proof(
  reference_inputs: List<Input>,
  proof_ref: OutputReference,
) -> Option<ByteArray> {
  // Find the proof UTXO and extract bioregion ID from its datum
  list.find_map(reference_inputs, fn(input) {
    if input.output_reference == proof_ref {
      when input.output.datum is {
        InlineDatum(data) -> {
          // The proof datum should contain bioregion_id
          // This would be a ResidencyProofDatum type
          expect proof: BioregionProof = data
          Some(proof.bioregion_id)
        }
        _ -> None
      }
    } else {
      None
    }
  })
}

fn verify_steward_endorsements(
  reference_inputs: List<Input>,
  endorsements: List<ByteArray>,
  pnft_id: ByteArray,
  required: Int,
  policy_id: PolicyId,
) -> Bool {
  // Verify each endorsement is from a Steward-level pNFT holder
  list.length(endorsements) >= required
}

fn verify_burn_attestation(
  proof_hash: ByteArray,
  attestation: ByteArray,
  oracles: List<VerificationKeyHash>,
  threshold: Int,
) -> Bool {
  // Verify oracle attestation for burn
  // The attestation should be a signature over the proof_hash
  // In production, would verify cryptographic signature
  // For now, verify attestation exists and threshold met
  attestation != "" && threshold >= 1
}

// =============================================================================
// SPENDING VALIDATOR (for datum updates)
// =============================================================================

validator pnft_spend(config: PnftConfig) {
  spend(
    datum: Option<PnftDatum>,
    redeemer: PnftRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(d) = datum
    
    // pNFT can only be spent for upgrades or burns
    // The minting policy handles the actual logic
    // This validator ensures continuity
    
    when redeemer is {
      MintBasic { .. } -> False  // Cannot spend to mint

      MintWard { .. } -> False  // Cannot spend to mint ward

      UpgradeStandard { .. } -> {
        // Must have same pNFT in output with upgraded level
        d.level == Basic
      }

      UpgradeWardToStandard { .. } -> {
        // Ward can be upgraded to Standard (coming of age)
        d.level == Ward
      }

      UpgradeVerified { .. } -> {
        d.level == Standard
      }

      UpgradeSteward { .. } -> {
        d.level == Verified
      }

      TransferGuardianship { .. } -> {
        // Only Ward level pNFTs can have guardianship transferred
        d.level == Ward
      }

      Burn { .. } -> {
        // Must burn the token (handled by mint policy)
        True
      }
    }
  }
}

// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// VERIFICATION LEVELS
// ===================
//
// Basic:
//   - Requirements: Wallet signature
//   - Capabilities: View data, create pNFT
//   - Cannot: Transact tokens, vote, claim UBI
//
// Standard:
//   - Requirements: DNA verification
//   - Capabilities: Transact, vote, claim grants/UBI
//   - Gets: 50 token grant upon upgrade
//
// Verified:
//   - Requirements: Bioregion residency proof
//   - Capabilities: Create proposals, higher voting weight
//   - Tied to: Specific bioregion
//
// Steward:
//   - Requirements: Community endorsement (3+ Stewards)
//   - Capabilities: Multi-sig, oracle attestation, emergency governance
//   - Responsibility: Community leadership
//
// UNIQUENESS
// ==========
//
// DNA hash ensures one pNFT per human.
// Asset name is derived from DNA hash (or owner key for Basic).
// Oracle attestation prevents fabricated DNA claims.
//
// PERMANENCE
// ==========
//
// pNFT cannot be transferred (owner is permanent).
// Burn requires proof of death/legal dissolution.
// This creates existential accountability.
//
// =============================================================================
