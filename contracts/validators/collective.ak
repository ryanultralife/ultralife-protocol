// =============================================================================
// UltraLife Protocol — Collective
// =============================================================================
//
// A "business" in UltraLife is NOT a separate entity type.
// It's a CONFIGURATION of existing primitives coordinated by pNFTs:
//
//   COLLECTIVE = pNFTs + Land + Rights + Escrow + Bonds + Governance
//
// This contract manages how multiple pNFTs coordinate around shared resources.
//
// Example: Mountain Yoga Studio
// ├── Sarah's pNFT (human, 60% governance weight)
// ├── Miguel's pNFT (human, 40% governance weight)
// ├── Land NFT for 123 Main St
// │   ├── Surface rights (leased from original steward)
// │   └── Building rights (owned by collective)
// ├── Escrow contract (holds class payments until delivered)
// ├── Quality bond (staked tokens backing service quality)
// └── This collective datum (links everything, defines governance)
//
// The "business" IS the relationship between these primitives.
// There is no separate business identity - only human identities cooperating.
//
// =============================================================================

use aiken/collection/list
use aiken/collection/dict
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId, AssetName, Value, quantity_of}
use cardano/transaction.{
  Transaction, Input, Output, OutputReference,
  InlineDatum,
}

// =============================================================================
// TYPES
// =============================================================================

/// A member of the collective (always a human with pNFT)
pub type CollectiveMember {
  /// The human's pNFT
  pnft: AssetName,
  /// Governance weight (basis points, 10000 = 100%)
  weight_bps: Int,
  /// Role description
  role: ByteArray,
  /// Can approve transactions up to this amount without others
  solo_limit: Int,
  /// When they joined
  joined_at: Int,
}

/// Reference to a shared resource
pub type SharedResource {
  /// Land NFT
  Land {
    land_id: ByteArray,
    rights_held: List<ByteArray>,  // Which rights this collective controls
  }
  /// Escrow for incoming payments
  Escrow {
    escrow_ref: OutputReference,
    purpose: ByteArray,
  }
  /// Quality/performance bond
  Bond {
    bond_ref: OutputReference,
    amount: Int,
    expires_at: Int,
  }
  /// Equipment or inventory
  Asset {
    asset_id: ByteArray,
    description: ByteArray,
    value: Int,
  }
}

/// Governance rules for the collective
pub type GovernanceRules {
  /// Weight needed for daily operations (basis points)
  operations_threshold_bps: Int,
  /// Weight needed to add/remove members
  membership_threshold_bps: Int,
  /// Weight needed to dissolve or transfer major assets
  major_threshold_bps: Int,
  /// Timelock for major decisions (slots)
  major_decision_delay: Int,
}

/// Collective Datum — the "business configuration"
pub type CollectiveDatum {
  /// Human-readable name
  name: ByteArray,
  /// Primary bioregion
  bioregion: ByteArray,
  /// The humans involved
  members: List<CollectiveMember>,
  /// Shared resources
  resources: List<SharedResource>,
  /// How decisions are made
  governance: GovernanceRules,
  /// Business categories for discovery
  categories: List<ByteArray>,
  /// When collective was formed
  formed_at: Int,
  /// Is active
  is_active: Bool,
  /// Cumulative impact generated
  total_impact: Int,
  /// Total transactions processed
  total_transactions: Int,
}

/// Pending major decision
pub type PendingDecision {
  /// What's being decided
  decision_type: DecisionType,
  /// Who has approved (pNFTs)
  approvals: List<AssetName>,
  /// Total weight of approvals
  approval_weight_bps: Int,
  /// When initiated
  initiated_at: Int,
  /// Decision details
  details: ByteArray,
}

/// Types of major decisions
pub type DecisionType {
  AddMember { new_member: CollectiveMember }
  RemoveMember { pnft: AssetName }
  TransferResource { resource_index: Int, to_pnft: AssetName }
  Dissolve
  UpdateGovernance { new_rules: GovernanceRules }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type CollectiveConfig {
  /// pNFT policy for identity
  pnft_policy: PolicyId,
  /// Token policy
  token_policy: PolicyId,
  /// Land rights contract
  land_rights_script: ByteArray,
  /// Escrow contract
  escrow_script: ByteArray,
  /// Minimum members
  min_members: Int,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type CollectiveRedeemer {
  /// Form a new collective
  Form {
    name: ByteArray,
    bioregion: ByteArray,
    initial_members: List<CollectiveMember>,
    governance: GovernanceRules,
    categories: List<ByteArray>,
  }
  
  /// Add a shared resource
  AddResource {
    resource: SharedResource,
  }
  
  /// Remove a shared resource
  RemoveResource {
    resource_index: Int,
  }
  
  /// Process a payment (customer pays collective)
  ReceivePayment {
    from_pnft: AssetName,
    amount: Int,
    purpose: ByteArray,
  }
  
  /// Make a payment (collective pays out)
  MakePayment {
    to_pnft: AssetName,
    amount: Int,
    purpose: ByteArray,
    /// Which member is authorizing
    authorizer: AssetName,
  }
  
  /// Distribute revenue to members
  DistributeRevenue {
    total_amount: Int,
  }
  
  /// Record impact from collective activity
  RecordCollectiveImpact {
    impact_amount: Int,
    impact_category: ByteArray,
  }
  
  /// Initiate a major decision
  InitiateDecision {
    decision: DecisionType,
    initiator: AssetName,
  }
  
  /// Approve a pending decision
  ApproveDecision {
    approver: AssetName,
  }
  
  /// Execute a decision after threshold + delay
  ExecuteDecision
  
  /// Cancel a pending decision
  CancelDecision {
    canceller: AssetName,
  }
  
  /// Update collective info (name, categories)
  UpdateInfo {
    new_name: Option<ByteArray>,
    new_categories: Option<List<ByteArray>>,
  }
  
  /// Deactivate collective (pause operations)
  Deactivate
  
  /// Reactivate collective
  Reactivate
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator collective(config: CollectiveConfig) {
  spend(
    datum: CollectiveDatum,
    redeemer: CollectiveRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      // =========================================================================
      // FORM COLLECTIVE
      // =========================================================================
      Form { name, bioregion, initial_members, governance, categories } -> {
        // 1. All initial members have valid pNFTs that signed
        let all_signed = list.all(
          initial_members,
          fn(m) { verify_pnft_signed(tx, m.pnft, config.pnft_policy) }
        )
        
        // 2. At least minimum members
        let enough_members = list.length(initial_members) >= config.min_members
        
        // 3. Weights sum to 10000 (100%)
        let valid_weights = verify_weights_sum(initial_members)
        
        // 4. Valid governance thresholds
        let valid_governance = verify_governance_rules(governance, initial_members)
        
        // 5. Creates proper datum
        let creates_datum = verify_collective_formed(
          tx, own_ref, name, bioregion, initial_members, governance, categories
        )
        
        all_signed && enough_members && valid_weights && valid_governance && creates_datum
      }
      
      // =========================================================================
      // ADD RESOURCE
      // =========================================================================
      AddResource { resource } -> {
        // 1. Operations threshold met
        let threshold_met = verify_governance_threshold(
          tx, datum.members, datum.governance.operations_threshold_bps, config.pnft_policy
        )
        
        // 2. Resource is valid and controlled
        let resource_valid = verify_resource_controlled(tx, resource, datum.members, config)
        
        // 3. Updates datum correctly
        let updates_correctly = verify_resource_added(tx, own_ref, datum, resource)
        
        threshold_met && resource_valid && updates_correctly
      }
      
      // =========================================================================
      // RECEIVE PAYMENT
      // =========================================================================
      ReceivePayment { from_pnft, amount, purpose } -> {
        // Collective is active
        let is_active = datum.is_active
        
        // Payment actually received
        let payment_received = verify_tokens_received(tx, config.token_policy, amount)
        
        // Updates transaction count
        let updates_stats = verify_stats_incremented(tx, own_ref, datum, amount)
        
        is_active && payment_received && updates_stats
      }
      
      // =========================================================================
      // MAKE PAYMENT
      // =========================================================================
      MakePayment { to_pnft, amount, purpose, authorizer } -> {
        // 1. Collective is active
        let is_active = datum.is_active
        
        // 2. Authorizer is a member
        expect Some(member) = list.find(datum.members, fn(m) { m.pnft == authorizer })
        
        // 3. Authorizer signed
        let authorizer_signed = verify_pnft_signed(tx, authorizer, config.pnft_policy)
        
        // 4. Either within solo limit OR operations threshold met
        let authorized = 
          amount <= member.solo_limit ||
          verify_governance_threshold(
            tx, datum.members, datum.governance.operations_threshold_bps, config.pnft_policy
          )
        
        // 5. Payment actually made
        let payment_made = verify_payment_to_pnft(tx, to_pnft, amount, config)
        
        is_active && authorizer_signed && authorized && payment_made
      }
      
      // =========================================================================
      // DISTRIBUTE REVENUE
      // =========================================================================
      DistributeRevenue { total_amount } -> {
        // 1. Operations threshold met
        let threshold_met = verify_governance_threshold(
          tx, datum.members, datum.governance.operations_threshold_bps, config.pnft_policy
        )
        
        // 2. Distribution matches weights
        let distribution_correct = verify_distribution(
          tx, datum.members, total_amount, config
        )
        
        threshold_met && distribution_correct
      }
      
      // =========================================================================
      // RECORD COLLECTIVE IMPACT
      // =========================================================================
      RecordCollectiveImpact { impact_amount, impact_category } -> {
        // 1. Operations threshold met
        let threshold_met = verify_governance_threshold(
          tx, datum.members, datum.governance.operations_threshold_bps, config.pnft_policy
        )
        
        // 2. Impact tokens minted/burned appropriately
        let impact_recorded = verify_impact_tokens(tx, impact_amount, impact_category)
        
        // 3. Updates total impact
        let updates_impact = verify_impact_updated(tx, own_ref, datum, impact_amount)
        
        threshold_met && impact_recorded && updates_impact
      }
      
      // =========================================================================
      // INITIATE DECISION
      // =========================================================================
      InitiateDecision { decision, initiator } -> {
        // 1. Initiator is a member
        let is_member = list.any(datum.members, fn(m) { m.pnft == initiator })
        
        // 2. Initiator signed
        let signed = verify_pnft_signed(tx, initiator, config.pnft_policy)
        
        // 3. No pending decision already
        let no_pending = verify_no_pending_decision(tx.reference_inputs, own_ref)
        
        // 4. Creates pending decision datum
        let creates_pending = verify_decision_initiated(tx, own_ref, datum, decision, initiator)
        
        is_member && signed && no_pending && creates_pending
      }
      
      // =========================================================================
      // APPROVE DECISION
      // =========================================================================
      ApproveDecision { approver } -> {
        // 1. Approver is a member
        expect Some(member) = list.find(datum.members, fn(m) { m.pnft == approver })
        
        // 2. Approver signed
        let signed = verify_pnft_signed(tx, approver, config.pnft_policy)
        
        // 3. Not already approved
        // 4. Updates approval correctly
        let updates_correctly = verify_approval_recorded(tx, own_ref, approver, member.weight_bps)
        
        signed && updates_correctly
      }
      
      // =========================================================================
      // EXECUTE DECISION
      // =========================================================================
      ExecuteDecision -> {
        // Get pending decision from datum
        // 1. Threshold met based on decision type
        // 2. Delay passed for major decisions
        // 3. Execute the actual change
        verify_decision_executable(tx, own_ref, datum)
      }
      
      // =========================================================================
      // UPDATE INFO
      // =========================================================================
      UpdateInfo { new_name, new_categories } -> {
        // Operations threshold met
        let threshold_met = verify_governance_threshold(
          tx, datum.members, datum.governance.operations_threshold_bps, config.pnft_policy
        )
        
        // Updates correctly
        let updates_correctly = verify_info_updated(tx, own_ref, datum, new_name, new_categories)
        
        threshold_met && updates_correctly
      }
      
      // =========================================================================
      // DEACTIVATE / REACTIVATE
      // =========================================================================
      Deactivate -> {
        let threshold_met = verify_governance_threshold(
          tx, datum.members, datum.governance.membership_threshold_bps, config.pnft_policy
        )
        let is_active = datum.is_active
        let updates = verify_deactivated(tx, own_ref, datum)
        
        threshold_met && is_active && updates
      }
      
      Reactivate -> {
        let threshold_met = verify_governance_threshold(
          tx, datum.members, datum.governance.membership_threshold_bps, config.pnft_policy
        )
        let is_inactive = !datum.is_active
        let updates = verify_reactivated(tx, own_ref, datum)
        
        threshold_met && is_inactive && updates
      }
      
      _ -> False
    }
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/// Verify pNFT holder signed the transaction
fn verify_pnft_signed(
  tx: Transaction,
  pnft: AssetName,
  policy: PolicyId,
) -> Bool {
  list.any(
    tx.inputs,
    fn(input) { quantity_of(input.output.value, policy, pnft) == 1 }
  )
}

/// Verify governance threshold is met by signers
fn verify_governance_threshold(
  tx: Transaction,
  members: List<CollectiveMember>,
  threshold_bps: Int,
  pnft_policy: PolicyId,
) -> Bool {
  let signing_weight = list.foldl(
    members,
    0,
    fn(member, acc) {
      if verify_pnft_signed(tx, member.pnft, pnft_policy) {
        acc + member.weight_bps
      } else {
        acc
      }
    }
  )
  signing_weight >= threshold_bps
}

/// Verify member weights sum to 10000 (100%)
fn verify_weights_sum(members: List<CollectiveMember>) -> Bool {
  let total = list.foldl(members, 0, fn(m, acc) { acc + m.weight_bps })
  total == 10000
}

/// Verify governance rules are valid
fn verify_governance_rules(rules: GovernanceRules, members: List<CollectiveMember>) -> Bool {
  // Thresholds must be achievable (at least one member combination can meet them)
  rules.operations_threshold_bps > 0 &&
  rules.operations_threshold_bps <= 10000 &&
  rules.membership_threshold_bps > 0 &&
  rules.membership_threshold_bps <= 10000 &&
  rules.major_threshold_bps > 0 &&
  rules.major_threshold_bps <= 10000
}

/// Verify collective formation creates correct datum
fn verify_collective_formed(
  tx: Transaction,
  own_ref: OutputReference,
  name: ByteArray,
  bioregion: ByteArray,
  members: List<CollectiveMember>,
  governance: GovernanceRules,
  categories: List<ByteArray>,
) -> Bool {
  list.any(
    tx.outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(d) -> {
          expect datum: CollectiveDatum = d
          datum.name == name &&
          datum.bioregion == bioregion &&
          datum.members == members &&
          datum.governance == governance &&
          datum.categories == categories &&
          datum.is_active == True &&
          datum.total_impact == 0 &&
          datum.total_transactions == 0 &&
          list.is_empty(datum.resources)
        }
        _ -> False
      }
    }
  )
}

/// Verify resource is actually controlled by collective members
fn verify_resource_controlled(
  tx: Transaction,
  resource: SharedResource,
  members: List<CollectiveMember>,
  config: CollectiveConfig,
) -> Bool {
  when resource is {
    Land { land_id, rights_held } -> {
      // Land NFT must be in inputs, controlled by a member
      True // Would verify land ownership
    }
    Escrow { escrow_ref, purpose } -> {
      // Escrow must reference this collective
      True
    }
    Bond { bond_ref, amount, expires_at } -> {
      // Bond must be staked by member(s)
      True
    }
    Asset { asset_id, description, value } -> {
      // Asset tracking
      True
    }
  }
}

/// Verify distribution matches member weights
fn verify_distribution(
  tx: Transaction,
  members: List<CollectiveMember>,
  total_amount: Int,
  config: CollectiveConfig,
) -> Bool {
  list.all(
    members,
    fn(member) {
      let expected_share = total_amount * member.weight_bps / 10000
      // Verify member received their share
      verify_payment_to_pnft(tx, member.pnft, expected_share, config)
    }
  )
}

// Stub implementations for remaining helpers
fn verify_resource_added(tx: Transaction, own_ref: OutputReference, datum: CollectiveDatum, resource: SharedResource) -> Bool { True }
fn verify_tokens_received(tx: Transaction, policy: PolicyId, amount: Int) -> Bool { True }
fn verify_stats_incremented(tx: Transaction, own_ref: OutputReference, datum: CollectiveDatum, amount: Int) -> Bool { True }
fn verify_payment_to_pnft(tx: Transaction, pnft: AssetName, amount: Int, config: CollectiveConfig) -> Bool { True }
fn verify_impact_tokens(tx: Transaction, amount: Int, category: ByteArray) -> Bool { True }
fn verify_impact_updated(tx: Transaction, own_ref: OutputReference, datum: CollectiveDatum, amount: Int) -> Bool { True }
fn verify_no_pending_decision(refs: List<Input>, own_ref: OutputReference) -> Bool { True }
fn verify_decision_initiated(tx: Transaction, own_ref: OutputReference, datum: CollectiveDatum, decision: DecisionType, initiator: AssetName) -> Bool { True }
fn verify_approval_recorded(tx: Transaction, own_ref: OutputReference, approver: AssetName, weight: Int) -> Bool { True }
fn verify_decision_executable(tx: Transaction, own_ref: OutputReference, datum: CollectiveDatum) -> Bool { True }
fn verify_info_updated(tx: Transaction, own_ref: OutputReference, datum: CollectiveDatum, name: Option<ByteArray>, cats: Option<List<ByteArray>>) -> Bool { True }
fn verify_deactivated(tx: Transaction, own_ref: OutputReference, datum: CollectiveDatum) -> Bool { True }
fn verify_reactivated(tx: Transaction, own_ref: OutputReference, datum: CollectiveDatum) -> Bool { True }
