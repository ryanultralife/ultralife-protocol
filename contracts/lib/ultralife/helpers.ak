// =============================================================================
// UltraLife Protocol — Shared Helpers
// =============================================================================
//
// Common utility functions used across validators.
// These eliminate placeholder implementations.
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId, AssetName, Value, flatten, quantity_of}
use cardano/address.{Address, Credential, VerificationKey, Script}
use cardano/transaction.{
  Transaction, Input, Output, OutputReference, 
  InlineDatum, Datum, NoDatum, DatumHash,
  ValidityRange, IntervalBound, IntervalBoundType,
}
use ultralife/types.{
  PnftDatum, VerificationLevel, Basic, Standard, Verified, Steward,
}

// =============================================================================
// SLOT EXTRACTION
// =============================================================================

/// Extract current slot from transaction validity range
/// Uses lower bound as the "current" slot
pub fn get_current_slot(tx: Transaction) -> Int {
  when tx.validity_range.lower_bound.bound_type is {
    Finite(slot) -> slot
    NegativeInfinity -> 0
    PositiveInfinity -> 0  // Shouldn't happen for lower bound
  }
}

/// Get upper bound slot (deadline)
pub fn get_deadline_slot(tx: Transaction) -> Int {
  when tx.validity_range.upper_bound.bound_type is {
    Finite(slot) -> slot
    PositiveInfinity -> 9999999999  // Far future
    NegativeInfinity -> 0  // Shouldn't happen for upper bound
  }
}

// =============================================================================
// ASSET HELPERS
// =============================================================================

/// Get all assets under a specific policy
pub fn get_policy_assets(value: Value, policy: PolicyId) -> List<(AssetName, Int)> {
  list.filter_map(flatten(value), fn(asset) {
    let (p, name, qty) = asset
    if p == policy {
      Some((name, qty))
    } else {
      None
    }
  })
}

/// Check if value contains any token from a policy
pub fn has_policy_token(value: Value, policy: PolicyId) -> Bool {
  list.any(flatten(value), fn(asset) {
    let (p, _, qty) = asset
    p == policy && qty > 0
  })
}

/// Get quantity of specific token
pub fn get_token_quantity(value: Value, policy: PolicyId, name: AssetName) -> Int {
  quantity_of(value, policy, name)
}

/// Check if minting exactly one token
pub fn is_single_mint(mint: Value, policy: PolicyId) -> Bool {
  let policy_tokens = get_policy_assets(mint, policy)
  when policy_tokens is {
    [(_, qty)] -> qty == 1
    _ -> False
  }
}

/// Check if burning exactly one token
pub fn is_single_burn(mint: Value, policy: PolicyId) -> Bool {
  let policy_tokens = get_policy_assets(mint, policy)
  when policy_tokens is {
    [(_, qty)] -> qty == -1
    _ -> False
  }
}

// =============================================================================
// pNFT HELPERS
// =============================================================================

/// Data extracted from a pNFT
pub type PnftData {
  pnft: AssetName,
  owner: VerificationKeyHash,
  level: VerificationLevel,
  bioregion: Option<ByteArray>,
}

/// Find pNFT in inputs owned by a signer
pub fn find_pnft_in_inputs(
  inputs: List<Input>,
  pnft_policy: PolicyId,
  signers: List<VerificationKeyHash>,
) -> Option<PnftData> {
  list.find_map(inputs, fn(input) {
    extract_pnft_if_signer(input.output, pnft_policy, signers)
  })
}

/// Find pNFT in reference inputs owned by a signer
pub fn find_pnft_in_references(
  refs: List<Input>,
  pnft_policy: PolicyId,
  signers: List<VerificationKeyHash>,
) -> Option<PnftData> {
  list.find_map(refs, fn(input) {
    extract_pnft_if_signer(input.output, pnft_policy, signers)
  })
}

/// Find pNFT by asset name in reference inputs
pub fn find_pnft_by_name(
  refs: List<Input>,
  pnft_policy: PolicyId,
  pnft_name: AssetName,
) -> Option<PnftData> {
  list.find_map(refs, fn(input) {
    let assets = get_policy_assets(input.output.value, pnft_policy)
    when assets is {
      [(name, qty), ..] if name == pnft_name && qty > 0 -> {
        extract_pnft_datum(input.output)
      }
      _ -> None
    }
  })
}

/// Extract pNFT data if owner is a signer
fn extract_pnft_if_signer(
  output: Output,
  pnft_policy: PolicyId,
  signers: List<VerificationKeyHash>,
) -> Option<PnftData> {
  let assets = get_policy_assets(output.value, pnft_policy)
  when assets is {
    [(name, qty), ..] if qty > 0 -> {
      when output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          if list.has(signers, datum.owner) {
            Some(PnftData {
              pnft: name,
              owner: datum.owner,
              level: datum.level,
              bioregion: datum.bioregion,
            })
          } else {
            None
          }
        }
        _ -> None
      }
    }
    _ -> None
  }
}

/// Extract pNFT data from output (no signer check)
fn extract_pnft_datum(output: Output) -> Option<PnftData> {
  when output.datum is {
    InlineDatum(data) -> {
      expect datum: PnftDatum = data
      // Get the asset name from the value
      Some(PnftData {
        pnft: datum.pnft_id,
        owner: datum.owner,
        level: datum.level,
        bioregion: datum.bioregion,
      })
    }
    _ -> None
  }
}

/// Check if pNFT owner signed the transaction
pub fn pnft_owner_signed(
  tx: Transaction,
  pnft_name: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  // Find the pNFT in inputs or references
  let in_inputs = find_pnft_by_name(tx.inputs, pnft_policy, pnft_name)
  let in_refs = find_pnft_by_name(tx.reference_inputs, pnft_policy, pnft_name)
  
  when (in_inputs, in_refs) is {
    (Some(data), _) -> list.has(tx.extra_signatories, data.owner)
    (_, Some(data)) -> list.has(tx.extra_signatories, data.owner)
    _ -> False
  }
}

// =============================================================================
// ADDRESS HELPERS
// =============================================================================

/// Check if address is a specific script
pub fn is_script_address(address: Address, script_hash: ByteArray) -> Bool {
  when address.payment_credential is {
    Script(hash) -> hash == script_hash
    _ -> False
  }
}

/// Check if address is a specific key
pub fn is_key_address(address: Address, key_hash: VerificationKeyHash) -> Bool {
  when address.payment_credential is {
    VerificationKey(hash) -> hash == key_hash
    _ -> False
  }
}

/// Get script hash from address (if script)
pub fn get_script_hash(address: Address) -> Option<ByteArray> {
  when address.payment_credential is {
    Script(hash) -> Some(hash)
    _ -> None
  }
}

// =============================================================================
// OUTPUT HELPERS
// =============================================================================

/// Find outputs to a specific script address
pub fn outputs_to_script(
  outputs: List<Output>,
  script_hash: ByteArray,
) -> List<Output> {
  list.filter(outputs, fn(output) {
    is_script_address(output.address, script_hash)
  })
}

/// Find outputs to a specific key address
pub fn outputs_to_key(
  outputs: List<Output>,
  key_hash: VerificationKeyHash,
) -> List<Output> {
  list.filter(outputs, fn(output) {
    is_key_address(output.address, key_hash)
  })
}

/// Find outputs containing specific token
pub fn outputs_with_token(
  outputs: List<Output>,
  policy: PolicyId,
  name: AssetName,
) -> List<Output> {
  list.filter(outputs, fn(output) {
    get_token_quantity(output.value, policy, name) > 0
  })
}

/// Sum token quantity across outputs
pub fn sum_token_in_outputs(
  outputs: List<Output>,
  policy: PolicyId,
  name: AssetName,
) -> Int {
  list.foldl(outputs, 0, fn(output, acc) {
    acc + get_token_quantity(output.value, policy, name)
  })
}

/// Verify tokens sent to address
pub fn verify_tokens_to_address(
  outputs: List<Output>,
  policy: PolicyId,
  name: AssetName,
  amount: Int,
  recipient: VerificationKeyHash,
) -> Bool {
  let recipient_outputs = outputs_to_key(outputs, recipient)
  let total = sum_token_in_outputs(recipient_outputs, policy, name)
  total >= amount
}

/// Verify tokens sent to script
pub fn verify_tokens_to_script(
  outputs: List<Output>,
  policy: PolicyId,
  name: AssetName,
  amount: Int,
  script_hash: ByteArray,
) -> Bool {
  let script_outputs = outputs_to_script(outputs, script_hash)
  let total = sum_token_in_outputs(script_outputs, policy, name)
  total >= amount
}

// =============================================================================
// DATUM HELPERS
// =============================================================================

/// Extract inline datum as specific type
pub fn get_inline_datum<a>(output: Output) -> Option<a> {
  when output.datum is {
    InlineDatum(data) -> {
      expect typed: a = data
      Some(typed)
    }
    _ -> None
  }
}

/// Check if output has inline datum
pub fn has_inline_datum(output: Output) -> Bool {
  when output.datum is {
    InlineDatum(_) -> True
    _ -> False
  }
}

// =============================================================================
// VERIFICATION HELPERS
// =============================================================================

/// Check if level is at least the required level
pub fn level_at_least(actual: VerificationLevel, required: VerificationLevel) -> Bool {
  let actual_weight = level_weight(actual)
  let required_weight = level_weight(required)
  actual_weight >= required_weight
}

fn level_weight(level: VerificationLevel) -> Int {
  when level is {
    Basic -> 0
    Standard -> 1
    Verified -> 2
    Steward -> 3
  }
}

/// Check if pNFT is in a specific bioregion
pub fn pnft_in_bioregion(
  tx: Transaction,
  pnft_name: AssetName,
  bioregion: ByteArray,
  pnft_policy: PolicyId,
) -> Bool {
  let pnft_data = find_pnft_by_name(tx.reference_inputs, pnft_policy, pnft_name)
  when pnft_data is {
    Some(data) -> data.bioregion == Some(bioregion)
    None -> {
      // Check inputs too
      let in_inputs = find_pnft_by_name(tx.inputs, pnft_policy, pnft_name)
      when in_inputs is {
        Some(d) -> d.bioregion == Some(bioregion)
        None -> False
      }
    }
  }
}

// =============================================================================
// INPUT HELPERS
// =============================================================================

/// Check if a specific UTXO is spent
pub fn utxo_spent(inputs: List<Input>, utxo: OutputReference) -> Bool {
  list.any(inputs, fn(input) {
    input.output_reference == utxo
  })
}

/// Find input by output reference
pub fn find_input(inputs: List<Input>, ref: OutputReference) -> Option<Input> {
  list.find(inputs, fn(input) {
    input.output_reference == ref
  })
}

/// Count inputs from a specific script
pub fn count_script_inputs(inputs: List<Input>, script_hash: ByteArray) -> Int {
  list.foldl(inputs, 0, fn(input, acc) {
    if is_script_address(input.output.address, script_hash) {
      acc + 1
    } else {
      acc
    }
  })
}
