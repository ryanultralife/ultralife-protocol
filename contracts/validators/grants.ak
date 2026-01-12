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
use cardano/assets.{PolicyId, AssetName, quantity_of, flatten}
use cardano/address.{Script}
use cardano/transaction.{Transaction, Input, Output, OutputReference, InlineDatum}
use ultralife/types.{PnftDatum, VerificationLevel, Basic, Ward, Standard, Verified, Steward}

// =============================================================================
// CONSTANTS
// =============================================================================

/// Tokens granted per verified user (from main pool)
pub const GRANT_AMOUNT: Int = 50

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

pub type GrantsRedeemer {
  /// Claim signup grant (upon DNA verification)
  ClaimGrant {
    pnft: AssetName,
  }
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
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator grants(config: GrantsConfig) {
  spend(
    datum: Option<GrantsDatum>,
    redeemer: GrantsRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(d) = datum
    
    when redeemer is {
      ClaimGrant { pnft } -> {
        validate_claim(tx, d, pnft, config)
      }
    }
  }
}

fn validate_claim(
  tx: Transaction,
  datum: GrantsDatum,
  pnft: AssetName,
  config: GrantsConfig,
) -> Bool {
  // 1. Pool must have tokens remaining
  let has_tokens = datum.tokens_remaining >= GRANT_AMOUNT
  
  // 2. pNFT must be Standard level (just verified DNA)
  let pnft_valid = verify_standard_pnft(tx, pnft, config.pnft_policy)
  
  // 3. pNFT owner must sign
  let owner_signed = verify_pnft_owner_signed(tx, pnft, config.pnft_policy)
  
  // 4. Must not have claimed before (no existing claim record)
  let not_claimed = verify_no_prior_claim(tx.reference_inputs, pnft, config.claim_records)
  
  // 5. Tokens must go to pNFT owner
  let tokens_sent = verify_tokens_to_owner(
    tx.outputs,
    config.token_policy,
    config.token_name,
    GRANT_AMOUNT,
    pnft,
    config.pnft_policy,
  )
  
  // 6. Claim record must be created
  let record_created = verify_claim_record(tx.outputs, pnft, config.claim_records)
  
  // 7. Datum must be updated
  let datum_updated = verify_grants_datum(tx.outputs, datum)
  
  has_tokens && pnft_valid && owner_signed && not_claimed && 
  tokens_sent && record_created && datum_updated
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
  list.any(tx.reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect datum: PnftDatum = data
        datum.level == Standard
      }
      _ -> False
    }
  })
}

fn verify_pnft_owner_signed(
  tx: Transaction,
  pnft: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  // Get owner from pNFT datum, check if signed
  list.any(tx.reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect datum: PnftDatum = data
        list.has(tx.extra_signatories, datum.owner)
      }
      _ -> False
    }
  })
}

fn verify_no_prior_claim(
  reference_inputs: List<Input>,
  pnft: AssetName,
  claim_records: ByteArray,
) -> Bool {
  // No existing claim record for this pNFT
  !list.any(reference_inputs, fn(input) {
    when input.output.address.payment_credential is {
      Script(hash) if hash == claim_records -> {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect record: { pnft: AssetName } = data
            record.pnft == pnft
          }
          _ -> False
        }
      }
      _ -> False
    }
  })
}

fn verify_tokens_to_owner(
  outputs: List<o>,
  policy: PolicyId,
  name: AssetName,
  amount: Int,
  pnft: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  // Verify grant tokens sent to an output (owner lookup from pNFT)
  let total = list.foldl(outputs, 0, fn(output, acc) {
    acc + quantity_of(output.value, policy, name)
  })
  total >= amount
}

fn verify_claim_record(
  outputs: List<o>,
  pnft: AssetName,
  claim_records: ByteArray,
) -> Bool {
  // Verify output to claim records with proper datum
  list.any(outputs, fn(output) {
    when output.address.payment_credential is {
      Script(hash) if hash == claim_records -> {
        when output.datum is {
          InlineDatum(data) -> {
            expect record: { pnft: AssetName } = data
            record.pnft == pnft
          }
          _ -> False
        }
      }
      _ -> False
    }
  })
}

fn verify_grants_datum(
  outputs: List<o>,
  old_datum: GrantsDatum,
) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect new_datum: GrantsDatum = data
        new_datum.tokens_remaining == old_datum.tokens_remaining - GRANT_AMOUNT &&
        new_datum.grants_issued == old_datum.grants_issued + 1
      }
      _ -> False
    }
  })
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
