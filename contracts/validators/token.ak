// =============================================================================
// UltraLife Protocol — Token Validator
// =============================================================================
//
// LAYER 3: ECONOMY (THE CORE CONTRACT)
//
// THIS IS THE HEART OF ULTRALIFE.
//
// Every UltraLife token transaction MUST include:
// 1. Valid pNFT (WHO is transacting)
// 2. Bioregion assignment (WHERE they are)
// 3. Transaction type (WHAT kind of activity)
// 4. Impact declaration (PHYSICAL CONSEQUENCE — cannot be empty)
// 5. Valid recipient (must have pNFT — no anonymous transfers)
// 6. Evidence hash (IPFS link to measurement methodology)
//
// Every transaction CREATES on-chain data that drives UBI distribution.
// The token IS the economy. The transaction IS the data.
// Impact IS universal. There is no "neutral."
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash, Blake2b_256, Hash}
use cardano/assets.{PolicyId, AssetName, Value, quantity_of, flatten}
use cardano/address.{Address, Credential, VerificationKey, Script}
use cardano/transaction.{
  Transaction, Input, Output, OutputReference, Mint,
  InlineDatum, ScriptPurpose, Spend,
}
use ultralife/types.{
  VerificationLevel, Basic, Standard, Verified, Steward,
  PnftDatum, TransactionType, TransactionMeta, TransactionRecord,
  Impact, ImpactCategory, BondDatum,
  StakeReward, ImpactTrade,
  tx_type_code, can_transact,
}
use ultralife/prc37.{current_cycle}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type TokenConfig {
  /// UltraLife token policy ID
  policy_id: PolicyId,
  /// UltraLife token asset name
  asset_name: AssetName,
  /// pNFT policy for identity verification
  pnft_policy: PolicyId,
  /// Transaction record contract address
  record_contract: ByteArray,
  /// UBI contract (can distribute without normal rules)
  ubi_contract: ByteArray,
  /// Treasury contract (can mint/distribute)
  treasury_contract: ByteArray,
  /// Grants contract (can distribute signup grants)
  grants_contract: ByteArray,
  /// Remediation contract (for bonds)
  remediation_contract: ByteArray,
}

// =============================================================================
// THE SPENDING VALIDATOR
// =============================================================================

/// Every token spend must satisfy the rules of the transparent economy
validator token(config: TokenConfig) {
  spend(
    datum: Option<Data>,
    redeemer: TransactionMeta,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    let current_slot = get_slot(tx)
    let cycle = current_cycle(current_slot)
    
    // =========================================================================
    // SPECIAL CASES: System distributions bypass normal rules
    // =========================================================================
    
    when redeemer.tx_type is {
      // UBI distribution comes from system, not user
      UBI { .. } -> {
        verify_from_system_contract(tx.inputs, config.ubi_contract)
      }
      
      // Governance rewards come from system
      GovernanceReward { .. } -> {
        verify_from_system_contract(tx.inputs, config.ubi_contract)
      }
      
      // Internal transfers (same owner reorganizing UTXOs)
      Internal -> {
        validate_internal_transfer(tx, config)
      }
      
      // All other transaction types: FULL VALIDATION
      _ -> {
        validate_economic_transaction(tx, redeemer, config, cycle)
      }
    }
  }
}

// =============================================================================
// FULL ECONOMIC TRANSACTION VALIDATION
// =============================================================================

fn validate_economic_transaction(
  tx: Transaction,
  meta: TransactionMeta,
  config: TokenConfig,
  cycle: Int,
) -> Bool {
  // =========================================================================
  // RULE 1: SENDER MUST HAVE VALID pNFT
  // =========================================================================
  let sender_pnft = find_sender_pnft(tx, config.pnft_policy)
  expect Some(sender) = sender_pnft
  
  // =========================================================================
  // RULE 2: SENDER MUST BE ABLE TO TRANSACT (Standard+)
  // =========================================================================
  expect can_transact(sender.level)
  
  // =========================================================================
  // RULE 3: SENDER MUST HAVE BIOREGION ASSIGNMENT
  // =========================================================================
  expect Some(sender_bioregion) = sender.bioregion
  
  // =========================================================================
  // RULE 4: SENDER MUST SIGN THE TRANSACTION
  // =========================================================================
  let sender_signed = list.has(tx.extra_signatories, sender.owner)
  
  // =========================================================================
  // RULE 5: ALL TOKEN RECIPIENTS MUST HAVE pNFTs (NO ANONYMOUS TRANSFERS)
  // =========================================================================
  let token_outputs = find_token_outputs(tx.outputs, config.policy_id, config.asset_name)
  let all_recipients_valid = list.all(token_outputs, fn(output) {
    verify_recipient_has_pnft(output, tx, config.pnft_policy, config)
  })
  
  // =========================================================================
  // RULE 6: TRANSACTION METADATA MUST BE VALID
  // =========================================================================
  let meta_valid = validate_metadata(meta)
  
  // =========================================================================
  // RULE 7: NEGATIVE IMPACT REQUIRES REMEDIATION COMMITMENT
  // =========================================================================
  let remediation_valid = validate_remediation(meta.impact, tx, config)
  
  // =========================================================================
  // RULE 8: TRANSACTION RECORD MUST BE CREATED
  // =========================================================================
  let record_created = verify_record_created(
    tx,
    sender,
    meta,
    cycle,
    config,
  )
  
  // =========================================================================
  // ALL RULES MUST PASS
  // =========================================================================
  sender_signed &&
  all_recipients_valid &&
  meta_valid &&
  remediation_valid &&
  record_created
}

// =============================================================================
// RULE 1: FIND SENDER pNFT
// =============================================================================

/// Sender data extracted from pNFT
type SenderData {
  pnft_id: AssetName,
  owner: VerificationKeyHash,
  level: VerificationLevel,
  bioregion: Option<ByteArray>,
}

fn find_sender_pnft(tx: Transaction, pnft_policy: PolicyId) -> Option<SenderData> {
  // Look through inputs and reference inputs for pNFT owned by a signer
  
  // First check inputs (pNFT might be spent for update)
  let from_inputs = list.find_map(tx.inputs, fn(input) {
    extract_pnft_if_signer(input.output, pnft_policy, tx.extra_signatories)
  })
  
  when from_inputs is {
    Some(data) -> Some(data)
    None -> {
      // Check reference inputs (pNFT just referenced, not spent)
      list.find_map(tx.reference_inputs, fn(input) {
        extract_pnft_if_signer(input.output, pnft_policy, tx.extra_signatories)
      })
    }
  }
}

fn extract_pnft_if_signer(
  output: Output,
  pnft_policy: PolicyId,
  signers: List<VerificationKeyHash>,
) -> Option<SenderData> {
  // Check if output has pNFT
  let pnft_assets = get_assets_of_policy(output.value, pnft_policy)
  
  when pnft_assets is {
    [] -> None
    [(asset_name, quantity), ..] -> {
      if quantity > 0 {
        // Extract datum
        when output.datum is {
          InlineDatum(data) -> {
            expect datum: PnftDatum = data
            // Check if owner is a signer
            if list.has(signers, datum.owner) {
              Some(SenderData {
                pnft_id: asset_name,
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
      } else {
        None
      }
    }
  }
}

// =============================================================================
// RULE 5: VERIFY RECIPIENTS HAVE pNFTs
// =============================================================================

fn find_token_outputs(
  outputs: List<Output>,
  policy: PolicyId,
  name: AssetName,
) -> List<Output> {
  list.filter(outputs, fn(output) {
    quantity_of(output.value, policy, name) > 0
  })
}

fn verify_recipient_has_pnft(
  output: Output,
  tx: Transaction,
  pnft_policy: PolicyId,
  config: TokenConfig,
) -> Bool {
  // Get recipient address
  let recipient = output.address.payment_credential
  
  when recipient is {
    VerificationKey(key_hash) -> {
      // Recipient is a regular address — must have pNFT
      find_pnft_for_key(tx, key_hash, pnft_policy)
    }
    Script(script_hash) -> {
      // Recipient is a script address — must be a known contract
      // (marketplace, escrow, treasury, etc.)
      is_allowed_script(script_hash, config)
    }
  }
}

fn find_pnft_for_key(
  tx: Transaction,
  key_hash: VerificationKeyHash,
  pnft_policy: PolicyId,
) -> Bool {
  // Look for pNFT owned by this key in reference inputs
  list.any(tx.reference_inputs, fn(input) {
    let has_pnft = has_policy_token(input.output.value, pnft_policy)
    if has_pnft {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          datum.owner == key_hash
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

fn is_allowed_script(script_hash: ByteArray, config: TokenConfig) -> Bool {
  // Known contract addresses that can receive tokens
  // Treasury, UBI pool, governance escrow, remediation bonds, grants
  script_hash == config.ubi_contract ||
  script_hash == config.treasury_contract ||
  script_hash == config.grants_contract ||
  script_hash == config.remediation_contract ||
  script_hash == config.record_contract
}

// =============================================================================
// RULE 6: VALIDATE METADATA — UNIVERSAL IMPACT
// =============================================================================
//
// EVERY TRANSACTION HAS IMPACT. There is no "neutral."
// Even digital transactions consume energy.
// The economy must account for physical reality.
//
// =============================================================================

fn validate_metadata(meta: TransactionMeta) -> Bool {
  // Transaction type must be properly specified
  let type_valid = validate_tx_type(meta.tx_type)
  
  // UNIVERSAL IMPACT: impacts list CANNOT be empty
  // Every action has consequence. No exceptions.
  let has_impacts = list.length(meta.impacts) > 0
  
  // All impacts must be properly structured
  let impacts_valid = list.all(meta.impacts, validate_single_impact)
  
  // Evidence must be provided (IPFS hash of methodology/measurements)
  let has_evidence = meta.evidence_hash != ""
  
  type_valid && has_impacts && impacts_valid && has_evidence
}

fn validate_tx_type(tx_type: TransactionType) -> Bool {
  when tx_type is {
    Labor { hours, .. } -> {
      when hours is {
        Some(h) -> h > 0
        None -> True
      }
    }
    Goods { quantity, .. } -> quantity > 0
    Services { .. } -> True
    Gift -> True
    Investment { terms_hash } -> terms_hash != ""
    Remediation { bond_id } -> bond_id != ""
    UBI { cycle } -> cycle >= 0
    GovernanceReward { proposal_id } -> proposal_id != ""
    Internal -> True
    StakeReward { pool_id, epoch } -> pool_id != "" && epoch >= 0
    ImpactTrade { impact_token_id, .. } -> impact_token_id != ""
  }
}

/// Validate a single impact measurement
fn validate_single_impact(impact: Impact) -> Bool {
  // Compound code must be specified
  let has_compound = impact.compound_code != ""
  
  // Unit must be specified
  let has_unit = impact.unit != ""
  
  // Confidence must be 0-100
  let valid_confidence = impact.confidence >= 0 && impact.confidence <= 100
  
  // Magnitude can be any integer (positive = regenerative, negative = extractive)
  // No artificial limits - let reality be measured honestly
  
  has_compound && has_unit && valid_confidence
}

/// Calculate net impact from all impacts (weighted by confidence)
fn calculate_net_impact(impacts: List<Impact>) -> Int {
  list.foldl(impacts, 0, fn(impact, acc) {
    let weighted = impact.magnitude * impact.confidence / 100
    acc + weighted
  })
}

/// Check if transaction requires remediation (net negative impact)
fn transaction_requires_remediation(impacts: List<Impact>) -> Bool {
  calculate_net_impact(impacts) < 0
}

// =============================================================================
// RULE 7: VALIDATE REMEDIATION FOR NEGATIVE NET IMPACT
// =============================================================================
//
// If your transaction's net impact is NEGATIVE (extractive),
// you MUST commit to remediation. Options:
// 1. Immediate: Offset in same transaction with impact tokens
// 2. Bonded: Post collateral, remediate later
// 3. Purchased: Buy impact tokens from regenerators
// 4. Direct: Physical remediation verified by attestors
//
// =============================================================================

fn validate_remediation(
  meta: TransactionMeta,
  tx: Transaction,
  config: TokenConfig,
) -> Bool {
  let net_impact = calculate_net_impact(meta.impacts)
  
  if net_impact >= 0 {
    // Net positive or zero — no remediation needed
    // (But note: true zero is rare. Most "neutral" is slightly positive or negative)
    True
  } else {
    // Net negative — MUST provide remediation
    let required_remediation = -net_impact  // How much to offset
    
    // Check that remediation is committed
    // This would be in a separate field in the metadata
    // For now, check that appropriate outputs exist
    verify_remediation_commitment(tx, required_remediation, config)
  }
}

fn verify_remediation_commitment(
  tx: Transaction,
  required: Int,
  config: TokenConfig,
) -> Bool {
  // Check for impact token burns (immediate offset)
  let burned_offset = count_impact_token_burns(tx)
  
  // Check for remediation bonds posted
  let bonded_offset = count_remediation_bonds(tx, config.remediation_contract)
  
  // Total offset must cover required remediation
  burned_offset + bonded_offset >= required
}

fn count_impact_token_burns(tx: Transaction) -> Int {
  // Sum negative quantities in mint field (burns)
  list.foldl(flatten(tx.mint), 0, fn(asset, acc) {
    let (_, _, qty) = asset
    if qty < 0 { acc + (-qty) } else { acc }
  })
}

fn count_remediation_bonds(tx: Transaction, remediation_contract: ByteArray) -> Int {
  // Sum bond amounts posted to remediation contract
  list.foldl(tx.outputs, 0, fn(output, acc) {
    when output.address.payment_credential is {
      Script(hash) if hash == remediation_contract -> {
        when output.datum is {
          InlineDatum(data) -> {
            expect bond: BondDatum = data
            acc + bond.required_magnitude
          }
          _ -> acc
        }
      }
      _ -> acc
    }
  })
}

fn verify_bond_posted(
  outputs: List<Output>,
  bond_id: ByteArray,
  deadline: Int,
  remediation_contract: ByteArray,
) -> Bool {
  list.any(outputs, fn(output) {
    is_remediation_contract(output.address, remediation_contract) &&
    has_bond_datum(output, bond_id, deadline)
  })
}

fn verify_offset_applied(tx: Transaction, amount: Int) -> Bool {
  // Verify impact tokens are burned
  // Check mint field for negative quantity of impact tokens
  // Impact token policy would be configured separately
  // For now, verify some tokens are burned (negative in mint)
  list.any(flatten(tx.mint), fn(asset) {
    let (_, _, qty) = asset
    qty < 0  // Something is burned
  })
}

// =============================================================================
// RULE 8: TRANSACTION RECORD CREATION
// =============================================================================

fn verify_record_created(
  tx: Transaction,
  sender: SenderData,
  meta: TransactionMeta,
  cycle: Int,
  config: TokenConfig,
) -> Bool {
  // Must have output to record contract with proper datum
  list.any(tx.outputs, fn(output) {
    if is_record_contract(output.address, config.record_contract) {
      when output.datum is {
        InlineDatum(data) -> {
          expect record: TransactionRecord = data
          // Verify record matches transaction
          record.sender == sender.pnft_id &&
          record.sender_bioregion == expect_some(sender.bioregion) &&
          record.tx_type_code == tx_type_code(meta.tx_type) &&
          record.impact_sign == impact_sign(meta.impact) &&
          record.impact_magnitude == impact_magnitude(meta.impact) &&
          record.cycle == cycle
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

// =============================================================================
// INTERNAL TRANSFER
// =============================================================================

fn validate_internal_transfer(tx: Transaction, config: TokenConfig) -> Bool {
  // Internal transfer = same owner reorganizing UTXOs
  // Relaxed rules but still need identity
  
  // 1. Find sender pNFT
  let sender_pnft = find_sender_pnft(tx, config.pnft_policy)
  expect Some(sender) = sender_pnft
  
  // 2. Sender must sign
  let sender_signed = list.has(tx.extra_signatories, sender.owner)
  
  // 3. All token outputs must go to sender's address
  let token_outputs = find_token_outputs(tx.outputs, config.policy_id, config.asset_name)
  let all_to_sender = list.all(token_outputs, fn(output) {
    output.address.payment_credential == VerificationKey(sender.owner)
  })
  
  sender_signed && all_to_sender
}

// =============================================================================
// SYSTEM CONTRACT VERIFICATION
// =============================================================================

fn verify_from_system_contract(inputs: List<Input>, contract: ByteArray) -> Bool {
  list.any(inputs, fn(input) {
    when input.output.address.payment_credential is {
      Script(hash) -> hash == contract
      _ -> False
    }
  })
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

fn get_slot(tx: Transaction) -> Int {
  // For validators, we typically use the lower bound of validity range
  // In production, this would extract from tx.validity_range
  // For now, use a simplified approach that works with tests
  expect cardano/transaction.Finite(slot) = tx.validity_range.lower_bound.bound_type
  slot
}

fn get_assets_of_policy(value: Value, policy: PolicyId) -> List<(AssetName, Int)> {
  // Flatten value and filter by policy
  list.filter_map(flatten(value), fn(asset) {
    let (p, name, qty) = asset
    if p == policy {
      Some((name, qty))
    } else {
      None
    }
  })
}

fn has_policy_token(value: Value, policy: PolicyId) -> Bool {
  list.length(get_assets_of_policy(value, policy)) > 0
}

fn is_remediation_contract(address: Address, contract: ByteArray) -> Bool {
  when address.payment_credential is {
    Script(hash) -> hash == contract
    _ -> False
  }
}

fn has_bond_datum(output: Output, bond_id: ByteArray, deadline: Int) -> Bool {
  // Check output has bond datum with matching ID and deadline
  when output.datum is {
    InlineDatum(data) -> {
      // Bond datum structure: { bond_id, deadline, ... }
      // We check the data contains expected values
      // This is a simplified check - full implementation would parse BondDatum
      True  // Datum exists, detailed validation in remediation contract
    }
    _ -> False
  }
}

fn is_record_contract(address: Address, contract: ByteArray) -> Bool {
  when address.payment_credential is {
    Script(hash) -> hash == contract
    _ -> False
  }
}

fn expect_some(opt: Option<a>) -> a {
  expect Some(value) = opt
  value
}

// =============================================================================
// MINTING POLICY (Genesis Only)
// =============================================================================

/// Genesis mint configuration
pub type GenesisConfig {
  /// UTXO that must be spent (ensures one-time mint)
  genesis_utxo: OutputReference,
  /// Total supply
  total_supply: Int,
  /// Treasury address (receives half)
  treasury: ByteArray,
  /// Grants pool address (receives half)
  grants_pool: ByteArray,
}

validator token_policy(genesis: GenesisConfig) {
  mint(redeemer: Data, policy_id: PolicyId, tx: Transaction) {
    // Genesis mint: 400 billion tokens, one time only
    
    // 1. Genesis UTXO must be spent
    let genesis_spent = list.any(tx.inputs, fn(input) {
      input.output_reference == genesis.genesis_utxo
    })
    
    // 2. Must mint exactly total_supply
    let mint_amount = get_mint_amount(tx.mint, policy_id)
    let amount_correct = mint_amount == genesis.total_supply
    
    // 3. Half to treasury, half to grants
    let half = genesis.total_supply / 2
    let treasury_correct = verify_tokens_to(tx.outputs, policy_id, genesis.treasury, half)
    let grants_correct = verify_tokens_to(tx.outputs, policy_id, genesis.grants_pool, half)
    
    genesis_spent && amount_correct && treasury_correct && grants_correct
  }
}

fn get_mint_amount(mint: Value, policy: PolicyId) -> Int {
  // Sum all minted under this policy
  list.foldl(flatten(mint), 0, fn(asset, acc) {
    let (p, _, qty) = asset
    if p == policy {
      acc + qty
    } else {
      acc
    }
  })
}

fn verify_tokens_to(
  outputs: List<Output>,
  policy: PolicyId,
  address: ByteArray,
  amount: Int,
) -> Bool {
  // Sum tokens sent to the script address
  let total = list.foldl(outputs, 0, fn(output, acc) {
    when output.address.payment_credential is {
      Script(hash) if hash == address -> {
        let tokens = list.foldl(flatten(output.value), 0, fn(asset, a) {
          let (p, _, qty) = asset
          if p == policy { a + qty } else { a }
        })
        acc + tokens
      }
      _ -> acc
    }
  })
  total >= amount
}

// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// THE TOKEN IS THE ECONOMY
// ========================
//
// Every UltraLife token transaction carries:
// - WHO: pNFT identity (DNA-verified)
// - WHERE: Bioregion (geographic accountability)
// - WHAT: Transaction type (labor, goods, services, etc.)
// - CONSEQUENCE: Impact classification (+, 0, -)
// - VALUE: Amount transferred
//
// NO ANONYMOUS TRANSFERS
// ======================
//
// Both sender AND recipient must have pNFTs.
// Script addresses are allowed only for known contracts.
// Every token in circulation is accounted for.
//
// NEGATIVE IMPACT REQUIRES REMEDIATION
// ====================================
//
// You CAN transact with negative environmental impact.
// But you MUST commit to remediation:
// - Immediate: Fix it in this transaction
// - Bonded: Stake tokens, fix later
// - Offset: Buy/burn impact tokens
//
// ON-CHAIN DATA FOR UBI
// =====================
//
// Every transaction creates a TransactionRecord.
// Records aggregate per avatar, per bioregion, per cycle.
// UBI distribution is calculated from this data.
// No oracles. Pure on-chain transparency.
//
// TOKEN ECONOMICS
// ===============
//
// Total supply: 400 billion (single bonding curve pool)
// - 400 billion to treasury (bonding curve sales)
// - 400 billion to grants pool (50 per verified user)
//
// No inflation. Fixed supply. Value from utility.
//
// =============================================================================
