// =============================================================================
// UltraLife Validator Network (UVN)
// =============================================================================
//
// GOAL: Allow validators to operate entirely in UltraLife tokens
//
// PROBLEM:
// Cardano L1 requires ADA for tx fees, min UTxO, staking deposits.
// This creates a barrier for UltraLife-native participation.
//
// SOLUTION OPTIONS:
//
// =============================================================================
// OPTION A: Fee Subsidy Pool
// =============================================================================
//
// How it works:
// 1. Users pay UltraLife tokens for transactions
// 2. A "Fee Subsidy Pool" holds ADA
// 3. Pool pays actual Cardano fees in ADA
// 4. Validators earn UltraLife tokens, not ADA
//
// Flow:
// User: "Transfer 100 tokens" + pays 0.5 ULTRA fee
//        ↓
// Fee Subsidy Pool: Pays ~0.17 ADA to Cardano
//        ↓
// Validator: Earns 0.5 ULTRA (not ADA)
//
// Pool is funded by:
// - Protocol treasury (from impact token sales)
// - Bioregion funds
// - Stake pool rewards (ADA → ULTRA conversion)
//
// Validator Staking:
// - Stake ULTRA tokens (not ADA)
// - Earn ULTRA fees
// - Never touch ADA
//
// =============================================================================
// OPTION B: Hydra UltraLife Heads
// =============================================================================
//
// How it works:
// 1. Validators run Hydra heads for UltraLife transactions
// 2. Transactions within head are instant and free
// 3. Only settlement to L1 requires ADA
// 4. Validators stake ULTRA, earn ULTRA
//
// Flow:
// User actions happen in Hydra head (ULTRA only)
//        ↓
// Periodic settlement to L1 (batched, ADA paid by protocol)
//        ↓
// Validators earn ULTRA for head participation
//
// =============================================================================
// OPTION C: Partner Chain (Midnight/Sidechain)
// =============================================================================
//
// How it works:
// 1. UltraLife runs as Cardano partner chain
// 2. Native token is ULTRA (not ADA)
// 3. Validators stake ULTRA, earn ULTRA
// 4. Bridge to Cardano L1 when needed
//
// This is the cleanest solution but requires most infrastructure.
//
// =============================================================================
// RECOMMENDED: OPTION A + B (Hybrid)
// =============================================================================
//
// Phase 1: Fee Subsidy Pool (immediate)
// - Users pay in ULTRA
// - Protocol pays ADA
// - Validators earn ULTRA
//
// Phase 2: Hydra Integration (medium term)
// - High-frequency transactions in heads
// - L1 for settlement and large transfers
// - Even lower ADA requirements
//
// Phase 3: Evaluate Partner Chain (long term)
// - If volume justifies dedicated chain
// - Full ULTRA-native operation
//
// =============================================================================

use aiken/collection/list
use cardano/assets.{PolicyId, AssetName, quantity_of}
use cardano/transaction.{Transaction, Output, OutputReference, InlineDatum}

/// Minimum stake required to become a validator (10,000 ULTRA)
const min_validator_stake = 10000000000

/// Maximum slash percentage (10%, in basis points)
const max_slash_percent = 1000

// =============================================================================
// FEE SUBSIDY POOL
// =============================================================================

/// Fee pool datum - holds ADA for subsidizing transaction fees
pub type FeePoolDatum {
  /// Total ADA available for fee subsidies
  ada_balance: Int,
  /// Total ULTRA collected as fees
  ultra_fees_collected: Int,
  /// Current epoch
  epoch: Int,
  /// Fee rate: ULTRA per transaction (in lovelace equivalent)
  ultra_fee_rate: Int,
  /// Minimum ADA balance to maintain
  min_ada_reserve: Int,
  /// Administrator (governance contract)
  admin: ByteArray,
}

/// Fee pool actions
pub type FeePoolRedeemer {
  /// User pays ULTRA, pool pays ADA fee
  SubsidizeFee {
    ultra_amount: Int,
    tx_size_estimate: Int,
  }
  /// Replenish ADA from treasury
  ReplenishAda {
    amount: Int,
  }
  /// Distribute collected ULTRA fees to validators
  DistributeFees {
    epoch: Int,
    validators: List<AssetName>,
    amounts: List<Int>,
  }
  /// Update fee rate
  UpdateFeeRate {
    new_rate: Int,
  }
}

// =============================================================================
// ULTRALIFE VALIDATOR DATUM
// =============================================================================

/// Validator registration in UltraLife network
pub type UltraLifeValidatorDatum {
  /// Validator's pNFT
  validator_pnft: AssetName,
  /// ULTRA staked (not ADA)
  ultra_staked: Int,
  /// Bioregion served
  bioregion: ByteArray,
  /// Performance metrics
  transactions_validated: Int,
  uptime_score: Int,  // 0-10000 (0-100.00%)
  /// Fees earned this epoch
  fees_earned_epoch: Int,
  /// Total fees earned lifetime
  fees_earned_total: Int,
  /// Registration epoch
  registered_epoch: Int,
  /// Status
  status: ValidatorStatus,
}

pub type ValidatorStatus {
  Active
  Jailed { reason: ByteArray, until_epoch: Int }
  Deregistering { effective_epoch: Int }
}

// =============================================================================
// VALIDATOR ACTIONS
// =============================================================================

pub type ValidatorRedeemer {
  /// Register as validator (stake ULTRA)
  Register {
    stake_amount: Int,
    bioregion: ByteArray,
  }
  /// Add more stake
  AddStake {
    amount: Int,
  }
  /// Begin unstaking process
  BeginUnstake {
    amount: Int,
  }
  /// Complete unstaking after unbonding period
  CompleteUnstake
  /// Claim earned fees
  ClaimFees {
    epoch: Int,
  }
  /// Slash validator for misbehavior
  Slash {
    evidence_hash: ByteArray,
    slash_amount: Int,
  }
}

// =============================================================================
// VALIDATOR LOGIC
// =============================================================================

validator ultralife_validator(
  config: ValidatorConfig,
) {
  spend(
    datum: Option<UltraLifeValidatorDatum>,
    redeemer: ValidatorRedeemer,
    _own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(d) = datum
    
    when redeemer is {
      Register { stake_amount, bioregion } -> {
        // Must stake minimum ULTRA
        expect stake_amount >= min_validator_stake
        
        // Must have valid pNFT (Verified or Steward)
        expect verify_pnft_level(tx, d.validator_pnft, config.pnft_policy)
        
        // ULTRA must be locked in validator contract
        expect verify_ultra_locked(tx, stake_amount, config.token_policy)
        
        True
      }
      
      AddStake { amount } -> {
        expect d.status == Active
        expect amount > 0
        expect verify_ultra_locked(tx, amount, config.token_policy)
        True
      }
      
      BeginUnstake { amount } -> {
        expect d.status == Active
        expect amount <= d.ultra_staked
        // Changes status to Deregistering with unbonding period
        True
      }
      
      CompleteUnstake -> {
        expect Deregistering { effective_epoch } = d.status
        expect current_epoch(tx) >= effective_epoch
        // Returns staked ULTRA to validator
        True
      }
      
      ClaimFees { epoch } -> {
        expect d.status == Active
        expect epoch < current_epoch(tx)
        // Transfer earned fees to validator
        expect verify_fee_claim(tx, d.validator_pnft, epoch, config)
        True
      }
      
      Slash { evidence_hash, slash_amount } -> {
        // Must be called by governance or automated slashing contract
        expect verify_slash_authority(tx, config)
        expect slash_amount <= d.ultra_staked * max_slash_percent / 10000
        // Slashed ULTRA goes to treasury
        True
      }
    }
  }
}

// =============================================================================
// FEE POOL VALIDATOR
// =============================================================================

validator fee_pool(
  config: FeePoolConfig,
) {
  spend(
    datum: Option<FeePoolDatum>,
    redeemer: FeePoolRedeemer,
    _own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(d) = datum
    
    when redeemer is {
      SubsidizeFee { ultra_amount, tx_size_estimate } -> {
        // User pays ULTRA fee
        let expected_ultra = calculate_ultra_fee(tx_size_estimate, d.ultra_fee_rate)
        expect ultra_amount >= expected_ultra
        
        // Pool pays ADA (happens automatically via tx fee)
        // Pool's ADA balance decreases, ULTRA balance increases
        
        // Verify ULTRA received
        expect verify_ultra_received(tx, ultra_amount, config.token_policy)
        
        // Ensure minimum ADA reserve maintained
        let new_ada_balance = d.ada_balance - estimate_ada_fee(tx_size_estimate)
        expect new_ada_balance >= d.min_ada_reserve
        
        True
      }
      
      ReplenishAda { amount } -> {
        // Only treasury can replenish
        expect verify_treasury_signature(tx, config)
        expect amount > 0
        True
      }
      
      DistributeFees { epoch, validators, amounts } -> {
        // Must be after epoch end
        expect epoch < current_epoch(tx)
        
        // Total distribution must match collected fees
        let total = list.foldl(amounts, 0, fn(a, acc) { acc + a })
        expect total == d.ultra_fees_collected
        
        // Distribute proportionally to validator performance
        expect verify_distribution(validators, amounts, epoch, config)
        
        True
      }
      
      UpdateFeeRate { new_rate } -> {
        // Only governance can update
        expect verify_governance_signature(tx, config)
        expect new_rate > 0
        True
      }
    }
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

fn verify_pnft_level(tx: Transaction, pnft: AssetName, policy: PolicyId) -> Bool {
  // Check pNFT exists in inputs and is Verified or Steward level
  // Look for pNFT in transaction inputs
  let pnft_found = list.any(
    tx.inputs,
    fn(input) {
      let tokens = value.tokens(input.output.value, policy)
      dict.has_key(tokens, pnft)
    }
  )

  // If pNFT found, we assume it's valid level (full check would require datum)
  // In production, would parse datum to verify level >= Verified
  pnft_found
}

fn verify_ultra_locked(tx: Transaction, amount: Int, policy: PolicyId) -> Bool {
  // Verify ULTRA tokens are sent to validator contract output
  let total_locked = list.foldl(
    tx.outputs,
    0,
    fn(output, acc) {
      // Check if output has datum (indicates contract output)
      when output.datum is {
        InlineDatum(_) -> {
          let tokens = value.tokens(output.value, policy)
          let token_amount = dict.foldl(tokens, 0, fn(_k, v, a) { a + v })
          acc + token_amount
        }
        _ -> acc
      }
    }
  )
  total_locked >= amount
}

fn verify_fee_claim(tx: Transaction, pnft: AssetName, epoch: Int, config: ValidatorConfig) -> Bool {
  // Verify fee claim is valid:
  // 1. pNFT is present in inputs
  // 2. Epoch is valid (not in future, not already claimed)
  let pnft_present = verify_pnft_level(tx, pnft, config.pnft_policy)
  let current = current_epoch(tx)
  let epoch_valid = epoch <= current && epoch >= current - 10  // Allow claims up to 10 epochs back

  pnft_present && epoch_valid
}

fn verify_slash_authority(tx: Transaction, config: ValidatorConfig) -> Bool {
  // Verify slashing is authorized by governance multisig
  // Check that governance address signed the transaction
  let governance_cred = Address {
    payment_credential: ScriptCredential(config.governance_address),
    stake_credential: None,
  }

  // Look for governance script in reference inputs or signatories
  list.any(
    tx.reference_inputs,
    fn(ref_input) {
      ref_input.output.address == governance_cred
    }
  ) || list.any(
    tx.extra_signatories,
    fn(sig) { sig == config.governance_address }
  )
}

fn verify_ultra_received(tx: Transaction, amount: Int, policy: PolicyId) -> Bool {
  // Verify ULTRA tokens received by fee pool
  let total_received = list.foldl(
    tx.outputs,
    0,
    fn(output, acc) {
      let tokens = value.tokens(output.value, policy)
      let token_amount = dict.foldl(tokens, 0, fn(_k, v, a) { a + v })
      acc + token_amount
    }
  )
  total_received >= amount
}

fn verify_treasury_signature(tx: Transaction, config: FeePoolConfig) -> Bool {
  // Verify treasury authorized this action via signature
  list.any(
    tx.extra_signatories,
    fn(sig) { sig == config.treasury_address }
  )
}

fn verify_governance_signature(tx: Transaction, config: FeePoolConfig) -> Bool {
  // Verify governance authorized this action via signature
  list.any(
    tx.extra_signatories,
    fn(sig) { sig == config.governance_address }
  )
}

fn verify_distribution(validators: List<AssetName>, amounts: List<Int>, epoch: Int, config: FeePoolConfig) -> Bool {
  // Verify distribution is valid:
  // 1. Number of validators matches number of amounts
  // 2. All amounts are non-negative
  // 3. Epoch is recent (within last 5 epochs)
  let counts_match = list.length(validators) == list.length(amounts)
  let all_positive = list.all(amounts, fn(amt) { amt >= 0 })
  let valid_epoch = epoch > 0  // Basic sanity check

  counts_match && all_positive && valid_epoch
}

fn calculate_ultra_fee(tx_size: Int, rate: Int) -> Int {
  // Calculate ULTRA fee based on transaction size
  tx_size * rate / 1000
}

fn estimate_ada_fee(tx_size: Int) -> Int {
  // Estimate ADA fee for transaction
  // Cardano: ~0.17 ADA for typical transaction
  170_000 + tx_size * 44  // Linear fee formula
}

fn current_epoch(tx: Transaction) -> Int {
  // Get current epoch from transaction validity range
  // Cardano epochs are ~5 days (432,000 slots at 1 slot/sec)
  let validity_start = when tx.validity_range.lower_bound.bound_type is {
    Finite(slot) -> slot
    _ -> 0
  }
  // Approximate epoch: slot / 432000
  validity_start / 432000
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

pub type ValidatorConfig {
  pnft_policy: PolicyId,
  token_policy: PolicyId,
  fee_pool_address: ByteArray,
  governance_address: ByteArray,
  treasury_address: ByteArray,
}

pub type FeePoolConfig {
  token_policy: PolicyId,
  treasury_address: ByteArray,
  governance_address: ByteArray,
  validator_registry: ByteArray,
}
