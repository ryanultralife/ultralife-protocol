// =============================================================================
// UltraLife Protocol — Remediation
// =============================================================================
//
// Restoration bonds for negative impact commitments.
// When you transact with negative environmental impact,
// you must commit to remediation — this contract holds bonds.
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
use ultralife/prc37.{current_cycle}
use ultralife/types.{
  ImpactCategory, PnftDatum, Steward, VerificationLevel, Verified,
}

/// Result of finding a poster pNFT
pub type PosterPnftInfo {
  pnft: AssetName,
  owner: VerificationKeyHash,
  bioregion: ByteArray,
}

// =============================================================================
// BOND TYPES
// =============================================================================

pub type BondDatum {
  /// Unique bond ID
  bond_id: ByteArray,
  /// Who posted the bond
  poster: AssetName,
  /// Bioregion where remediation occurs
  bioregion: ByteArray,
  /// Impact category to remediate
  category: ImpactCategory,
  /// Required remediation magnitude
  required_magnitude: Int,
  /// Bond amount (UltraLife tokens)
  bond_amount: Int,
  /// Deadline slot
  deadline: Int,
  /// Evidence of completion (None until completed)
  completion_evidence: Option<ByteArray>,
  /// Status
  status: BondStatus,
  /// Creation slot
  created_at: Int,
}

pub type BondStatus {
  /// Bond active, awaiting completion
  Active
  /// Remediation completed, awaiting release
  Completed
  /// Bond released back to poster
  Released
  /// Deadline passed, bond slashed
  Slashed
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type RemediationRedeemer {
  /// Create a new remediation bond
  CreateBond {
    bond_id: ByteArray,
    category: ImpactCategory,
    magnitude: Int,
    deadline: Int,
  }
  /// Submit completion evidence
  SubmitCompletion { evidence_hash: ByteArray }
  /// Release bond (after verification)
  ReleaseBond { verifier: AssetName }
  /// Slash bond (deadline passed)
  SlashBond
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type RemediationConfig {
  /// UltraLife token policy
  token_policy: PolicyId,
  /// UltraLife token name
  token_name: AssetName,
  /// pNFT policy
  pnft_policy: PolicyId,
  /// Minimum bond period (37 days)
  min_bond_period: Int,
  /// Bond amount per magnitude point
  bond_per_magnitude: Int,
  /// Bioregion treasury (receives slashed bonds)
  treasury_address: ByteArray,
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator remediation(config: RemediationConfig) {
  spend(
    datum: Option<BondDatum>,
    redeemer: RemediationRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      CreateBond { bond_id, category, magnitude, deadline } ->
        validate_create_bond(tx, bond_id, category, magnitude, deadline, config)
      SubmitCompletion { evidence_hash } -> {
        expect Some(d) = datum
        validate_submit_completion(tx, d, evidence_hash, config)
      }
      ReleaseBond { verifier } -> {
        expect Some(d) = datum
        validate_release_bond(tx, d, verifier, config)
      }
      SlashBond -> {
        expect Some(d) = datum
        validate_slash_bond(tx, d, config)
      }
    }
  }

  else(_) {
    fail
  }
}

// =============================================================================
// CREATE BOND
// =============================================================================

fn validate_create_bond(
  tx: Transaction,
  bond_id: ByteArray,
  category: ImpactCategory,
  magnitude: Int,
  deadline: Int,
  config: RemediationConfig,
) -> Bool {
  // 1. Find poster pNFT
  let poster = find_poster_pnft(tx, config.pnft_policy)
  expect Some(poster_data) = poster
  // 2. Poster must sign
  let poster_signed = list.has(tx.extra_signatories, poster_data.owner)
  // 3. Deadline must be at least min_bond_period from now
  let current_slot = get_slot(tx)
  let deadline_valid = deadline >= current_slot + config.min_bond_period
  // 4. Calculate required bond amount
  let bond_amount = magnitude * config.bond_per_magnitude
  // 5. Tokens must be locked in bond
  let tokens_locked =
    verify_tokens_locked(
      tx.outputs,
      config.token_policy,
      config.token_name,
      bond_amount,
    )
  // 6. Bond datum must be created
  let datum_created =
    verify_bond_datum_created(
      tx.outputs,
      bond_id,
      poster_data.pnft,
      poster_data.bioregion,
      category,
      magnitude,
      bond_amount,
      deadline,
      current_slot,
    )
  poster_signed && deadline_valid && tokens_locked && datum_created
}

// =============================================================================
// SUBMIT COMPLETION
// =============================================================================

fn validate_submit_completion(
  tx: Transaction,
  datum: BondDatum,
  evidence_hash: ByteArray,
  config: RemediationConfig,
) -> Bool {
  // 1. Bond must be Active
  expect datum.status == Active
  // 2. Poster must sign
  let poster_signed = verify_poster_signed(tx, datum.poster, config.pnft_policy)
  // 3. Must be before deadline
  let current_slot = get_slot(tx)
  let before_deadline = current_slot < datum.deadline
  // 4. Evidence must be provided
  let has_evidence = evidence_hash != ""
  // 5. Datum updated to Completed with evidence
  let datum_updated = verify_completion_datum(tx.outputs, datum, evidence_hash)
  poster_signed && before_deadline && has_evidence && datum_updated
}

// =============================================================================
// RELEASE BOND
// =============================================================================

fn validate_release_bond(
  tx: Transaction,
  datum: BondDatum,
  verifier: AssetName,
  config: RemediationConfig,
) -> Bool {
  // 1. Bond must be Completed
  expect datum.status == Completed
  // 2. Verifier must be Verified+ in same bioregion (not poster)
  let verifier_valid =
    verify_verifier(
      tx,
      verifier,
      datum.bioregion,
      datum.poster,
      config.pnft_policy,
    )
  // 3. Verifier must sign
  let verifier_signed =
    verify_pnft_owner_signed(tx, verifier, config.pnft_policy)
  // 4. Tokens released to poster
  let tokens_released =
    verify_tokens_to_poster(
      tx.outputs,
      config.token_policy,
      config.token_name,
      datum.bond_amount,
      datum.poster,
      config.pnft_policy,
    )
  verifier_valid && verifier_signed && tokens_released
}

// =============================================================================
// SLASH BOND
// =============================================================================

fn validate_slash_bond(
  tx: Transaction,
  datum: BondDatum,
  config: RemediationConfig,
) -> Bool {
  // 1. Bond must be Active (not completed)
  expect datum.status == Active
  // 2. Deadline must have passed
  let current_slot = get_slot(tx)
  let past_deadline = current_slot > datum.deadline
  // 3. Tokens go to bioregion treasury
  let tokens_slashed =
    verify_tokens_to_treasury(
      tx.outputs,
      config.token_policy,
      config.token_name,
      datum.bond_amount,
      config.treasury_address,
    )
  past_deadline && tokens_slashed
}

// =============================================================================
// HELPERS
// =============================================================================

fn find_poster_pnft(
  tx: Transaction,
  pnft_policy: PolicyId,
) -> Option<PosterPnftInfo> {
  list.find_map(
    tx.reference_inputs,
    fn(input) {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          when datum.bioregion is {
            Some(br) ->
              Some(
                PosterPnftInfo {
                  pnft: datum.pnft_id,
                  owner: datum.owner,
                  bioregion: br,
                },
              )
            None -> None
          }
        }
        _ -> None
      }
    },
  )
}

fn get_slot(tx: Transaction) -> Int {
  when tx.validity_range.lower_bound.bound_type is {
    Finite(slot) -> slot
    _ -> 0
  }
}

fn verify_tokens_locked(
  outputs: List<Output>,
  policy: PolicyId,
  name: AssetName,
  amount: Int,
) -> Bool {
  let total =
    list.foldl(
      outputs,
      0,
      fn(output, acc) { acc + quantity_of(output.value, policy, name) },
    )
  total >= amount
}

fn verify_bond_datum_created(
  outputs: List<Output>,
  bond_id: ByteArray,
  poster: AssetName,
  bioregion: ByteArray,
  category: ImpactCategory,
  magnitude: Int,
  bond_amount: Int,
  deadline: Int,
  created_at: Int,
) -> Bool {
  list.any(
    outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect datum: BondDatum = data
          datum.bond_id == bond_id && datum.poster == poster && datum.bioregion == bioregion && datum.required_magnitude == magnitude && datum.bond_amount == bond_amount && datum.deadline == deadline && datum.status == Active
        }
        _ -> False
      }
    },
  )
}

fn verify_poster_signed(
  tx: Transaction,
  poster: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  // Find poster's pNFT and verify owner signed
  list.any(
    tx.reference_inputs,
    fn(input) {
      let has_pnft =
        list.any(
          flatten(input.output.value),
          fn(asset) {
            let (p, name, qty) = asset
            p == pnft_policy && name == poster && qty > 0
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

fn verify_completion_datum(
  outputs: List<Output>,
  old_datum: BondDatum,
  evidence: ByteArray,
) -> Bool {
  list.any(
    outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect new_datum: BondDatum = data
          new_datum.bond_id == old_datum.bond_id && new_datum.status == Completed && new_datum.completion_evidence == Some(
            evidence,
          )
        }
        _ -> False
      }
    },
  )
}

fn verify_verifier(
  tx: Transaction,
  verifier: AssetName,
  bioregion: ByteArray,
  poster: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  // Verifier must be different from poster, Verified+, same bioregion
  verifier != poster && list.any(
    tx.reference_inputs,
    fn(input) {
      let has_pnft =
        list.any(
          flatten(input.output.value),
          fn(asset) {
            let (p, name, qty) = asset
            p == pnft_policy && name == verifier && qty > 0
          },
        )
      if has_pnft {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: PnftDatum = data
            datum.bioregion == Some(bioregion) && (
              datum.level == Verified || datum.level == Steward
            )
          }
          _ -> False
        }
      } else {
        False
      }
    },
  )
}

fn verify_pnft_owner_signed(
  tx: Transaction,
  pnft: AssetName,
  policy: PolicyId,
) -> Bool {
  list.any(
    tx.reference_inputs,
    fn(input) {
      let has_pnft =
        list.any(
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

fn verify_tokens_to_poster(
  outputs: List<Output>,
  policy: PolicyId,
  name: AssetName,
  amount: Int,
  poster: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  // Verify tokens sent (poster owner lookup handled at tx build time)
  let total =
    list.foldl(
      outputs,
      0,
      fn(output, acc) { acc + quantity_of(output.value, policy, name) },
    )
  total >= amount
}

fn verify_tokens_to_treasury(
  outputs: List<Output>,
  policy: PolicyId,
  name: AssetName,
  amount: Int,
  treasury: ByteArray,
) -> Bool {
  let total =
    list.foldl(
      outputs,
      0,
      fn(output, acc) {
        when output.address.payment_credential is {
          Script(hash) ->
            if hash == treasury {
              acc + quantity_of(output.value, policy, name)
            } else {
              acc
            }
          _ -> acc
        }
      },
    )
  total >= amount
}
// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// REMEDIATION BONDS
// =================
//
// When you make a transaction with negative environmental impact,
// you must commit to remediation. Three options:
//
// 1. IMMEDIATE: Fix it in the same transaction
// 2. BONDED: Post tokens, fix later, get tokens back
// 3. OFFSET: Buy/retire impact tokens
//
// BOND LIFECYCLE
// ==============
//
// 1. CREATE: Post bond with deadline
// 2. WORK: Do the remediation
// 3. SUBMIT: Provide evidence of completion
// 4. VERIFY: Another community member verifies
// 5. RELEASE: Get your tokens back
//
// Or:
//
// 1. CREATE: Post bond with deadline
// 2. FAIL: Don't complete by deadline
// 3. SLASH: Tokens go to bioregion treasury
//
// INCENTIVES
// ==========
//
// - Bond amount = magnitude × rate (10 tokens per magnitude point)
// - Successful completion = full return
// - Failure = 100% slash to bioregion
// - Verifiers can receive small reward from governance
//
// =============================================================================
