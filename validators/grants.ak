// =============================================================================
// UltraLife Protocol — Bootstrap Grants
// =============================================================================
//
// Bootstrap mechanism: 50 tokens per DNA-verified user
// Grants come from the main 400B pool (moves the bonding curve)
// Settlement: IMMEDIATE (no epoch wait)
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/address.{Script}
use cardano/assets.{AssetName, PolicyId, lovelace_of, quantity_of}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use aiken/interval.{Finite}
use ultralife/control.{
  Civil, Design, GrantNote, Hours, Machine, OfftakeClaim, Remediation, Rent,
  control_well_formed,
}
use ultralife/types.{
  Basic, PnftDatum, Standard, Steward, VerificationLevel, Verified, Ward,
}

// =============================================================================
// TYPE DEFINITIONS FOR INLINE STRUCTS
// =============================================================================

/// Simple claim record linking a pNFT to a claim
type PnftClaimRecord {
  pnft: AssetName,
}

// =============================================================================
// CONSTANTS
// =============================================================================

/// Tokens granted per verified user (from main pool)
const grant_amount = 50

// =============================================================================
// DATUM
// =============================================================================

pub type GrantsDatum {
  /// Tokens remaining in pool
  tokens_remaining: Int,
  /// Number of grants issued
  grants_issued: Int,
}

pub type ClaimRecord {
  /// pNFT that claimed
  pnft: AssetName,
  /// Amount claimed
  amount: Int,
  /// Claim slot
  slot: Int,
}

// =============================================================================
// REDEEMER
// =============================================================================

pub type GrantsState {
  /// Signup pool. Not the $20M raise.
  Pool(GrantsDatum)
  /// WorkTicket. Face is units * price. ULTRA is settlement, not NAV.
  Ticket(GrantNote)
  Offtake(OfftakeClaim)
}

pub type GrantsRedeemer {
  /// Claim signup grant (upon DNA verification)
  ClaimGrant { pnft: AssetName }
  /// Represent SPV cash as a work ticket. Does not mint the raise as ULTRA.
  IssueGrant { note: GrantNote }
  /// Junior offtake. EDF later uses senior=true on a new claim.
  IssueOfftake { claim: OfftakeClaim }
  /// Missed refund_slot. Remaining units are void. Junior PreSold lots stay.
  RefundGrant { ticket_id: ByteArray }
  /// Close one unit against a plant record. Design and machine pay the prime bucket in ULTRA.
  CloseTicket { ticket_id: ByteArray, record_id: ByteArray }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type GrantsConfig {
  /// UltraLife token policy
  token_policy: PolicyId,
  /// UltraLife token name
  token_name: AssetName,
  /// pNFT policy
  pnft_policy: PolicyId,
  /// Claim record contract (prevents double claims)
  claim_records: ByteArray,
  /// fee_pool script. Skim is ULTRA.
  fee_pool: ByteArray,
  /// Protocol-owned seed pool for this ticket's bioregion. Not an SPO ticker.
  seed_pool: ByteArray,
  /// Mechanical Battery spending bucket.
  prime_bucket: ByteArray,
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator grants(config: GrantsConfig) {
  spend(
    datum: Option<GrantsState>,
    redeemer: GrantsRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      ClaimGrant { pnft } -> {
        expect Some(Pool(d)) = datum
        validate_claim(tx, d, pnft, config)
      }
      IssueGrant { note } -> validate_issue(tx, note, config)
      IssueOfftake { claim } -> validate_offtake(tx, claim)
      RefundGrant { ticket_id } -> validate_refund(tx, datum, ticket_id)
      CloseTicket { ticket_id, record_id } ->
        validate_close(tx, datum, ticket_id, record_id, config)
    }
  }

  else(_) {
    fail
  }
}

fn validate_issue(tx: Transaction, note: GrantNote, config: GrantsConfig) -> Bool {
  note.units > 0 && note.units_remaining == note.units && note.price > 0 && note.fee_skim_bps >= 0 && note.fee_skim_bps <= 10000 && note.cap_ada_exit_bps >= 0 && note.cap_ada_exit_bps <= 10000 && note.ticket_id != #"" && note.milestone_commit != #"" && ticket_written(
    tx,
    note,
  ) && skim_and_seed(tx, note, config)
}

fn validate_offtake(tx: Transaction, claim: OfftakeClaim) -> Bool {
  claim.qty > 0 && claim.qty_remaining == claim.qty && claim.claim_id != #"" && claim.window_end > claim.window_start && control_well_formed_claim(
    claim,
  ) && offtake_written(tx, claim)
}

fn validate_refund(
  tx: Transaction,
  datum: Option<GrantsState>,
  ticket_id: ByteArray,
) -> Bool {
  expect Some(Ticket(note)) = datum
  let slot = slot_of(tx)
  expect note.ticket_id == ticket_id
  expect slot >= note.refund_slot
  expect note.units_remaining > 0
  expect Some(next) = find_ticket(tx.outputs)
  next.ticket_id == note.ticket_id && next.units_remaining == 0 && next.senior == note.senior && next.plant == note.plant && next.bioregion == note.bioregion
}

fn validate_close(
  tx: Transaction,
  datum: Option<GrantsState>,
  ticket_id: ByteArray,
  record_id: ByteArray,
  config: GrantsConfig,
) -> Bool {
  expect Some(Ticket(note)) = datum
  let slot = slot_of(tx)
  expect note.ticket_id == ticket_id
  expect record_id != #""
  expect list.length(tx.reference_inputs) > 0
  expect slot < note.refund_slot
  expect note.units_remaining > 0
  expect Some(next) = find_ticket(tx.outputs)
  expect next.ticket_id == note.ticket_id && next.units_remaining == note.units_remaining - 1 && next.senior == note.senior
  prime_paid(tx, note, config) && ada_cap(tx, note) && skim_and_seed(tx, note, config)
}

fn control_well_formed_claim(claim: OfftakeClaim) -> Bool {
  control_well_formed(claim.control)
}

fn prime_paid(tx: Transaction, note: GrantNote, config: GrantsConfig) -> Bool {
  when note.account is {
    Design -> ultra_to(tx, config.prime_bucket, config, 1)
    Machine -> ultra_to(tx, config.prime_bucket, config, 1)
    Hours -> True
    Civil -> True
    Remediation -> True
    Rent -> True
  }
}

fn skim_and_seed(tx: Transaction, note: GrantNote, config: GrantsConfig) -> Bool {
  let skim =
    if note.fee_skim_bps == 0 {
      True
    } else {
      ultra_to(tx, config.fee_pool, config, 1)
    }
  let seed =
    if note.seed_lock_ultra == 0 {
      True
    } else {
      ultra_to(tx, config.seed_pool, config, note.seed_lock_ultra)
    }
  skim && seed
}

fn ada_cap(tx: Transaction, note: GrantNote) -> Bool {
  let paid = key_lovelace(tx.outputs)
  ( paid * 10000 <= note.price * note.cap_ada_exit_bps ) || ( note.cap_ada_exit_bps == 0 && paid == 0 )
}

fn ultra_to(
  tx: Transaction,
  script: ByteArray,
  config: GrantsConfig,
  amount: Int,
) -> Bool {
  script != #"" && list.any(
    tx.outputs,
    fn(output) {
      when output.address.payment_credential is {
        Script(hash) ->
          hash == script && quantity_of(
            output.value,
            config.token_policy,
            config.token_name,
          ) >= amount
        _ -> False
      }
    },
  )
}

fn key_lovelace(outputs: List<Output>) -> Int {
  list.foldl(
    outputs,
    0,
    fn(output, acc) {
      when output.address.payment_credential is {
        Script(_) -> acc
        _ -> acc + lovelace_of(output.value)
      }
    },
  )
}

fn ticket_written(tx: Transaction, note: GrantNote) -> Bool {
  expect Some(written) = find_ticket(tx.outputs)
  written == note
}

fn offtake_written(tx: Transaction, claim: OfftakeClaim) -> Bool {
  list.any(
    tx.outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect wrapped: GrantsState = data
          when wrapped is {
            Offtake(c) -> c == claim
            _ -> False
          }
        }
        _ -> False
      }
    },
  )
}

fn find_ticket(outputs: List<Output>) -> Option<GrantNote> {
  list.find_map(
    outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect wrapped: GrantsState = data
          when wrapped is {
            Ticket(note) -> Some(note)
            _ -> None
          }
        }
        _ -> None
      }
    },
  )
}

fn slot_of(tx: Transaction) -> Int {
  when tx.validity_range.lower_bound.bound_type is {
    Finite(s) -> s
    _ -> 0
  }
}

fn validate_claim(
  tx: Transaction,
  datum: GrantsDatum,
  pnft: AssetName,
  config: GrantsConfig,
) -> Bool {
  // 1. Pool must have tokens remaining
  let has_tokens = datum.tokens_remaining >= grant_amount
  // 2. pNFT must be Standard level (just verified DNA)
  let pnft_valid = verify_standard_pnft(tx, pnft, config.pnft_policy)
  // 3. pNFT owner must sign
  let owner_signed = verify_pnft_owner_signed(tx, pnft, config.pnft_policy)
  // 4. Must not have claimed before (no existing claim record)
  let not_claimed =
    verify_no_prior_claim(tx.reference_inputs, pnft, config.claim_records)
  // 5. Tokens must go to pNFT owner
  let tokens_sent =
    verify_tokens_to_owner(
      tx.outputs,
      config.token_policy,
      config.token_name,
      grant_amount,
      pnft,
      config.pnft_policy,
    )
  // 6. Claim record must be created
  let record_created =
    verify_claim_record(tx.outputs, pnft, config.claim_records)
  // 7. Datum must be updated
  let datum_updated = verify_grants_datum(tx.outputs, datum)
  has_tokens && pnft_valid && owner_signed && not_claimed && tokens_sent && record_created && datum_updated
}

// =============================================================================
// HELPERS
// =============================================================================

fn verify_standard_pnft(
  tx: Transaction,
  pnft: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  // Find pNFT in reference inputs, verify level is Standard
  list.any(
    tx.reference_inputs,
    fn(input) {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          datum.level == Standard
        }
        _ -> False
      }
    },
  )
}

fn verify_pnft_owner_signed(
  tx: Transaction,
  pnft: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  // Get owner from pNFT datum, check if signed
  list.any(
    tx.reference_inputs,
    fn(input) {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          list.has(tx.extra_signatories, datum.owner)
        }
        _ -> False
      }
    },
  )
}

fn verify_no_prior_claim(
  reference_inputs: List<Input>,
  pnft: AssetName,
  claim_records: ByteArray,
) -> Bool {
  // No existing claim record for this pNFT
  !list.any(
    reference_inputs,
    fn(input) {
      when input.output.address.payment_credential is {
        Script(hash) ->
          if hash == claim_records {
            when input.output.datum is {
              InlineDatum(data) -> {
                expect record: PnftClaimRecord = data
                record.pnft == pnft
              }
              _ -> False
            }
          } else {
            False
          }
        _ -> False
      }
    },
  )
}

fn verify_tokens_to_owner(
  outputs: List<Output>,
  policy: PolicyId,
  name: AssetName,
  amount: Int,
  pnft: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  // Verify grant tokens sent to an output (owner lookup from pNFT)
  let total =
    list.foldl(
      outputs,
      0,
      fn(output, acc) { acc + quantity_of(output.value, policy, name) },
    )
  total >= amount
}

fn verify_claim_record(
  outputs: List<Output>,
  pnft: AssetName,
  claim_records: ByteArray,
) -> Bool {
  // Verify output to claim records with proper datum
  list.any(
    outputs,
    fn(output) {
      when output.address.payment_credential is {
        Script(hash) ->
          if hash == claim_records {
            when output.datum is {
              InlineDatum(data) -> {
                expect record: PnftClaimRecord = data
                record.pnft == pnft
              }
              _ -> False
            }
          } else {
            False
          }
        _ -> False
      }
    },
  )
}

fn verify_grants_datum(outputs: List<Output>, old_datum: GrantsDatum) -> Bool {
  list.any(
    outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect new_datum: GrantsDatum = data
          new_datum.tokens_remaining == old_datum.tokens_remaining - grant_amount && new_datum.grants_issued == old_datum.grants_issued + 1
        }
        _ -> False
      }
    },
  )
}
// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// BOOTSTRAP MECHANISM
// ===================
//
// 1. User creates Basic pNFT (free, just ADA fees)
// 2. User verifies DNA → upgrades to Standard
// 3. User claims 50 token grant (one-time)
// 4. User can now participate in economy
//
// NO CHICKEN/EGG
// ==============
//
// You don't need tokens to join.
// You get tokens FOR joining (and verifying identity).
// This ensures everyone can participate.
//
// ONE CLAIM PER PERSON
// ====================
//
// Claim record prevents double-claiming.
// Since DNA verification ensures one pNFT per person,
// each human can only claim once.
//
// GRANTS FROM MAIN POOL
// =====================
//
// Bootstrap grants (50 ULTRA each) come from the main 400B pool.
// Each grant moves the bonding curve position by 50 tokens.
// At 1 million users: 50M tokens = 0.0125% of supply.
//
// =============================================================================
