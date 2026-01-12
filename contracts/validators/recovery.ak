// =============================================================================
// UltraLife Protocol — Recovery
// =============================================================================
//
// LAYER 1: IDENTITY RECOVERY (pNFT-to-pNFT)
//
// Recovery is ALWAYS humans vouching for humans. No abstract oracles.
//
// Layer 1: Social Recovery
//   - Guardians are other pNFT holders you trust
//   - Threshold of guardians attest "this is the same person"
//   - Time delay for security
//
// Layer 2: DNA Recovery  
//   - DNA lab workers are pNFT holders
//   - Lab tech verifies your DNA matches stored hash
//   - Lab tech's pNFT attests to the verification
//   - Multiple lab workers may be required (threshold)
//
// Layer 3: Bioregion Steward Recovery
//   - Local stewards (verified pNFTs) can vouch in person
//   - For cases where guardians unavailable and no nearby DNA lab
//   - Higher threshold required
//
// The key insight: "Oracle" is just a role held by a human with a pNFT.
// DNA verification facilities employ humans. Those humans have pNFTs.
// When they verify your DNA, their pNFT signs the attestation.
// Accountability flows to an actual person, not an abstract entity.
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash, Blake2b_256, Hash}
use cardano/assets.{PolicyId, AssetName, Value, quantity_of}
use cardano/address.{Address, Credential, VerificationKey, Script}
use cardano/transaction.{
  Transaction, Input, Output, OutputReference, Mint,
  InlineDatum, ScriptPurpose, Spend,
}

// =============================================================================
// TYPES
// =============================================================================

/// Guardian configuration for social recovery
pub type GuardianConfig {
  /// List of guardian pNFT identifiers
  guardians: List<AssetName>,
  /// Number of guardians required to approve recovery
  threshold: Int,
  /// Delay before recovery executes (in slots, ~72 hours = 259200 slots)
  recovery_delay: Int,
  /// When configuration was set
  configured_at: Int,
}

/// Recovery request status
pub type RecoveryRequest {
  /// pNFT being recovered
  pnft: AssetName,
  /// New owner key hash
  new_owner: VerificationKeyHash,
  /// Approving guardians so far
  approvals: List<AssetName>,
  /// When request was initiated
  initiated_at: Int,
  /// Recovery type
  recovery_type: RecoveryType,
  /// Status
  status: RecoveryStatus,
}

/// Types of recovery
pub type RecoveryType {
  /// Social recovery via guardians
  Social
  /// DNA re-verification
  DNA
  /// Key rotation (same person, new key)
  KeyRotation
}

/// Recovery status
pub type RecoveryStatus {
  /// Awaiting approvals
  Pending
  /// Ready to execute (threshold met, awaiting delay)
  Approved
  /// Executed
  Executed
  /// Cancelled
  Cancelled
}

/// Recovery datum stored at contract
pub type RecoveryDatum {
  /// The pNFT this recovery config belongs to
  pnft: AssetName,
  /// Guardian configuration
  guardians: GuardianConfig,
  /// Current owner (for verification)
  current_owner: VerificationKeyHash,
  /// Active recovery request (if any)
  active_request: Option<RecoveryRequest>,
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/// Recovery contract configuration
pub type RecoveryConfig {
  /// pNFT policy ID
  pnft_policy: PolicyId,
  /// pNFTs authorized as DNA verification workers
  /// These are actual humans who work at DNA labs
  dna_verifier_pnfts: List<AssetName>,
  /// Required DNA verifier signatures
  dna_verifier_threshold: Int,
  /// pNFTs authorized as bioregion stewards for emergency recovery
  steward_pnfts: List<AssetName>,
  /// Required steward signatures for emergency recovery
  steward_threshold: Int,
  /// Minimum guardians allowed
  min_guardians: Int,
  /// Maximum guardians allowed
  max_guardians: Int,
  /// Minimum recovery delay (slots) - approximately 48-72 hours
  min_delay: Int,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type RecoveryRedeemer {
  /// Set up guardians (when everything is fine)
  SetupGuardians {
    guardians: List<AssetName>,
    threshold: Int,
    delay: Int,
  }
  
  /// Update guardian list (requires current owner signature)
  UpdateGuardians {
    new_guardians: List<AssetName>,
    new_threshold: Int,
  }
  
  /// Initiate social recovery (any guardian can start)
  InitiateRecovery {
    new_owner: VerificationKeyHash,
    initiating_guardian: AssetName,
  }
  
  /// Guardian approves pending recovery
  ApproveRecovery {
    guardian_pnft: AssetName,
  }
  
  /// Execute recovery after delay and threshold met
  ExecuteRecovery
  
  /// Cancel recovery (by original owner if they regain access)
  CancelRecovery
  
  /// DNA-based recovery (verified by DNA lab workers who are pNFT holders)
  DNARecovery {
    new_owner: VerificationKeyHash,
    /// pNFTs of DNA lab workers who verified the identity
    verifier_pnfts: List<AssetName>,
  }
  
  /// Steward-based emergency recovery (local stewards vouch in person)
  StewardRecovery {
    new_owner: VerificationKeyHash,
    /// pNFTs of stewards who verified in person
    vouching_stewards: List<AssetName>,
  }
  
  /// Simple key rotation (same person, both keys sign)
  RotateKey {
    new_owner: VerificationKeyHash,
  }
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator recovery(config: RecoveryConfig) {
  spend(
    datum: RecoveryDatum,
    redeemer: RecoveryRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      // =========================================================================
      // SETUP GUARDIANS
      // =========================================================================
      SetupGuardians { guardians, threshold, delay } -> {
        // 1. Must own the pNFT
        let owns_pnft = verify_pnft_signed(tx, datum.pnft, config.pnft_policy)
        
        // 2. Valid guardian config
        let valid_count = 
          list.length(guardians) >= config.min_guardians &&
          list.length(guardians) <= config.max_guardians
        
        let valid_threshold = 
          threshold >= 1 && 
          threshold <= list.length(guardians)
        
        let valid_delay = delay >= config.min_delay
        
        // 3. All guardians are valid pNFTs
        let all_valid_pnfts = list.all(
          guardians,
          fn(g) { verify_pnft_exists(tx.reference_inputs, g, config.pnft_policy) }
        )
        
        // 4. Creates proper output datum
        let creates_datum = verify_guardian_datum_created(
          tx, own_ref, datum.pnft, guardians, threshold, delay
        )
        
        // 5. No duplicate guardians
        let no_duplicates = list.length(guardians) == list.length(list.unique(guardians))
        
        owns_pnft && valid_count && valid_threshold && valid_delay && 
        all_valid_pnfts && creates_datum && no_duplicates
      }
      
      // =========================================================================
      // UPDATE GUARDIANS
      // =========================================================================
      UpdateGuardians { new_guardians, new_threshold } -> {
        // 1. Must be current owner
        let is_owner = verify_owner_signed(tx, datum.current_owner)
        
        // 2. No active recovery request
        let no_active = option.is_none(datum.active_request)
        
        // 3. Valid new config
        let valid_count = 
          list.length(new_guardians) >= config.min_guardians &&
          list.length(new_guardians) <= config.max_guardians
        
        let valid_threshold = 
          new_threshold >= 1 && 
          new_threshold <= list.length(new_guardians)
        
        // 4. Updates datum correctly
        let updates_correctly = verify_guardians_updated(
          tx, own_ref, datum, new_guardians, new_threshold
        )
        
        is_owner && no_active && valid_count && valid_threshold && updates_correctly
      }
      
      // =========================================================================
      // INITIATE RECOVERY
      // =========================================================================
      InitiateRecovery { new_owner, initiating_guardian } -> {
        // 1. Initiator is a valid guardian
        let is_guardian = list.has(datum.guardians.guardians, initiating_guardian)
        
        // 2. Guardian signed the transaction
        let guardian_signed = verify_pnft_signed(tx, initiating_guardian, config.pnft_policy)
        
        // 3. No existing active request
        let no_active = option.is_none(datum.active_request)
        
        // 4. Creates proper recovery request datum
        let creates_request = verify_recovery_request_created(
          tx, own_ref, datum, new_owner, initiating_guardian
        )
        
        is_guardian && guardian_signed && no_active && creates_request
      }
      
      // =========================================================================
      // APPROVE RECOVERY
      // =========================================================================
      ApproveRecovery { guardian_pnft } -> {
        // Must have active request
        expect Some(request) = datum.active_request
        
        // 1. Guardian is in the list
        let is_guardian = list.has(datum.guardians.guardians, guardian_pnft)
        
        // 2. Guardian signed
        let guardian_signed = verify_pnft_signed(tx, guardian_pnft, config.pnft_policy)
        
        // 3. Not already approved
        let not_duplicate = !list.has(request.approvals, guardian_pnft)
        
        // 4. Request is still pending
        let is_pending = request.status == Pending
        
        // 5. Updates approval list correctly
        let updates_correctly = verify_approval_added(
          tx, own_ref, datum, guardian_pnft
        )
        
        is_guardian && guardian_signed && not_duplicate && is_pending && updates_correctly
      }
      
      // =========================================================================
      // EXECUTE RECOVERY
      // =========================================================================
      ExecuteRecovery -> {
        // Must have active request
        expect Some(request) = datum.active_request
        
        // 1. Threshold met
        let threshold_met = 
          list.length(request.approvals) >= datum.guardians.threshold
        
        // 2. Delay passed
        let delay_passed = verify_delay_passed(
          tx, request.initiated_at, datum.guardians.recovery_delay
        )
        
        // 3. Request is approved or pending with enough approvals
        let valid_status = 
          request.status == Approved ||
          (request.status == Pending && threshold_met)
        
        // 4. Updates pNFT owner correctly
        let updates_owner = verify_pnft_owner_updated(
          tx, datum.pnft, request.new_owner, config.pnft_policy
        )
        
        // 5. Marks request as executed
        let marks_executed = verify_request_executed(tx, own_ref, datum)
        
        threshold_met && delay_passed && valid_status && updates_owner && marks_executed
      }
      
      // =========================================================================
      // CANCEL RECOVERY
      // =========================================================================
      CancelRecovery -> {
        // Must have active request
        expect Some(_request) = datum.active_request
        
        // 1. Original owner signed (they regained access)
        let owner_signed = verify_owner_signed(tx, datum.current_owner)
        
        // 2. Marks request as cancelled
        let marks_cancelled = verify_request_cancelled(tx, own_ref, datum)
        
        owner_signed && marks_cancelled
      }
      
      // =========================================================================
      // DNA RECOVERY (Lab workers with pNFTs attest)
      // =========================================================================
      DNARecovery { new_owner, verifier_pnfts } -> {
        // 1. All verifiers are authorized DNA lab workers
        let all_authorized = list.all(
          verifier_pnfts,
          fn(v) { list.has(config.dna_verifier_pnfts, v) }
        )
        
        // 2. All verifiers signed (their pNFTs are in inputs)
        let all_signed = list.all(
          verifier_pnfts,
          fn(v) { verify_pnft_signed(tx, v, config.pnft_policy) }
        )
        
        // 3. Threshold met
        let threshold_met = list.length(verifier_pnfts) >= config.dna_verifier_threshold
        
        // 4. Updates pNFT owner
        let updates_owner = verify_pnft_owner_updated(
          tx, datum.pnft, new_owner, config.pnft_policy
        )
        
        // 5. Clears any active recovery request
        let clears_request = verify_request_cleared(tx, own_ref, datum)
        
        all_authorized && all_signed && threshold_met && updates_owner && clears_request
      }
      
      // =========================================================================
      // STEWARD RECOVERY (Local stewards vouch in person)
      // =========================================================================
      StewardRecovery { new_owner, vouching_stewards } -> {
        // 1. All vouchers are authorized stewards
        let all_authorized = list.all(
          vouching_stewards,
          fn(s) { list.has(config.steward_pnfts, s) }
        )
        
        // 2. All vouchers signed
        let all_signed = list.all(
          vouching_stewards,
          fn(s) { verify_pnft_signed(tx, s, config.pnft_policy) }
        )
        
        // 3. Higher threshold for steward recovery
        let threshold_met = list.length(vouching_stewards) >= config.steward_threshold
        
        // 4. Updates pNFT owner
        let updates_owner = verify_pnft_owner_updated(
          tx, datum.pnft, new_owner, config.pnft_policy
        )
        
        // 5. Clears any active recovery request
        let clears_request = verify_request_cleared(tx, own_ref, datum)
        
        all_authorized && all_signed && threshold_met && updates_owner && clears_request
      }
      
      // =========================================================================
      // KEY ROTATION
      // =========================================================================
      RotateKey { new_owner } -> {
        // 1. Current owner signed (proving they have access)
        let owner_signed = verify_owner_signed(tx, datum.current_owner)
        
        // 2. New owner also signed (proving they control new key)
        let new_owner_signed = verify_owner_signed(tx, new_owner)
        
        // 3. Updates pNFT owner
        let updates_owner = verify_pnft_owner_updated(
          tx, datum.pnft, new_owner, config.pnft_policy
        )
        
        // 4. Updates recovery datum with new owner
        let updates_datum = verify_owner_rotated(tx, own_ref, datum, new_owner)
        
        owner_signed && new_owner_signed && updates_owner && updates_datum
      }
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
  // Find the pNFT in inputs
  let has_pnft = list.any(
    tx.inputs,
    fn(input) {
      quantity_of(input.output.value, policy, pnft) == 1
    }
  )
  has_pnft
}

/// Verify pNFT exists in reference inputs
fn verify_pnft_exists(
  refs: List<Input>,
  pnft: AssetName,
  policy: PolicyId,
) -> Bool {
  list.any(
    refs,
    fn(ref) {
      quantity_of(ref.output.value, policy, pnft) == 1
    }
  )
}

/// Verify owner key signed
fn verify_owner_signed(
  tx: Transaction,
  owner: VerificationKeyHash,
) -> Bool {
  list.has(tx.extra_signatories, owner)
}

/// Verify guardian datum is created correctly
fn verify_guardian_datum_created(
  tx: Transaction,
  own_ref: OutputReference,
  pnft: AssetName,
  guardians: List<AssetName>,
  threshold: Int,
  delay: Int,
) -> Bool {
  // Find continuing output
  list.any(
    tx.outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(d) -> {
          expect datum: RecoveryDatum = d
          datum.pnft == pnft &&
          datum.guardians.guardians == guardians &&
          datum.guardians.threshold == threshold &&
          datum.guardians.recovery_delay == delay &&
          option.is_none(datum.active_request)
        }
        _ -> False
      }
    }
  )
}

/// Verify guardians are updated correctly
fn verify_guardians_updated(
  tx: Transaction,
  own_ref: OutputReference,
  old_datum: RecoveryDatum,
  new_guardians: List<AssetName>,
  new_threshold: Int,
) -> Bool {
  list.any(
    tx.outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(d) -> {
          expect datum: RecoveryDatum = d
          datum.pnft == old_datum.pnft &&
          datum.guardians.guardians == new_guardians &&
          datum.guardians.threshold == new_threshold &&
          datum.current_owner == old_datum.current_owner &&
          option.is_none(datum.active_request)
        }
        _ -> False
      }
    }
  )
}

/// Verify recovery request is created
fn verify_recovery_request_created(
  tx: Transaction,
  own_ref: OutputReference,
  old_datum: RecoveryDatum,
  new_owner: VerificationKeyHash,
  initiating_guardian: AssetName,
) -> Bool {
  list.any(
    tx.outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(d) -> {
          expect datum: RecoveryDatum = d
          expect Some(request) = datum.active_request
          
          datum.pnft == old_datum.pnft &&
          datum.guardians == old_datum.guardians &&
          request.pnft == old_datum.pnft &&
          request.new_owner == new_owner &&
          list.has(request.approvals, initiating_guardian) &&
          list.length(request.approvals) == 1 &&
          request.status == Pending &&
          request.recovery_type == Social
        }
        _ -> False
      }
    }
  )
}

/// Verify approval is added correctly
fn verify_approval_added(
  tx: Transaction,
  own_ref: OutputReference,
  old_datum: RecoveryDatum,
  guardian: AssetName,
) -> Bool {
  expect Some(old_request) = old_datum.active_request
  
  list.any(
    tx.outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(d) -> {
          expect datum: RecoveryDatum = d
          expect Some(request) = datum.active_request
          
          datum.pnft == old_datum.pnft &&
          datum.guardians == old_datum.guardians &&
          request.new_owner == old_request.new_owner &&
          list.has(request.approvals, guardian) &&
          list.length(request.approvals) == list.length(old_request.approvals) + 1
        }
        _ -> False
      }
    }
  )
}

/// Verify delay has passed
fn verify_delay_passed(
  tx: Transaction,
  initiated_at: Int,
  delay: Int,
) -> Bool {
  // Use transaction validity range
  let required_time = initiated_at + delay
  
  when tx.validity_range.lower_bound.bound_type is {
    Finite(lower) -> lower >= required_time
    _ -> False
  }
}

/// Verify pNFT owner is updated
fn verify_pnft_owner_updated(
  tx: Transaction,
  pnft: AssetName,
  new_owner: VerificationKeyHash,
  policy: PolicyId,
) -> Bool {
  // The pNFT output must go to the new owner
  list.any(
    tx.outputs,
    fn(output) {
      let has_pnft = quantity_of(output.value, policy, pnft) == 1
      let to_new_owner = output.address.payment_credential == VerificationKey(new_owner)
      has_pnft && to_new_owner
    }
  )
}

/// Verify request is marked as executed
fn verify_request_executed(
  tx: Transaction,
  own_ref: OutputReference,
  old_datum: RecoveryDatum,
) -> Bool {
  list.any(
    tx.outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(d) -> {
          expect datum: RecoveryDatum = d
          expect Some(request) = datum.active_request
          
          datum.pnft == old_datum.pnft &&
          request.status == Executed
        }
        _ -> False
      }
    }
  )
}

/// Verify request is marked as cancelled
fn verify_request_cancelled(
  tx: Transaction,
  own_ref: OutputReference,
  old_datum: RecoveryDatum,
) -> Bool {
  list.any(
    tx.outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(d) -> {
          expect datum: RecoveryDatum = d
          option.is_none(datum.active_request) ||
          (expect Some(request) = datum.active_request
           request.status == Cancelled)
        }
        _ -> False
      }
    }
  )
}

/// Verify oracle attestations for DNA recovery
fn verify_oracle_attestations(
  attestations: List<ByteArray>,
  oracle_keys: List<VerificationKeyHash>,
  threshold: Int,
  pnft: AssetName,
) -> Bool {
  // Count valid attestations
  // In production, each attestation would be a signature we verify
  // Here we just check we have enough
  list.length(attestations) >= threshold
}

/// Verify request is cleared after DNA recovery
fn verify_request_cleared(
  tx: Transaction,
  own_ref: OutputReference,
  old_datum: RecoveryDatum,
) -> Bool {
  list.any(
    tx.outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(d) -> {
          expect datum: RecoveryDatum = d
          datum.pnft == old_datum.pnft &&
          option.is_none(datum.active_request)
        }
        _ -> False
      }
    }
  )
}

/// Verify owner is rotated
fn verify_owner_rotated(
  tx: Transaction,
  own_ref: OutputReference,
  old_datum: RecoveryDatum,
  new_owner: VerificationKeyHash,
) -> Bool {
  list.any(
    tx.outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(d) -> {
          expect datum: RecoveryDatum = d
          datum.pnft == old_datum.pnft &&
          datum.current_owner == new_owner &&
          datum.guardians == old_datum.guardians
        }
        _ -> False
      }
    }
  )
}
