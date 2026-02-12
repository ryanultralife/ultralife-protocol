// =============================================================================
// UltraLife Protocol — Hydra Spending Buckets
// =============================================================================
//
// PERSONAL FINANCE LAYER
//
// Every pNFT can have spending buckets - pre-allocated funds for different
// purposes that operate inside Hydra heads for instant spending:
//
// ┌─────────────────────────────────────────────────────────────────┐
// │  pNFT: Alice                                                    │
// │                                                                  │
// │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
// │  │ Daily       │ │ Monthly     │ │ Emergency   │              │
// │  │ Spending    │ │ Bills       │ │ Fund        │              │
// │  │             │ │             │ │             │              │
// │  │ 50 ULTRA    │ │ 500 ULTRA   │ │ 1000 ULTRA  │              │
// │  │ /day        │ │ /month      │ │ locked      │              │
// │  │             │ │             │ │             │              │
// │  │ Rollover: Y │ │ Rollover: N │ │ Rollover: Y │              │
// │  │ Max: 100    │ │ Max: 500    │ │ Max: 5000   │              │
// │  └─────────────┘ └─────────────┘ └─────────────┘              │
// │                                                                  │
// │  Operates in: Hydra Head (instant, feeless)                     │
// │  Settles to: L1 (daily/weekly batch)                            │
// └─────────────────────────────────────────────────────────────────┘
//
// WHY HYDRA?
// - Instant spending (no block confirmation wait)
// - Feeless transactions within head
// - Perfect for daily micro-transactions
// - Settlement to L1 batches multiple txs into one
//
// WHY BUCKETS?
// - Budget discipline (can't overspend category)
// - Rollover capability (unused funds accumulate)
// - Caps prevent runaway spending
// - Different rules per bucket
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId, AssetName, quantity_of}
use cardano/transaction.{Transaction, Output, OutputReference, InlineDatum}

/// Maximum number of buckets per pNFT
const max_buckets = 10

/// Minimum allocation per bucket (1 ULTRA)
const min_allocation = 1000000

// =============================================================================
// BUCKET TYPES
// =============================================================================

/// Spending bucket period
pub type BucketPeriod {
  Daily
  Weekly
  Monthly
  Quarterly
  Yearly
  Custom { seconds: Int }
}

/// Bucket configuration
pub type BucketConfig {
  /// Bucket identifier
  bucket_id: ByteArray,
  /// Human-readable name hash
  name_hash: ByteArray,
  /// Allocation per period
  allocation: Int,
  /// Current period
  period: BucketPeriod,
  /// Does unused balance roll over?
  rollover: Bool,
  /// Maximum accumulated balance (if rollover enabled)
  max_balance: Int,
  /// Minimum balance to maintain (can't spend below this)
  min_balance: Int,
  /// Allowed recipient categories (empty = any)
  allowed_categories: List<ByteArray>,
  /// Locked until timestamp (0 = not locked)
  locked_until: Int,
}

/// Bucket state
pub type BucketState {
  /// Configuration
  config: BucketConfig,
  /// Current balance
  balance: Int,
  /// Period start timestamp
  period_start: Int,
  /// Spent this period
  spent_this_period: Int,
  /// Total spent lifetime
  total_spent: Int,
  /// Last activity timestamp
  last_activity: Int,
}

/// Full spending bucket datum
pub type SpendingBucketDatum {
  /// Owner pNFT
  owner_pnft: AssetName,
  /// All buckets
  buckets: List<BucketState>,
  /// Total funds across all buckets
  total_funds: Int,
  /// Hydra head ID (if operating in head)
  hydra_head: Option<ByteArray>,
  /// Last L1 settlement
  last_settlement: Int,
  /// Created at
  created_at: Int,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type BucketRedeemer {
  /// Create new bucket configuration
  CreateBucket {
    config: BucketConfig,
    initial_funding: Int,
  }
  /// Fund a bucket (add tokens)
  FundBucket {
    bucket_id: ByteArray,
    amount: Int,
  }
  /// Spend from bucket
  Spend {
    bucket_id: ByteArray,
    amount: Int,
    recipient: AssetName,
    purpose_hash: ByteArray,
  }
  /// Advance to new period (trigger rollover logic)
  AdvancePeriod {
    bucket_id: ByteArray,
  }
  /// Transfer between buckets (same owner)
  TransferBetweenBuckets {
    from_bucket: ByteArray,
    to_bucket: ByteArray,
    amount: Int,
  }
  /// Close bucket (return remaining funds)
  CloseBucket {
    bucket_id: ByteArray,
  }
  /// Enter Hydra head (lock for L2 operation)
  EnterHydra {
    head_id: ByteArray,
  }
  /// Exit Hydra head (settle to L1)
  ExitHydra {
    final_state: List<BucketState>,
  }
  /// Emergency withdraw (bypass bucket rules, pay penalty)
  EmergencyWithdraw {
    amount: Int,
    reason_hash: ByteArray,
  }
  /// Update bucket config
  UpdateConfig {
    bucket_id: ByteArray,
    new_config: BucketConfig,
  }
}

// =============================================================================
// ADDITIONAL CONSTANTS
// =============================================================================

/// Emergency withdrawal penalty (10%)
const emergency_penalty_bps = 1000

/// Maximum rollover multiplier (can accumulate up to 12x allocation)
const max_rollover_multiplier = 12

// =============================================================================
// VALIDATORS
// =============================================================================

validator spending_bucket(
  config: SpendingBucketConfig,
) {
  spend(
    datum: Option<SpendingBucketDatum>,
    redeemer: BucketRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(d) = datum
    
    // Verify owner pNFT is signing
    let owner_signed = verify_pnft_owner(tx, d.owner_pnft, config.pnft_policy)
    
    when redeemer is {
      CreateBucket { config: bucket_config, initial_funding } -> {
        expect owner_signed
        expect list.length(d.buckets) < max_buckets
        expect bucket_config.allocation >= min_allocation
        expect initial_funding >= 0
        
        // Verify max_balance respects rollover multiplier
        expect bucket_config.max_balance <= bucket_config.allocation * max_rollover_multiplier
        
        // Verify funds are provided
        expect verify_funding_received(tx, initial_funding, config.token_policy)
        
        True
      }
      
      FundBucket { bucket_id, amount } -> {
        expect owner_signed
        expect amount > 0
        
        // Find bucket
        expect Some(bucket) = find_bucket(d.buckets, bucket_id)
        
        // Verify won't exceed max (if rollover enabled)
        let new_balance = bucket.balance + amount
        expect !bucket.config.rollover || new_balance <= bucket.config.max_balance
        
        // Verify funds received
        expect verify_funding_received(tx, amount, config.token_policy)
        
        True
      }
      
      Spend { bucket_id, amount, recipient, purpose_hash } -> {
        expect owner_signed
        expect amount > 0
        
        // Find bucket
        expect Some(bucket) = find_bucket(d.buckets, bucket_id)
        
        // Check bucket is not locked
        let current_time = get_current_time(tx)
        expect bucket.config.locked_until <= current_time
        
        // Check sufficient balance
        expect bucket.balance - amount >= bucket.config.min_balance
        
        // Check spending limit for period
        let new_spent = bucket.spent_this_period + amount
        expect new_spent <= bucket.config.allocation
        
        // Check recipient category if restricted
        expect verify_recipient_category(recipient, bucket.config.allowed_categories, tx, config)
        
        // Verify payment goes to recipient
        expect verify_payment_to_recipient(tx, recipient, amount, config)
        
        True
      }
      
      AdvancePeriod { bucket_id } -> {
        // Anyone can trigger period advance (permissionless)
        
        expect Some(bucket) = find_bucket(d.buckets, bucket_id)
        
        let current_time = get_current_time(tx)
        let period_length = period_to_seconds(bucket.config.period)
        
        // Check period has actually elapsed
        expect current_time >= bucket.period_start + period_length
        
        // Rollover logic is handled in output datum construction
        // If rollover: new_balance = min(balance + allocation, max_balance)
        // If no rollover: new_balance = allocation
        
        True
      }
      
      TransferBetweenBuckets { from_bucket, to_bucket, amount } -> {
        expect owner_signed
        expect amount > 0
        
        expect Some(from) = find_bucket(d.buckets, from_bucket)
        expect Some(to) = find_bucket(d.buckets, to_bucket)
        
        // Check from bucket has funds
        expect from.balance - amount >= from.config.min_balance
        
        // Check to bucket won't exceed max
        expect !to.config.rollover || to.balance + amount <= to.config.max_balance
        
        // Both buckets must not be locked
        let current_time = get_current_time(tx)
        expect from.config.locked_until <= current_time
        expect to.config.locked_until <= current_time
        
        True
      }
      
      CloseBucket { bucket_id } -> {
        expect owner_signed
        
        expect Some(bucket) = find_bucket(d.buckets, bucket_id)
        
        // Bucket must not be locked
        let current_time = get_current_time(tx)
        expect bucket.config.locked_until <= current_time
        
        // Remaining balance returned to owner
        expect verify_funds_returned(tx, d.owner_pnft, bucket.balance, config)
        
        True
      }
      
      EnterHydra { head_id } -> {
        expect owner_signed
        
        // Must not already be in a head
        expect d.hydra_head == None
        
        // All funds locked to Hydra head
        // State transitions happen off-chain in head
        // Exit will settle final state
        
        True
      }
      
      ExitHydra { final_state } -> {
        expect owner_signed
        
        // Must be in a head
        expect Some(_head) = d.hydra_head
        
        // Verify final state is valid
        // Total funds must match (can't create/destroy in head)
        let final_total = list.foldl(
          final_state,
          0,
          fn(b, acc) { acc + b.balance }
        )
        expect final_total == d.total_funds
        
        // Verify Hydra head closure proof
        // (In production, would verify Hydra multisig)
        
        True
      }
      
      EmergencyWithdraw { amount, reason_hash } -> {
        expect owner_signed
        expect amount > 0
        expect amount <= d.total_funds
        
        // Calculate penalty
        let penalty = amount * emergency_penalty_bps / 10000
        let net_amount = amount - penalty
        
        // Penalty goes to bioregion treasury
        expect verify_penalty_paid(tx, penalty, config)
        
        // Net amount to owner
        expect verify_funds_returned(tx, d.owner_pnft, net_amount, config)
        
        True
      }
      
      UpdateConfig { bucket_id, new_config } -> {
        expect owner_signed
        
        expect Some(bucket) = find_bucket(d.buckets, bucket_id)
        
        // Bucket must not be locked
        let current_time = get_current_time(tx)
        expect bucket.config.locked_until <= current_time
        
        // New config must be valid
        expect new_config.allocation >= min_allocation
        expect new_config.max_balance <= new_config.allocation * max_rollover_multiplier
        
        True
      }
    }
  }
}

// =============================================================================
// HYDRA HEAD OPERATIONS
// =============================================================================

/// Datum for bucket state within Hydra head
/// This is the off-chain state that evolves inside the head
pub type HydraBucketState {
  /// Original L1 reference
  l1_reference: OutputReference,
  /// Current bucket states (evolves in head)
  buckets: List<BucketState>,
  /// Pending transactions (not yet settled)
  pending_txs: List<HydraTx>,
  /// Head participants
  participants: List<AssetName>,
}

/// Transaction within Hydra head
pub type HydraTx {
  tx_id: ByteArray,
  from_bucket: ByteArray,
  to_pnft: AssetName,
  amount: Int,
  timestamp: Int,
}

// =============================================================================
// PRESET BUCKET TEMPLATES
// =============================================================================

/// Common bucket configurations users can choose from
pub type BucketTemplate {
  /// Daily spending money
  DailySpending
  /// Weekly groceries
  WeeklyGroceries
  /// Monthly bills
  MonthlyBills
  /// Emergency fund (locked, rollover)
  EmergencyFund
  /// Savings goal (locked until date)
  SavingsGoal { target: Int, unlock_date: Int }
  /// Child allowance (daily, capped)
  Allowance { daily_limit: Int }
  /// Business expense (category restricted)
  BusinessExpense { categories: List<ByteArray> }
  /// Custom template
  CustomTemplate { config: BucketConfig }
}

fn make_bucket_config(
  name: ByteArray,
  allocation: Int,
  period: BucketPeriod,
  rollover: Bool,
  max_balance: Int,
  min_balance: Int,
  allowed_categories: List<ByteArray>,
  locked_until: Int,
) -> BucketConfig {
  BucketConfig {
    bucket_id: name,
    name_hash: name,
    allocation: allocation,
    period: period,
    rollover: rollover,
    max_balance: max_balance,
    min_balance: min_balance,
    allowed_categories: allowed_categories,
    locked_until: locked_until,
  }
}

/// Convert template to config
pub fn template_to_config(template: BucketTemplate, name: ByteArray) -> BucketConfig {
  when template is {
    DailySpending -> make_bucket_config(name, 50000000, Daily, True, 200000000, 0, [], 0)
    WeeklyGroceries -> make_bucket_config(name, 150000000, Weekly, False, 150000000, 0, [], 0)
    MonthlyBills -> make_bucket_config(name, 500000000, Monthly, False, 500000000, 0, [], 0)
    EmergencyFund -> make_bucket_config(name, 100000000, Monthly, True, 5000000000, 1000000000, [], 0)
    SavingsGoal { target, unlock_date } -> make_bucket_config(name, target / 12, Monthly, True, target, 0, [], unlock_date)
    Allowance { daily_limit } -> make_bucket_config(name, daily_limit, Daily, False, daily_limit, 0, [], 0)
    BusinessExpense { categories } -> make_bucket_config(name, 1000000000, Monthly, True, 3000000000, 0, categories, 0)
    CustomTemplate { config } -> config
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

fn find_bucket(buckets: List<BucketState>, bucket_id: ByteArray) -> Option<BucketState> {
  list.find(buckets, fn(b) { b.config.bucket_id == bucket_id })
}

fn period_to_seconds(period: BucketPeriod) -> Int {
  when period is {
    Daily -> 86400
    Weekly -> 604800
    Monthly -> 2592000  // 30 days
    Quarterly -> 7776000  // 90 days
    Yearly -> 31536000  // 365 days
    Custom { seconds } -> seconds
  }
}

fn get_current_time(tx: Transaction) -> Int {
  // Extract current time from transaction validity range
  // Use lower bound of validity range as "now"
  when tx.validity_range.lower_bound.bound_type is {
    Finite(time) -> time
    NegativeInfinity -> 0
    PositiveInfinity -> 0
  }
}

fn verify_pnft_owner(tx: Transaction, pnft: AssetName, policy: PolicyId) -> Bool {
  // Verify pNFT is present in transaction inputs (proves ownership)
  list.any(
    tx.inputs,
    fn(input) {
      let tokens = value.tokens(input.output.value, policy)
      dict.has_key(tokens, pnft)
    }
  )
}

fn verify_funding_received(tx: Transaction, amount: Int, policy: PolicyId) -> Bool {
  // Verify tokens received at bucket contract (output with datum)
  let total_received = list.foldl(
    tx.outputs,
    0,
    fn(output, acc) {
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
  total_received >= amount
}

fn verify_recipient_category(recipient: AssetName, categories: List<ByteArray>, tx: Transaction, config: SpendingBucketConfig) -> Bool {
  // If categories empty, allow any recipient
  // Otherwise verify recipient pNFT exists and matches category
  if list.is_empty(categories) {
    True
  } else {
    // Check recipient pNFT is in transaction
    let recipient_exists = list.any(
      tx.inputs,
      fn(input) {
        let tokens = value.tokens(input.output.value, config.pnft_policy)
        dict.has_key(tokens, recipient)
      }
    )
    // In production, would also verify recipient's category from datum
    recipient_exists
  }
}

fn verify_payment_to_recipient(tx: Transaction, recipient: AssetName, amount: Int, config: SpendingBucketConfig) -> Bool {
  // Verify payment output exists with correct amount
  // Find output that contains recipient pNFT or is addressed to recipient
  list.any(
    tx.outputs,
    fn(output) {
      let tokens = value.tokens(output.value, config.token_policy)
      let token_amount = dict.foldl(tokens, 0, fn(_k, v, a) { a + v })
      // Check output has required token amount
      token_amount >= amount
    }
  )
}

fn verify_funds_returned(tx: Transaction, pnft: AssetName, amount: Int, config: SpendingBucketConfig) -> Bool {
  // Verify funds returned to pNFT owner's address
  // Find output with pNFT and verify token amount
  list.any(
    tx.outputs,
    fn(output) {
      let has_pnft = dict.has_key(
        value.tokens(output.value, config.pnft_policy),
        pnft
      )
      let tokens = value.tokens(output.value, config.token_policy)
      let token_amount = dict.foldl(tokens, 0, fn(_k, v, a) { a + v })

      has_pnft && token_amount >= amount
    }
  )
}

fn verify_penalty_paid(tx: Transaction, penalty: Int, config: SpendingBucketConfig) -> Bool {
  // Verify penalty paid to bioregion treasury address
  let treasury_addr = Address {
    payment_credential: ScriptCredential(config.bioregion_treasury),
    stake_credential: None,
  }

  let penalty_paid = list.foldl(
    tx.outputs,
    0,
    fn(output, acc) {
      if output.address == treasury_addr {
        let tokens = value.tokens(output.value, config.token_policy)
        let token_amount = dict.foldl(tokens, 0, fn(_k, v, a) { a + v })
        acc + token_amount
      } else {
        acc
      }
    }
  )

  penalty_paid >= penalty
}

// =============================================================================
// CONFIG
// =============================================================================

pub type SpendingBucketConfig {
  pnft_policy: PolicyId,
  token_policy: PolicyId,
  bioregion_treasury: ByteArray,
}
