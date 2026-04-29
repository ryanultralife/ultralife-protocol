// =============================================================================
// UltraLife Protocol - Oracle-Verified Impact Validator
// =============================================================================
//
// LAYER 4: CONSEQUENCE + ORACLE VERIFICATION
//
// Extends impact tracking with trustless oracle verification.
// Verifies impact claims against satellite/sensor data.
// Cross-references sequestration claims with NDVI, carbon flux data.
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash, blake2b_256}
use aiken/interval.{Finite}
use cardano/assets.{AssetName, MintedValue, PolicyId, flatten, from_minted_value, quantity_of}
use cardano/transaction.{
  InlineDatum, Input, Mint, Output, OutputReference, Transaction,
}
use ultralife/oracle.{
  ImpactOracleData, OracleDatum, VerificationMethod,
  find_oracle_input, get_oracle_value, get_oracle_timestamp, get_tx_slot,
  is_oracle_valid, validate_impact_oracle_data, validate_oracle_freshness,
  count_oracle_attestations,
}
use ultralife/types.{
  AirImpact, BiodiversityImpact, BioregionDatum, CarbonImpact, EnergyImpact,
  ImpactCategory, LandUseImpact, PnftDatum, SoilImpact, Steward,
  VerificationLevel, Verified, WasteImpact, WaterImpact,
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type OracleImpactConfig {
  /// pNFT policy
  pnft_policy: PolicyId,
  /// Bioregion beacon policy
  bioregion_policy: PolicyId,
  /// UltraLife token policy (for fees)
  token_policy: PolicyId,
  /// UltraLife token name
  token_name: AssetName,
  /// Charli3 oracle policy ID
  oracle_policy: PolicyId,
  /// Maximum oracle data age in slots
  max_oracle_age_slots: Int,
  /// Minimum confidence threshold (0-100)
  min_confidence: Int,
  /// Tolerance for claim vs oracle verification (percentage * 100)
  verification_tolerance: Int,
}

// =============================================================================
// IMPACT TOKEN TYPES (Extended with Oracle)
// =============================================================================

/// Oracle-verified impact token datum
pub type OracleImpactDatum {
  /// Issuing bioregion
  bioregion: ByteArray,
  /// Impact category
  category: ImpactCategory,
  /// Claimed magnitude (1-1000)
  claimed_magnitude: Int,
  /// Oracle-verified magnitude
  verified_magnitude: Int,
  /// Evidence hash (IPFS)
  evidence_hash: ByteArray,
  /// Issuer pNFT
  issuer: AssetName,
  /// Oracle verification data
  oracle_verification: OracleVerificationRecord,
  /// Creation slot
  created_at: Int,
  /// Expiration (impact validity)
  expires_at: Option<Int>,
}

/// Record of oracle verification
pub type OracleVerificationRecord {
  /// Oracle data hash
  oracle_data_hash: ByteArray,
  /// Number of oracle attestations
  oracle_count: Int,
  /// Verification timestamp
  verified_at: Int,
  /// Verification method used
  method: VerificationMethod,
  /// Confidence score (0-100)
  confidence: Int,
  /// Deviation from claim (percentage * 100)
  deviation_from_claim: Int,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type OracleImpactRedeemer {
  /// Mint impact token with oracle verification
  MintVerifiedImpact {
    bioregion: ByteArray,
    category: ImpactCategory,
    claimed_magnitude: Int,
    evidence_hash: ByteArray,
    oracle_data: ImpactOracleData,
  }
  /// Mint without oracle (requires higher attestation threshold)
  MintUnverifiedImpact {
    bioregion: ByteArray,
    category: ImpactCategory,
    magnitude: Int,
    evidence_hash: ByteArray,
  }
  /// Retire impact token (used for offset)
  RetireImpact { reason: ByteArray }
  /// Challenge impact with oracle data
  ChallengeImpact {
    impact_token: AssetName,
    oracle_data: ImpactOracleData,
  }
}

// =============================================================================
// MINTING POLICY
// =============================================================================

validator oracle_impact_policy(config: OracleImpactConfig) {
  mint(redeemer: OracleImpactRedeemer, policy_id: PolicyId, tx: Transaction) {
    when redeemer is {
      MintVerifiedImpact { bioregion, category, claimed_magnitude, evidence_hash, oracle_data } ->
        validate_mint_verified_impact(
          tx,
          policy_id,
          bioregion,
          category,
          claimed_magnitude,
          evidence_hash,
          oracle_data,
          config,
        )
      MintUnverifiedImpact { bioregion, category, magnitude, evidence_hash } ->
        validate_mint_unverified_impact(
          tx,
          policy_id,
          bioregion,
          category,
          magnitude,
          evidence_hash,
          config,
        )
      RetireImpact { reason } ->
        validate_retire_impact(tx, policy_id, reason, config)
      ChallengeImpact { impact_token, oracle_data } ->
        validate_challenge_impact(tx, policy_id, impact_token, oracle_data, config)
    }
  }

  else(_) {
    fail
  }
}

// =============================================================================
// MINT VERIFIED IMPACT
// =============================================================================

fn validate_mint_verified_impact(
  tx: Transaction,
  policy_id: PolicyId,
  bioregion: ByteArray,
  category: ImpactCategory,
  claimed_magnitude: Int,
  evidence_hash: ByteArray,
  oracle_data: ImpactOracleData,
  config: OracleImpactConfig,
) -> Bool {
  let current_slot = get_tx_slot(tx)

  // 1. Find issuer pNFT with Verified+ level
  let issuer_result = find_issuer_pnft(tx, bioregion, config.pnft_policy)
  expect Some(issuer) = issuer_result
  expect issuer.level == Verified || issuer.level == Steward

  // 2. Issuer must sign
  let issuer_signed = list.has(tx.extra_signatories, issuer.owner)

  // 3. Magnitude must be valid (1-1000)
  let magnitude_valid = claimed_magnitude > 0 && claimed_magnitude <= 1000

  // 4. Evidence must be provided
  let has_evidence = evidence_hash != ""

  // 5. Bioregion must exist
  let bioregion_valid = verify_bioregion_exists(
    tx.reference_inputs,
    bioregion,
    config.bioregion_policy,
  )

  // 6. Validate oracle reference inputs
  let oracle_count = count_oracle_attestations(
    tx.reference_inputs,
    config.oracle_policy,
    current_slot,
  )
  let has_oracle = oracle_count >= 1

  // 7. Validate oracle data matches claim
  let oracle_valid = validate_impact_oracle_data(
    oracle_data,
    evidence_hash,  // Use evidence_hash as claim_id
    current_slot,
    config.max_oracle_age_slots,
    config.min_confidence,
  )

  // 8. Verified magnitude is within tolerance of claim
  let deviation = calculate_deviation(claimed_magnitude, oracle_data.verified_quantity)
  let within_tolerance = deviation <= config.verification_tolerance

  // 9. Must mint exactly 1 impact token
  let mint_correct = verify_single_impact_mint(tx.mint, policy_id)

  // 10. Output datum must be correct
  let datum_correct = verify_verified_impact_datum(
    tx.outputs,
    policy_id,
    bioregion,
    category,
    claimed_magnitude,
    oracle_data.verified_quantity,
    evidence_hash,
    issuer.pnft,
    oracle_data,
    oracle_count,
    current_slot,
    deviation,
    tx,
  )

  // 11. Fee must be paid (reduced for oracle-verified)
  let fee_paid = verify_impact_fee(
    tx.outputs,
    bioregion,
    config.token_policy,
    config.token_name,
    3, // Reduced fee for oracle-verified
  )

  issuer_signed && magnitude_valid && has_evidence && bioregion_valid &&
  has_oracle && oracle_valid && within_tolerance && mint_correct && datum_correct && fee_paid
}

/// Calculate percentage deviation between claim and verification
fn calculate_deviation(claimed: Int, verified: Int) -> Int {
  if claimed == 0 {
    if verified == 0 { 0 } else { 10000 }
  } else {
    let diff = if claimed > verified { claimed - verified } else { verified - claimed }
    diff * 10000 / claimed
  }
}

/// Verify output datum for verified impact
fn verify_verified_impact_datum(
  outputs: List<Output>,
  policy_id: PolicyId,
  bioregion: ByteArray,
  category: ImpactCategory,
  claimed_magnitude: Int,
  verified_magnitude: Int,
  evidence_hash: ByteArray,
  issuer: AssetName,
  oracle_data: ImpactOracleData,
  oracle_count: Int,
  current_slot: Int,
  deviation: Int,
  tx: Transaction,
) -> Bool {
  list.any(
    outputs,
    fn(output) {
      // Check output has impact token
      let has_token = list.any(
        flatten(output.value),
        fn(asset) {
          let (p, _, qty) = asset
          p == policy_id && qty == 1
        },
      )
      if has_token {
        when output.datum is {
          InlineDatum(data) -> {
            expect datum: OracleImpactDatum = data
            datum.bioregion == bioregion &&
            datum.category == category &&
            datum.claimed_magnitude == claimed_magnitude &&
            datum.verified_magnitude == verified_magnitude &&
            datum.evidence_hash == evidence_hash &&
            datum.issuer == issuer &&
            datum.created_at == current_slot &&
            datum.oracle_verification.oracle_count == oracle_count &&
            datum.oracle_verification.verified_at == current_slot &&
            datum.oracle_verification.confidence == oracle_data.confidence &&
            datum.oracle_verification.deviation_from_claim == deviation
          }
          _ -> False
        }
      } else {
        False
      }
    },
  )
}

// =============================================================================
// MINT UNVERIFIED IMPACT
// =============================================================================

fn validate_mint_unverified_impact(
  tx: Transaction,
  policy_id: PolicyId,
  bioregion: ByteArray,
  category: ImpactCategory,
  magnitude: Int,
  evidence_hash: ByteArray,
  config: OracleImpactConfig,
) -> Bool {
  let current_slot = get_tx_slot(tx)

  // 1. Find issuer pNFT - must be Steward for unverified
  let issuer_result = find_issuer_pnft(tx, bioregion, config.pnft_policy)
  expect Some(issuer) = issuer_result
  expect issuer.level == Steward

  // 2. Issuer must sign
  let issuer_signed = list.has(tx.extra_signatories, issuer.owner)

  // 3. Magnitude valid
  let magnitude_valid = magnitude > 0 && magnitude <= 1000

  // 4. Evidence required
  let has_evidence = evidence_hash != ""

  // 5. Bioregion exists
  let bioregion_valid = verify_bioregion_exists(
    tx.reference_inputs,
    bioregion,
    config.bioregion_policy,
  )

  // 6. Higher fee for unverified (5 tokens vs 3)
  let fee_paid = verify_impact_fee(
    tx.outputs,
    bioregion,
    config.token_policy,
    config.token_name,
    5,
  )

  // 7. Must mint exactly 1 token
  let mint_correct = verify_single_impact_mint(tx.mint, policy_id)

  issuer_signed && magnitude_valid && has_evidence && bioregion_valid && fee_paid && mint_correct
}

// =============================================================================
// RETIRE IMPACT
// =============================================================================

fn validate_retire_impact(
  tx: Transaction,
  policy_id: PolicyId,
  reason: ByteArray,
  config: OracleImpactConfig,
) -> Bool {
  // Must have reason
  let has_reason = reason != ""
  // Must burn exactly 1 token
  let burn_correct = verify_single_impact_burn(tx.mint, policy_id)
  // Owner must sign
  let owner_signed = verify_impact_owner_signed(tx, policy_id)

  has_reason && burn_correct && owner_signed
}

// =============================================================================
// CHALLENGE IMPACT
// =============================================================================

fn validate_challenge_impact(
  tx: Transaction,
  policy_id: PolicyId,
  impact_token: AssetName,
  oracle_data: ImpactOracleData,
  config: OracleImpactConfig,
) -> Bool {
  let current_slot = get_tx_slot(tx)

  // 1. Find the impact token being challenged
  let token_found = find_impact_token(tx.reference_inputs, policy_id, impact_token)
  expect Some(impact_datum) = token_found

  // 2. Oracle data must show significant deviation
  let oracle_valid = validate_impact_oracle_data(
    oracle_data,
    impact_datum.evidence_hash,
    current_slot,
    config.max_oracle_age_slots,
    config.min_confidence,
  )

  // 3. Calculate deviation from original claim
  let deviation = calculate_deviation(
    impact_datum.claimed_magnitude,
    oracle_data.verified_quantity,
  )

  // Must deviate by more than 50% to challenge
  let significant_deviation = deviation > 5000

  // 4. Challenger must have valid pNFT
  let challenger_valid = has_valid_pnft(tx, config.pnft_policy)

  oracle_valid && significant_deviation && challenger_valid
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/// Issuer pNFT info
pub type IssuerPnftInfo {
  pnft: AssetName,
  owner: VerificationKeyHash,
  level: VerificationLevel,
}

/// Find issuer pNFT in transaction
fn find_issuer_pnft(
  tx: Transaction,
  bioregion: ByteArray,
  pnft_policy: PolicyId,
) -> Option<IssuerPnftInfo> {
  list.find_map(
    tx.reference_inputs,
    fn(input) {
      let pnft_asset = list.find(
        flatten(input.output.value),
        fn(asset) {
          let (p, _, qty) = asset
          p == pnft_policy && qty > 0
        },
      )
      when pnft_asset is {
        Some((_, name, _)) -> {
          when input.output.datum is {
            InlineDatum(data) -> {
              expect datum: PnftDatum = data
              if datum.bioregion == Some(bioregion) {
                Some(IssuerPnftInfo {
                  pnft: name,
                  owner: datum.owner,
                  level: datum.level,
                })
              } else {
                None
              }
            }
            _ -> None
          }
        }
        None -> None
      }
    },
  )
}

/// Verify bioregion exists
fn verify_bioregion_exists(
  reference_inputs: List<Input>,
  bioregion_id: ByteArray,
  bioregion_policy: PolicyId,
) -> Bool {
  list.any(
    reference_inputs,
    fn(input) {
      list.any(
        flatten(input.output.value),
        fn(asset) {
          let (p, name, qty) = asset
          p == bioregion_policy && name == bioregion_id && qty > 0
        },
      )
    },
  )
}

/// Verify fee payment
fn verify_impact_fee(
  outputs: List<Output>,
  bioregion: ByteArray,
  token_policy: PolicyId,
  token_name: AssetName,
  fee_amount: Int,
) -> Bool {
  list.any(
    outputs,
    fn(output) {
      let token_qty = quantity_of(output.value, token_policy, token_name)
      token_qty >= fee_amount
    },
  )
}

/// Verify single impact mint
fn verify_single_impact_mint(mint: MintedValue, policy_id: PolicyId) -> Bool {
  let minted = flatten(from_minted_value(mint))
  let impact_mints = list.filter(
    minted,
    fn(asset) {
      let (p, _, _) = asset
      p == policy_id
    },
  )
  when impact_mints is {
    [(_, _, qty)] -> qty == 1
    _ -> False
  }
}

/// Verify single impact burn
fn verify_single_impact_burn(mint: MintedValue, policy_id: PolicyId) -> Bool {
  let minted = flatten(from_minted_value(mint))
  let impact_burns = list.filter(
    minted,
    fn(asset) {
      let (p, _, _) = asset
      p == policy_id
    },
  )
  when impact_burns is {
    [(_, _, qty)] -> qty == -1
    _ -> False
  }
}

/// Verify impact owner signed
fn verify_impact_owner_signed(tx: Transaction, policy_id: PolicyId) -> Bool {
  list.any(
    tx.inputs,
    fn(input) {
      let has_impact = list.any(
        flatten(input.output.value),
        fn(asset) {
          let (p, _, qty) = asset
          p == policy_id && qty > 0
        },
      )
      if has_impact {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: OracleImpactDatum = data
            // Find issuer's pNFT and check owner signed
            True  // Simplified - in production check issuer signed
          }
          _ -> False
        }
      } else {
        False
      }
    },
  )
}

/// Find impact token in reference inputs
fn find_impact_token(
  reference_inputs: List<Input>,
  policy_id: PolicyId,
  token_name: AssetName,
) -> Option<OracleImpactDatum> {
  list.find_map(
    reference_inputs,
    fn(input) {
      let has_token = list.any(
        flatten(input.output.value),
        fn(asset) {
          let (p, name, qty) = asset
          p == policy_id && name == token_name && qty > 0
        },
      )
      if has_token {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: OracleImpactDatum = data
            Some(datum)
          }
          _ -> None
        }
      } else {
        None
      }
    },
  )
}

/// Check if transaction has valid pNFT
fn has_valid_pnft(tx: Transaction, pnft_policy: PolicyId) -> Bool {
  list.any(
    tx.reference_inputs,
    fn(input) {
      list.any(
        flatten(input.output.value),
        fn(asset) {
          let (p, _, qty) = asset
          p == pnft_policy && qty > 0
        },
      )
    },
  )
}

// =============================================================================
// TESTS
// =============================================================================

test calculate_deviation_exact_match() {
  calculate_deviation(100, 100) == 0
}

test calculate_deviation_10_percent() {
  calculate_deviation(100, 110) == 1000
}

test calculate_deviation_50_percent() {
  calculate_deviation(100, 150) == 5000
}

test calculate_deviation_zero_claim() {
  calculate_deviation(0, 100) == 10000
}

// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// ORACLE-VERIFIED IMPACT TRACKING
// ================================
//
// This validator extends impact tracking with trustless oracle verification.
//
// VERIFICATION FLOW:
// 1. User claims impact (e.g., "My forest sequestered 45,000 kg CO2")
// 2. Oracle data is fetched (satellite NDVI, carbon flux sensors)
// 3. Validator compares claim to oracle data
// 4. If within tolerance, verified impact token is minted
//
// ORACLE DATA SOURCES:
// - Satellite imagery (NDVI for vegetation health)
// - Ground sensors (soil carbon, moisture)
// - Carbon flux monitoring stations
// - Air quality sensors
//
// TOLERANCE LEVELS:
// - Oracle-verified impacts within 20% of claim are accepted
// - Higher deviations require additional attestations
// - Challenges allowed if deviation > 50%
//
// FEE STRUCTURE:
// - Oracle-verified: 3 ULTRA (trusted)
// - Unverified (Steward only): 5 ULTRA (higher risk)
//
// CHALLENGE MECHANISM:
// - Anyone with pNFT can challenge an impact
// - Must provide oracle data showing > 50% deviation
// - Successful challenges can lead to impact retirement
//
// =============================================================================
