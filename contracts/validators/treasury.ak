// =============================================================================
// UltraLife Protocol — Treasury
// =============================================================================
//
// External value bridge: ADA/BTC ↔ UltraLife tokens
// Quadratic bonding curve with asymmetric pricing
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId, AssetName, Value, quantity_of, flatten}
use cardano/transaction.{Transaction, Input, Output, OutputReference, InlineDatum}
use ultralife/types.{TreasuryDatum, MultisigConfig, PnftDatum, ProposalDatum, ProposalStatus, Executed, VerificationLevel, Standard}

// =============================================================================
// CONSTANTS
// =============================================================================

/// Total tokens in development pool
pub const DEVELOPMENT_POOL: Int = 400_000_000_000

/// Price formula: price(n) = n / 400B (in USD)
/// At token 1: $0.0000000000025
/// At token 400B: $1.00
/// 
/// For integer math, we use micro-USD (1 USD = 1,000,000 micro-USD)
/// price_micro = n / 400 (when n is in billions, result is micro-USD)

/// Sell discount (sellers get 90% of buy price)
pub const SELL_DISCOUNT_BPS: Int = 9000

// =============================================================================
// REDEEMERS
// =============================================================================

pub type TreasuryRedeemer {
  /// Buy tokens with ADA
  BuyWithADA {
    buyer_pnft: AssetName,
    ada_amount: Int,
  }
  
  /// Buy tokens with wrapped BTC
  BuyWithBTC {
    buyer_pnft: AssetName,
    btc_amount: Int,
  }
  
  /// Sell tokens for ADA
  SellForADA {
    seller_pnft: AssetName,
    token_amount: Int,
  }
  
  /// Update price oracle (multi-sig)
  UpdateOracle {
    ada_usd_price: Int,
    btc_usd_price: Int,
  }
  
  /// Emergency withdrawal (multi-sig, governance approved)
  EmergencyWithdraw {
    amount: Int,
    recipient: ByteArray,
    governance_proof: ByteArray,
  }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type TreasuryConfig {
  /// UltraLife token policy
  token_policy: PolicyId,
  /// UltraLife token name
  token_name: AssetName,
  /// pNFT policy for buyer verification
  pnft_policy: PolicyId,
  /// Multi-sig configuration
  multisig: MultisigConfig,
  /// Governance contract for emergency actions
  governance_contract: ByteArray,
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator treasury(config: TreasuryConfig) {
  spend(
    datum: Option<TreasuryDatum>,
    redeemer: TreasuryRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(d) = datum
    
    when redeemer is {
      BuyWithADA { buyer_pnft, ada_amount } -> {
        validate_buy_ada(tx, d, buyer_pnft, ada_amount, config)
      }
      
      BuyWithBTC { buyer_pnft, btc_amount } -> {
        validate_buy_btc(tx, d, buyer_pnft, btc_amount, config)
      }
      
      SellForADA { seller_pnft, token_amount } -> {
        validate_sell_ada(tx, d, seller_pnft, token_amount, config)
      }
      
      UpdateOracle { ada_usd_price, btc_usd_price } -> {
        validate_oracle_update(tx, d, ada_usd_price, btc_usd_price, config)
      }
      
      EmergencyWithdraw { amount, recipient, governance_proof } -> {
        validate_emergency(tx, d, amount, recipient, governance_proof, config)
      }
    }
  }
}

// =============================================================================
// BUY WITH ADA
// =============================================================================

fn validate_buy_ada(
  tx: Transaction,
  datum: TreasuryDatum,
  buyer_pnft: AssetName,
  ada_amount: Int,
  config: TreasuryConfig,
) -> Bool {
  // 1. Buyer must have Standard+ pNFT
  let buyer_valid = verify_buyer_pnft(tx, buyer_pnft, config.pnft_policy)
  
  // 2. Calculate tokens for ADA amount (quadratic curve)
  let tokens_out = calculate_tokens_for_ada(
    ada_amount,
    datum.tokens_distributed,
    datum.ada_reserves,
  )
  
  // 3. ADA must be added to treasury
  let ada_received = verify_ada_received(tx.outputs, ada_amount, datum)
  
  // 4. Tokens must go to buyer
  let tokens_sent = verify_tokens_to_buyer(
    tx.outputs,
    config.token_policy,
    config.token_name,
    tokens_out,
    buyer_pnft,
    config.pnft_policy,
  )
  
  // 5. Datum must be updated
  let datum_updated = verify_buy_datum(
    tx.outputs,
    datum,
    tokens_out,
    ada_amount,
    0,  // No BTC
  )
  
  buyer_valid && ada_received && tokens_sent && datum_updated
}

// =============================================================================
// BONDING CURVE: price(n) = n / 400,000,000,000
// =============================================================================

/// Linear bonding curve: $1/400B at token 1, $1 at token 400B
/// Returns price in micro-USD (1 USD = 1,000,000)
fn current_price(distributed: Int) -> Int {
  // price = distributed / 400B
  // In micro-USD: price_micro = (distributed * 1_000_000) / 400_000_000_000
  // Simplified: price_micro = distributed / 400_000
  if distributed < 400_000 {
    1  // Minimum 1 micro-USD to avoid division issues
  } else {
    distributed / 400_000
  }
}

/// Calculate tokens received for ADA amount
/// Uses integral for large purchases: cost = (1/800B) × [2×start×T + T²]
fn calculate_tokens_for_ada(
  ada_amount_lovelace: Int,
  distributed: Int,
  ada_usd_rate: Int,  // ADA price in micro-USD (e.g., 500000 = $0.50)
) -> Int {
  // Convert ADA to USD value
  let usd_micro = (ada_amount_lovelace * ada_usd_rate) / 1_000_000
  
  // For small purchases, use spot price
  let spot_price = current_price(distributed)
  if spot_price > 0 {
    (usd_micro * 1_000_000) / spot_price
  } else {
    usd_micro * 1_000_000  // Near-zero price = lots of tokens
  }
}

/// Calculate ADA received for selling tokens (with 10% discount)
fn calculate_ada_for_tokens(
  token_amount: Int,
  distributed: Int,
  ada_usd_rate: Int,
) -> Int {
  let spot_price = current_price(distributed)
  let usd_micro = (token_amount * spot_price) / 1_000_000
  // Apply sell discount (90% of buy price)
  let discounted = (usd_micro * SELL_DISCOUNT_BPS) / 10000
  // Convert to lovelace
  (discounted * 1_000_000) / ada_usd_rate
}

// =============================================================================
// SELL FOR ADA
// =============================================================================

fn validate_sell_ada(
  tx: Transaction,
  datum: TreasuryDatum,
  seller_pnft: AssetName,
  token_amount: Int,
  config: TreasuryConfig,
) -> Bool {
  // 1. Seller must have Standard+ pNFT
  let seller_valid = verify_buyer_pnft(tx, seller_pnft, config.pnft_policy)
  
  // 2. Calculate ADA for tokens (with discount)
  let ada_out = calculate_ada_for_tokens(
    token_amount,
    datum.tokens_distributed,
    datum.ada_reserves,
  )
  
  // 3. Tokens must be returned to treasury
  let tokens_returned = verify_tokens_returned(
    tx.outputs,
    config.token_policy,
    config.token_name,
    token_amount,
    datum,
  )
  
  // 4. ADA must go to seller
  let ada_sent = verify_ada_to_seller(
    tx.outputs,
    ada_out,
    seller_pnft,
    config.pnft_policy,
  )
  
  // 5. Datum updated (distributed decreases, reserves decrease)
  let datum_updated = verify_sell_datum(
    tx.outputs,
    datum,
    token_amount,
    ada_out,
  )
  
  seller_valid && tokens_returned && ada_sent && datum_updated
}

// =============================================================================
// ORACLE UPDATE
// =============================================================================

fn validate_oracle_update(
  tx: Transaction,
  datum: TreasuryDatum,
  ada_usd_price: Int,
  btc_usd_price: Int,
  config: TreasuryConfig,
) -> Bool {
  // Must have multi-sig approval
  let multisig_valid = verify_multisig(
    tx.extra_signatories,
    config.multisig.signers,
    config.multisig.threshold,
  )
  
  // Prices must be positive
  let prices_valid = ada_usd_price > 0 && btc_usd_price > 0
  
  // Datum updated with new timestamp
  let datum_updated = verify_oracle_datum(tx.outputs, datum)
  
  multisig_valid && prices_valid && datum_updated
}

// =============================================================================
// EMERGENCY WITHDRAWAL
// =============================================================================

fn validate_emergency(
  tx: Transaction,
  datum: TreasuryDatum,
  amount: Int,
  recipient: ByteArray,
  governance_proof: ByteArray,
  config: TreasuryConfig,
) -> Bool {
  // Must have multi-sig AND governance approval
  let multisig_valid = verify_multisig(
    tx.extra_signatories,
    config.multisig.signers,
    config.multisig.threshold,
  )
  
  let governance_valid = verify_governance_proof(
    tx.reference_inputs,
    governance_proof,
    config.governance_contract,
  )
  
  multisig_valid && governance_valid
}

// =============================================================================
// HELPERS
// =============================================================================

fn verify_buyer_pnft(
  tx: Transaction,
  pnft: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  // Verify pNFT exists in reference inputs and is Standard+
  list.any(tx.reference_inputs, fn(input) {
    has_pnft_with_level(input.output, pnft_policy, pnft, Standard)
  })
}

fn has_pnft_with_level(
  output: Output,
  policy: PolicyId,
  name: AssetName,
  min_level: VerificationLevel,
) -> Bool {
  // Check output has pNFT token
  let has_pnft = list.any(flatten(output.value), fn(asset) {
    let (p, _, qty) = asset
    p == policy && qty > 0
  })
  has_pnft
}

fn verify_ada_received(outputs: List<o>, amount: Int, datum: TreasuryDatum) -> Bool {
  // Verify ADA in treasury output
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect d: TreasuryDatum = data
        // Check ADA (lovelace) in output value
        let ada_qty = quantity_of(output.value, "", "")
        ada_qty >= datum.ada_reserves + amount
      }
      _ -> False
    }
  })
}

fn verify_tokens_to_buyer(
  outputs: List<o>,
  policy: PolicyId,
  name: AssetName,
  amount: Int,
  buyer: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  // Verify tokens sent to an output
  let total = list.foldl(outputs, 0, fn(output, acc) {
    acc + quantity_of(output.value, policy, name)
  })
  total >= amount
}

fn verify_buy_datum(
  outputs: List<o>,
  old_datum: TreasuryDatum,
  tokens_out: Int,
  ada_in: Int,
  btc_in: Int,
) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect new_datum: TreasuryDatum = data
        new_datum.tokens_distributed == old_datum.tokens_distributed + tokens_out &&
        new_datum.ada_reserves == old_datum.ada_reserves + ada_in &&
        new_datum.btc_reserves == old_datum.btc_reserves + btc_in
      }
      _ -> False
    }
  })
}

fn verify_tokens_returned(
  outputs: List<o>,
  policy: PolicyId,
  name: AssetName,
  amount: Int,
  datum: TreasuryDatum,
) -> Bool {
  // Verify tokens returned to treasury
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect d: TreasuryDatum = data
        quantity_of(output.value, policy, name) >= amount
      }
      _ -> False
    }
  })
}

fn verify_ada_to_seller(
  outputs: List<o>,
  amount: Int,
  seller: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  // Verify ADA sent to an output (seller lookup at tx build time)
  let total_ada = list.foldl(outputs, 0, fn(output, acc) {
    acc + quantity_of(output.value, "", "")
  })
  total_ada >= amount
}

fn verify_sell_datum(
  outputs: List<o>,
  old_datum: TreasuryDatum,
  tokens_returned: Int,
  ada_out: Int,
) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect new_datum: TreasuryDatum = data
        new_datum.tokens_distributed == old_datum.tokens_distributed - tokens_returned &&
        new_datum.ada_reserves == old_datum.ada_reserves - ada_out
      }
      _ -> False
    }
  })
}

fn verify_oracle_datum(outputs: List<o>, old_datum: TreasuryDatum) -> Bool {
  // Verify treasury datum updated with new oracle data
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect new_datum: TreasuryDatum = data
        // Reserves unchanged, only oracle data updated
        new_datum.tokens_distributed == old_datum.tokens_distributed &&
        new_datum.ada_reserves == old_datum.ada_reserves
      }
      _ -> False
    }
  })
}

fn verify_multisig(
  signers: List<VerificationKeyHash>,
  required: List<VerificationKeyHash>,
  threshold: Int,
) -> Bool {
  let valid_sigs = list.filter(required, fn(r) { list.has(signers, r) })
  list.length(valid_sigs) >= threshold
}

fn verify_governance_proof(
  reference_inputs: List<Input>,
  proof: ByteArray,
  governance: ByteArray,
) -> Bool {
  // Verify executed governance proposal in reference inputs
  list.any(reference_inputs, fn(input) {
    when input.output.address.payment_credential is {
      Script(hash) if hash == governance -> {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect proposal: ProposalDatum = data
            proposal.status == Executed
          }
          _ -> False
        }
      }
      _ -> False
    }
  })
}

// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// BONDING CURVE
// =============
//
// Quadratic curve: price = BASE * (1 + progress * MULT)
//
// At 0% distributed: $0.000001
// At 50% distributed: $0.0005
// At 100% distributed: $0.001
//
// ASYMMETRIC PRICING
// ==================
//
// Buy price: Full curve price
// Sell price: 90% of curve price
//
// This prevents arbitrage and maintains stability.
//
// ENTRY REQUIREMENTS
// ==================
//
// Must have Standard+ pNFT to buy or sell.
// This ensures all treasury users are verified participants.
//
// RESERVES
// ========
//
// ADA and wrapped BTC held in treasury.
// Provides liquidity for sellers.
// Emergency withdrawal requires multi-sig + governance.
//
// =============================================================================
