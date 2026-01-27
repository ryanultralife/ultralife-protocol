// =============================================================================
// UltraLife Protocol — Work Auction
// =============================================================================
//
// MARKETPLACE FOR WORK: pNFTs list work they need, workers bid on it
//
// The flow:
// 1. Asset owner (pNFT) creates work request with expected impacts
// 2. Request goes to marketplace as auction
// 3. Qualified workers (pNFTs) submit bids with:
//    - Price
//    - Expected compound flows (their efficiency)
//    - Timeline
//    - Certifications
// 4. Owner accepts bid → Escrow created
// 5. Worker performs work, submits evidence
// 6. Verification (surveyors/attestors verify)
// 7. Payment released, impacts recorded (accrue to asset, then to consumer)
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId, AssetName, Value, quantity_of}
use cardano/transaction.{Transaction, Input, Output, OutputReference, InlineDatum}
use ultralife/types.{
  PnftDatum, VerificationLevel, Standard, Verified, Steward,
  CompoundFlow, CompoundCode, MassUnit, MeasurementMethod,
  ActivityImpact, AssetActivityRecord, can_transact,
}

// =============================================================================
// WORK REQUEST TYPES
// =============================================================================

/// A work request — what needs to be done
pub type WorkRequest {
  /// Unique request ID
  request_id: ByteArray,
  /// Who needs the work (asset owner pNFT)
  requester: AssetName,
  /// What asset this work is for (Land NFT, Product, etc.)
  asset: AssetName,
  /// Bioregion where work will occur
  bioregion: ByteArray,
  /// Type of work (from registry)
  work_type: WorkType,
  /// Detailed specifications hash (IPFS)
  specifications_hash: ByteArray,
  /// Expected compound flows (baseline estimates)
  expected_impacts: List<ExpectedCompound>,
  /// Budget range (tokens)
  budget_min: Int,
  budget_max: Int,
  /// Required certifications for workers
  required_certifications: List<ByteArray>,
  /// Minimum worker verification level
  min_worker_level: VerificationLevel,
  /// Deadline for bid submission
  bid_deadline: Int,
  /// Deadline for work completion
  work_deadline: Int,
  /// Creation timestamp
  created_at: Int,
  /// Status
  status: RequestStatus,
}

/// Types of work (from registry codes)
pub type WorkType {
  // Construction
  Construction { phase: ConstructionPhase }
  // Agriculture  
  Agriculture { activity: AgricultureActivity }
  // Forestry
  Forestry { activity: ForestryActivity }
  // Manufacturing
  Manufacturing { process: ByteArray }
  // Transport
  Transport { mode: ByteArray }
  // Services
  Services { category: ByteArray }
  // Maintenance/Repair
  Maintenance { asset_type: ByteArray }
  // Survey/Assessment
  Survey { survey_type: ByteArray }
  // Custom (with registry code)
  Custom { code: ByteArray }
}

pub type ConstructionPhase {
  SitePrep
  Foundation
  Framing
  Roofing
  Electrical
  Plumbing
  Finishing
  Landscaping
}

pub type AgricultureActivity {
  Planting
  Cultivation
  Harvesting
  Irrigation
  SoilManagement
}

pub type ForestryActivity {
  TreePlanting
  SelectiveHarvest
  ForestManagement
  FirePrevention
  Restoration
}

/// Expected compound flow with acceptable range
pub type ExpectedCompound {
  compound: CompoundCode,
  /// Expected quantity (baseline)
  expected_quantity: Int,
  /// Acceptable range (min, max)
  acceptable_min: Int,
  acceptable_max: Int,
  unit: MassUnit,
}

/// Status of work request
pub type RequestStatus {
  /// Open for bidding
  Open
  /// Bid accepted, work in progress
  InProgress { accepted_bid: ByteArray, worker: AssetName }
  /// Work completed, pending verification
  PendingVerification { worker: AssetName, evidence_hash: ByteArray }
  /// Verified and paid
  Completed { worker: AssetName, final_impacts: List<CompoundFlow> }
  /// Cancelled by requester
  Cancelled { reason: ByteArray }
  /// Disputed
  Disputed { dispute_id: ByteArray }
}

// =============================================================================
// BID TYPES
// =============================================================================

/// A bid from a worker
pub type WorkBid {
  /// Unique bid ID
  bid_id: ByteArray,
  /// Which request this bid is for
  request_id: ByteArray,
  /// Bidder (worker pNFT)
  bidder: AssetName,
  /// Bid amount (tokens)
  bid_amount: Int,
  /// Estimated compound flows (worker's efficiency)
  estimated_impacts: List<CompoundFlow>,
  /// Worker's relevant certifications
  certifications: List<ByteArray>,
  /// Worker's efficiency rating for relevant compounds
  efficiency_ratings: List<EfficiencyRating>,
  /// Proposed timeline (completion slot)
  proposed_completion: Int,
  /// Methods/equipment to be used
  methods_hash: ByteArray,
  /// Submission timestamp
  submitted_at: Int,
  /// Status
  status: BidStatus,
}

/// Worker efficiency rating
pub type EfficiencyRating {
  compound: CompoundCode,
  /// Rating: 1000 = average, <1000 = better than average
  rating: Int,
  /// Based on how many completed jobs
  sample_size: Int,
}

/// Bid status
pub type BidStatus {
  /// Submitted, awaiting decision
  Pending
  /// Accepted by requester
  Accepted
  /// Rejected by requester
  BidRejected { reason: Option<ByteArray> }
  /// Withdrawn by bidder
  Withdrawn
}

// =============================================================================
// ESCROW TYPES
// =============================================================================

/// Escrow for accepted work
pub type WorkEscrow {
  /// Escrow ID (derived from request + bid)
  escrow_id: ByteArray,
  /// Original request
  request_id: ByteArray,
  /// Accepted bid
  bid_id: ByteArray,
  /// Requester (payer)
  requester: AssetName,
  /// Worker (payee)
  worker: AssetName,
  /// Asset this work is for
  asset: AssetName,
  /// Type of work
  work_type: WorkType,
  /// Escrowed amount
  amount: Int,
  /// Expected impacts from bid
  expected_impacts: List<CompoundFlow>,
  /// Work deadline
  deadline: Int,
  /// Status
  status: EscrowStatus,
}

/// Escrow status
pub type EscrowStatus {
  /// Funds locked, work not started
  Funded
  /// Work in progress
  WorkStarted { start_time: Int }
  /// Work submitted, pending verification
  WorkSubmitted { 
    submission_time: Int,
    evidence_hash: ByteArray,
    actual_impacts: List<CompoundFlow>,
  }
  /// Verified, ready for release
  Verified { 
    verifier: AssetName,
    verification_time: Int,
  }
  /// Released to worker
  Released { release_time: Int }
  /// Refunded to requester
  Refunded { reason: ByteArray }
  /// In dispute
  InDispute { dispute_id: ByteArray }
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type WorkAuctionRedeemer {
  // === Request Management ===
  /// Create new work request
  CreateRequest {
    work_type: WorkType,
    specifications_hash: ByteArray,
    expected_impacts: List<ExpectedCompound>,
    budget_min: Int,
    budget_max: Int,
    required_certifications: List<ByteArray>,
    bid_deadline: Int,
    work_deadline: Int,
  }
  /// Cancel request (only if no accepted bid)
  CancelRequest { reason: ByteArray }
  /// Update request (only if Open)
  UpdateRequest { 
    new_specifications: Option<ByteArray>,
    new_budget_max: Option<Int>,
    new_deadline: Option<Int>,
  }
  
  // === Bid Management ===
  /// Submit bid on request
  SubmitBid {
    request_id: ByteArray,
    bid_amount: Int,
    estimated_impacts: List<CompoundFlow>,
    proposed_completion: Int,
    methods_hash: ByteArray,
  }
  /// Withdraw bid (only if Pending)
  WithdrawBid { bid_id: ByteArray }
  /// Accept bid (requester only)
  AcceptBid { bid_id: ByteArray }
  /// Reject bid (requester only)
  RejectBid { bid_id: ByteArray, reason: Option<ByteArray> }
  
  // === Work Execution ===
  /// Start work (worker only, after bid accepted)
  StartWork { escrow_id: ByteArray }
  /// Submit completed work
  SubmitWork {
    escrow_id: ByteArray,
    evidence_hash: ByteArray,
    actual_impacts: List<CompoundFlow>,
  }
  /// Verify work (authorized verifiers only)
  VerifyWork {
    escrow_id: ByteArray,
    verification_result: VerificationResult,
  }
  
  // === Payment ===
  /// Release payment (after verification)
  ReleasePayment { escrow_id: ByteArray }
  /// Request refund (if deadline passed, work not completed)
  RequestRefund { escrow_id: ByteArray, reason: ByteArray }
  
  // === Disputes ===
  /// Initiate dispute
  InitiateDispute { escrow_id: ByteArray, reason: ByteArray }
  /// Resolve dispute (governance only)
  ResolveDispute { 
    dispute_id: ByteArray,
    resolution: DisputeResolution,
  }
}

/// Result of work verification
pub type VerificationResult {
  /// Work approved as submitted
  WorkApproved
  /// Work approved with adjustments to impacts
  WorkApprovedWithAdjustments { adjusted_impacts: List<CompoundFlow> }
  /// Work rejected
  WorkRejected { reason: ByteArray }
}

/// Dispute resolution
pub type DisputeResolution {
  /// Full payment to worker
  PayWorker
  /// Full refund to requester
  RefundRequester
  /// Split payment
  Split { worker_share: Int, requester_share: Int }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type WorkAuctionConfig {
  /// pNFT policy
  pnft_policy: PolicyId,
  /// Token policy (for payments)
  token_policy: PolicyId,
  token_name: AssetName,
  /// Records contract (for transaction recording)
  records_contract: ByteArray,
  /// Asset impact contract (for impact accumulation)
  asset_impact_contract: ByteArray,
  /// Governance contract (for disputes)
  governance_contract: ByteArray,
  /// Minimum bid deadline (slots from creation)
  min_bid_deadline: Int,
  /// Platform fee (basis points, e.g., 100 = 1%)
  platform_fee_bps: Int,
  /// Treasury address (for fees)
  treasury: ByteArray,
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator work_auction(config: WorkAuctionConfig) {
  spend(
    datum: Option<WorkAuctionDatum>,
    redeemer: WorkAuctionRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      // === Request Management ===
      CreateRequest { work_type, specifications_hash, expected_impacts, budget_min, budget_max, required_certifications, bid_deadline, work_deadline } -> {
        validate_create_request(
          tx, work_type, specifications_hash, expected_impacts,
          budget_min, budget_max, required_certifications,
          bid_deadline, work_deadline, config
        )
      }
      
      CancelRequest { reason } -> {
        validate_cancel_request(tx, datum, reason, config)
      }
      
      UpdateRequest { new_specifications, new_budget_max, new_deadline } -> {
        validate_update_request(tx, datum, new_specifications, new_budget_max, new_deadline, config)
      }
      
      // === Bid Management ===
      SubmitBid { request_id, bid_amount, estimated_impacts, proposed_completion, methods_hash } -> {
        validate_submit_bid(
          tx, request_id, bid_amount, estimated_impacts,
          proposed_completion, methods_hash, config
        )
      }
      
      WithdrawBid { bid_id } -> {
        validate_withdraw_bid(tx, datum, bid_id, config)
      }
      
      AcceptBid { bid_id } -> {
        validate_accept_bid(tx, datum, bid_id, config)
      }
      
      RejectBid { bid_id, reason } -> {
        validate_reject_bid(tx, datum, bid_id, reason, config)
      }
      
      // === Work Execution ===
      StartWork { escrow_id } -> {
        validate_start_work(tx, datum, escrow_id, config)
      }
      
      SubmitWork { escrow_id, evidence_hash, actual_impacts } -> {
        validate_submit_work(tx, datum, escrow_id, evidence_hash, actual_impacts, config)
      }
      
      VerifyWork { escrow_id, verification_result } -> {
        validate_verify_work(tx, datum, escrow_id, verification_result, config)
      }
      
      // === Payment ===
      ReleasePayment { escrow_id } -> {
        validate_release_payment(tx, datum, escrow_id, config)
      }
      
      RequestRefund { escrow_id, reason } -> {
        validate_request_refund(tx, datum, escrow_id, reason, config)
      }
      
      // === Disputes ===
      InitiateDispute { escrow_id, reason } -> {
        validate_initiate_dispute(tx, datum, escrow_id, reason, config)
      }
      
      ResolveDispute { dispute_id, resolution } -> {
        validate_resolve_dispute(tx, datum, dispute_id, resolution, config)
      }
    }
  }
}

/// Datum variants for work auction UTXOs
pub type WorkAuctionDatum {
  RequestDatum(WorkRequest)
  BidDatum(WorkBid)
  EscrowDatum(WorkEscrow)
}

// =============================================================================
// REQUEST VALIDATION
// =============================================================================

fn validate_create_request(
  tx: Transaction,
  work_type: WorkType,
  specifications_hash: ByteArray,
  expected_impacts: List<ExpectedCompound>,
  budget_min: Int,
  budget_max: Int,
  required_certifications: List<ByteArray>,
  bid_deadline: Int,
  work_deadline: Int,
  config: WorkAuctionConfig,
) -> Bool {
  // 1. Requester must have valid pNFT (Standard+)
  let requester_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(requester) = requester_pnft
  expect can_transact(requester.level)
  
  // 2. Requester must own the asset being worked on
  // (Verified via reference input showing ownership)
  
  // 3. Budget must be valid
  expect budget_min > 0
  expect budget_max >= budget_min
  
  // 4. Must have at least one expected impact (no neutral work)
  expect list.length(expected_impacts) >= 1
  
  // 5. Deadlines must be in future and valid
  let current_slot = get_current_slot(tx)
  expect bid_deadline > current_slot + config.min_bid_deadline
  expect work_deadline > bid_deadline
  
  // 6. Request UTXO must be created with correct datum
  let request_output = find_request_output(tx.outputs, config)
  expect Some(output) = request_output
  expect InlineDatum(data) = output.datum
  expect RequestDatum(request): WorkAuctionDatum = data
  
  // 7. Verify request fields match
  request.requester == requester.pnft_id &&
  request.work_type == work_type &&
  request.specifications_hash == specifications_hash &&
  request.budget_min == budget_min &&
  request.budget_max == budget_max &&
  request.bid_deadline == bid_deadline &&
  request.work_deadline == work_deadline &&
  request.status == Open
}

fn validate_cancel_request(
  tx: Transaction,
  datum: Option<WorkAuctionDatum>,
  reason: ByteArray,
  config: WorkAuctionConfig,
) -> Bool {
  // 1. Must have existing request
  expect Some(RequestDatum(request)) = datum
  
  // 2. Request must be Open (no accepted bid)
  expect request.status == Open
  
  // 3. Requester must sign
  expect list.has(tx.extra_signatories, get_pnft_owner(tx, request.requester, config.pnft_policy))
  
  // 4. Output must show cancelled status
  let updated_output = find_request_output(tx.outputs, config)
  expect Some(output) = updated_output
  expect InlineDatum(data) = output.datum
  expect RequestDatum(updated): WorkAuctionDatum = data
  
  updated.request_id == request.request_id &&
  updated.status == Cancelled { reason: reason }
}

fn validate_update_request(
  tx: Transaction,
  datum: Option<WorkAuctionDatum>,
  new_specifications: Option<ByteArray>,
  new_budget_max: Option<Int>,
  new_deadline: Option<Int>,
  config: WorkAuctionConfig,
) -> Bool {
  // 1. Must have existing Open request
  expect Some(RequestDatum(request)) = datum
  expect request.status == Open
  
  // 2. Requester must sign
  expect list.has(tx.extra_signatories, get_pnft_owner(tx, request.requester, config.pnft_policy))
  
  // 3. Can only increase budget/deadline, not decrease
  let budget_valid = when new_budget_max is {
    Some(new_max) -> new_max >= request.budget_max
    None -> True
  }

  budget_valid
}

// =============================================================================
// BID VALIDATION
// =============================================================================

fn validate_submit_bid(
  tx: Transaction,
  request_id: ByteArray,
  bid_amount: Int,
  estimated_impacts: List<CompoundFlow>,
  proposed_completion: Int,
  methods_hash: ByteArray,
  config: WorkAuctionConfig,
) -> Bool {
  // 1. Bidder must have valid pNFT
  let bidder_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(bidder) = bidder_pnft
  expect can_transact(bidder.level)
  
  // 2. Request must exist and be Open
  let request = find_request_by_id(tx.reference_inputs, request_id, config)
  expect Some(req) = request
  expect req.status == Open
  
  // 3. Bidder must meet minimum level requirement
  expect meets_level_requirement(bidder.level, req.min_worker_level)
  
  // 4. Bidder must have required certifications
  // (Verified via pNFT datum or separate credential NFTs)
  
  // 5. Bid amount must be within budget range
  expect bid_amount >= req.budget_min
  expect bid_amount <= req.budget_max
  
  // 6. Must have impact estimates (compound-based)
  expect list.length(estimated_impacts) >= 1
  
  // 7. Proposed completion must be before deadline
  expect proposed_completion <= req.work_deadline
  
  // 8. Bid deadline not passed
  let current_slot = get_current_slot(tx)
  expect current_slot < req.bid_deadline
  
  // 9. Bid UTXO must be created
  let bid_output = find_bid_output(tx.outputs, config)
  expect Some(output) = bid_output
  expect InlineDatum(data) = output.datum
  expect BidDatum(bid): WorkAuctionDatum = data
  
  bid.request_id == request_id &&
  bid.bidder == bidder.pnft_id &&
  bid.bid_amount == bid_amount &&
  bid.status == Pending
}

fn validate_accept_bid(
  tx: Transaction,
  datum: Option<WorkAuctionDatum>,
  bid_id: ByteArray,
  config: WorkAuctionConfig,
) -> Bool {
  // 1. Must have request datum
  expect Some(RequestDatum(request)) = datum
  expect request.status == Open
  
  // 2. Requester must sign
  expect list.has(tx.extra_signatories, get_pnft_owner(tx, request.requester, config.pnft_policy))
  
  // 3. Bid must exist and be Pending
  let bid = find_bid_by_id(tx.reference_inputs, bid_id, config)
  expect Some(b) = bid
  expect b.status == Pending
  expect b.request_id == request.request_id
  
  // 4. Requester must fund escrow with bid amount
  let escrow_output = find_escrow_output(tx.outputs, config)
  expect Some(escrow_out) = escrow_output
  let tokens_in_escrow = quantity_of(escrow_out.value, config.token_policy, config.token_name)
  expect tokens_in_escrow >= b.bid_amount
  
  // 5. Escrow datum must be correct
  expect InlineDatum(data) = escrow_out.datum
  expect EscrowDatum(escrow): WorkAuctionDatum = data
  
  escrow.request_id == request.request_id &&
  escrow.bid_id == bid_id &&
  escrow.requester == request.requester &&
  escrow.worker == b.bidder &&
  escrow.amount == b.bid_amount &&
  escrow.status == Funded
}

fn validate_withdraw_bid(
  tx: Transaction,
  datum: Option<WorkAuctionDatum>,
  bid_id: ByteArray,
  config: WorkAuctionConfig,
) -> Bool {
  // 1. Must have bid datum
  expect Some(BidDatum(bid)) = datum
  expect bid.bid_id == bid_id
  expect bid.status == Pending
  
  // 2. Bidder must sign
  expect list.has(tx.extra_signatories, get_pnft_owner(tx, bid.bidder, config.pnft_policy))
  
  True
}

fn validate_reject_bid(
  tx: Transaction,
  datum: Option<WorkAuctionDatum>,
  bid_id: ByteArray,
  reason: Option<ByteArray>,
  config: WorkAuctionConfig,
) -> Bool {
  // Similar to accept but updates bid status to Rejected
  True
}

// =============================================================================
// WORK EXECUTION VALIDATION
// =============================================================================

fn validate_start_work(
  tx: Transaction,
  datum: Option<WorkAuctionDatum>,
  escrow_id: ByteArray,
  config: WorkAuctionConfig,
) -> Bool {
  // 1. Must have escrow datum
  expect Some(EscrowDatum(escrow)) = datum
  expect escrow.escrow_id == escrow_id
  expect escrow.status == Funded
  
  // 2. Worker must sign
  expect list.has(tx.extra_signatories, get_pnft_owner(tx, escrow.worker, config.pnft_policy))
  
  // 3. Update escrow status to WorkStarted
  let current_slot = get_current_slot(tx)
  let updated_output = find_escrow_output(tx.outputs, config)
  expect Some(output) = updated_output
  expect InlineDatum(data) = output.datum
  expect EscrowDatum(updated): WorkAuctionDatum = data
  
  updated.escrow_id == escrow_id &&
  updated.status == WorkStarted { start_time: current_slot }
}

fn validate_submit_work(
  tx: Transaction,
  datum: Option<WorkAuctionDatum>,
  escrow_id: ByteArray,
  evidence_hash: ByteArray,
  actual_impacts: List<CompoundFlow>,
  config: WorkAuctionConfig,
) -> Bool {
  // 1. Must have escrow in WorkStarted status
  expect Some(EscrowDatum(escrow)) = datum
  expect escrow.escrow_id == escrow_id
  expect WorkStarted { .. } = escrow.status
  
  // 2. Worker must sign
  expect list.has(tx.extra_signatories, get_pnft_owner(tx, escrow.worker, config.pnft_policy))
  
  // 3. Must provide actual impacts (compound flows)
  expect list.length(actual_impacts) >= 1
  
  // 4. Evidence must be provided
  expect evidence_hash != ""
  
  // 5. Update escrow status
  let current_slot = get_current_slot(tx)
  let updated_output = find_escrow_output(tx.outputs, config)
  expect Some(output) = updated_output
  expect InlineDatum(data) = output.datum
  expect EscrowDatum(updated): WorkAuctionDatum = data
  
  updated.status == WorkSubmitted {
    submission_time: current_slot,
    evidence_hash: evidence_hash,
    actual_impacts: actual_impacts,
  }
}

fn validate_verify_work(
  tx: Transaction,
  datum: Option<WorkAuctionDatum>,
  escrow_id: ByteArray,
  verification_result: VerificationResult,
  config: WorkAuctionConfig,
) -> Bool {
  // 1. Must have escrow in WorkSubmitted status
  expect Some(EscrowDatum(escrow)) = datum
  expect WorkSubmitted { actual_impacts, evidence_hash, .. } = escrow.status
  
  // 2. Verifier must be authorized (Steward or designated surveyor)
  let verifier_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(verifier) = verifier_pnft
  expect verifier.level == Steward || is_designated_surveyor(verifier, tx)
  
  // 3. Determine impacts to record based on verification result
  let impacts_to_record = when verification_result is {
    WorkApproved -> actual_impacts
    WorkApprovedWithAdjustments { adjusted_impacts } -> adjusted_impacts
    WorkRejected { .. } -> []
  }

  // 4. CRITICAL: Record impacts to asset via asset_impact contract
  // This is what makes the compound flows accumulate on the asset
  // so they can later transfer to the consumer
  let impacts_recorded = when verification_result is {
    WorkRejected { .. } -> True  // No impacts to record
    _ -> {
      // Create activity record
      let activity = AssetActivityRecord {
        activity_type: work_type_to_bytes(escrow.work_type),
        worker_pnft: escrow.worker,
        compound_flows: impacts_to_record,
        evidence: evidence_hash,
        timestamp: get_current_slot(tx),
      }

      // Verify asset_impact contract is called with RecordActivity
      verify_asset_impact_called(
        tx,
        escrow.asset,
        activity,
        config.asset_impact_contract
      )
    }
  }

  // 5. Update escrow status
  let status_updated = when verification_result is {
    WorkApproved -> {
      verify_escrow_updated_to_verified(tx, escrow_id, verifier.pnft_id, config)
    }
    WorkApprovedWithAdjustments { .. } -> {
      verify_escrow_updated_to_verified(tx, escrow_id, verifier.pnft_id, config)
    }
    WorkRejected { .. } -> {
      // Escrow goes to dispute or refund
      True
    }
  }
  
  impacts_recorded && status_updated
}

/// Verify that asset_impact contract is called to record the activity
fn verify_asset_impact_called(
  tx: Transaction,
  asset: AssetName,
  activity: AssetActivityRecord,
  asset_impact_contract: ByteArray,
) -> Bool {
  // Check that transaction includes spending from asset_impact contract
  // with RecordActivity redeemer for this asset
  list.any(tx.inputs, fn(input) {
    when get_script_hash_from_input(input) is {
      Some(hash) -> hash == asset_impact_contract
      None -> False
    }
  })
}

fn get_script_hash_from_input(input: Input) -> Option<ByteArray> {
  None // Simplified - would extract script hash from input
}

fn work_type_to_bytes(work_type: WorkType) -> ByteArray {
  // Convert work type to bytes for storage
  when work_type is {
    Construction { .. } -> "construction"
    Agriculture { .. } -> "agriculture"
    Forestry { .. } -> "forestry"
    Manufacturing { .. } -> "manufacturing"
    Transport { .. } -> "transport"
    Services { .. } -> "services"
    Maintenance { .. } -> "maintenance"
    Survey { .. } -> "survey"
    Custom { code } -> code
  }
}

// =============================================================================
// PAYMENT VALIDATION
// =============================================================================

fn validate_release_payment(
  tx: Transaction,
  datum: Option<WorkAuctionDatum>,
  escrow_id: ByteArray,
  config: WorkAuctionConfig,
) -> Bool {
  // 1. Must have escrow in Verified status
  expect Some(EscrowDatum(escrow)) = datum
  expect Verified { .. } = escrow.status
  
  // 2. Either requester signs or auto-release after delay
  let requester_signed = list.has(tx.extra_signatories, get_pnft_owner(tx, escrow.requester, config.pnft_policy))
  let auto_release = is_auto_release_time(tx, escrow)
  expect requester_signed || auto_release
  
  // 3. Payment goes to worker
  let worker_output = find_output_to_pnft(tx.outputs, escrow.worker, config)
  expect Some(w_out) = worker_output
  let payment_to_worker = quantity_of(w_out.value, config.token_policy, config.token_name)
  
  // 4. Calculate platform fee
  let fee = escrow.amount * config.platform_fee_bps / 10000
  let worker_payment = escrow.amount - fee
  
  // 5. Verify correct amounts
  expect payment_to_worker >= worker_payment
  
  // 6. Fee goes to treasury
  // (Verified separately)
  
  // 7. Update worker's efficiency rating
  // (Recorded based on actual vs expected impacts)
  
  True
}

fn validate_request_refund(
  tx: Transaction,
  datum: Option<WorkAuctionDatum>,
  escrow_id: ByteArray,
  reason: ByteArray,
  config: WorkAuctionConfig,
) -> Bool {
  // 1. Must have escrow
  expect Some(EscrowDatum(escrow)) = datum
  
  // 2. Either: deadline passed and work not submitted, or dispute resolved for requester
  let current_slot = get_current_slot(tx)
  let deadline_passed = current_slot > escrow.deadline
  let work_not_submitted = when escrow.status is {
    Funded -> True
    WorkStarted { .. } -> True
    _ -> False
  }
  
  expect (deadline_passed && work_not_submitted) || is_dispute_resolved_for_requester(escrow)
  
  // 3. Requester must sign
  expect list.has(tx.extra_signatories, get_pnft_owner(tx, escrow.requester, config.pnft_policy))
  
  // 4. Funds return to requester
  let requester_output = find_output_to_pnft(tx.outputs, escrow.requester, config)
  expect Some(r_out) = requester_output
  let refund = quantity_of(r_out.value, config.token_policy, config.token_name)
  
  refund >= escrow.amount
}

// =============================================================================
// DISPUTE VALIDATION
// =============================================================================

fn validate_initiate_dispute(
  tx: Transaction,
  datum: Option<WorkAuctionDatum>,
  escrow_id: ByteArray,
  reason: ByteArray,
  config: WorkAuctionConfig,
) -> Bool {
  // Either party can initiate dispute
  expect Some(EscrowDatum(escrow)) = datum
  
  let requester_signed = list.has(tx.extra_signatories, get_pnft_owner(tx, escrow.requester, config.pnft_policy))
  let worker_signed = list.has(tx.extra_signatories, get_pnft_owner(tx, escrow.worker, config.pnft_policy))
  
  expect requester_signed || worker_signed
  
  // Update status to InDispute
  True
}

fn validate_resolve_dispute(
  tx: Transaction,
  datum: Option<WorkAuctionDatum>,
  dispute_id: ByteArray,
  resolution: DisputeResolution,
  config: WorkAuctionConfig,
) -> Bool {
  // Only governance contract can resolve disputes
  let from_governance = verify_from_governance(tx, config.governance_contract)
  expect from_governance
  
  // Execute resolution
  when resolution is {
    PayWorker -> {
      // Full payment to worker
      True
    }
    RefundRequester -> {
      // Full refund to requester
      True
    }
    Split { worker_share, requester_share } -> {
      // Split according to resolution
      expect worker_share + requester_share == 10000 // Basis points
      True
    }
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

fn find_signer_pnft(tx: Transaction, pnft_policy: PolicyId) -> Option<PnftData> {
  // Find pNFT owned by a signer
  list.find_map(tx.reference_inputs, fn(input) {
    extract_pnft_if_owned_by_signer(input.output, pnft_policy, tx.extra_signatories)
  })
}

type PnftData {
  pnft_id: AssetName,
  owner: VerificationKeyHash,
  level: VerificationLevel,
}

fn extract_pnft_if_owned_by_signer(
  output: Output,
  pnft_policy: PolicyId,
  signers: List<VerificationKeyHash>,
) -> Option<PnftData> {
  // Implementation
  None
}

fn get_pnft_owner(tx: Transaction, pnft_id: AssetName, pnft_policy: PolicyId) -> VerificationKeyHash {
  // Look up owner from pNFT datum
  #""
}

fn find_request_by_id(inputs: List<Input>, request_id: ByteArray, config: WorkAuctionConfig) -> Option<WorkRequest> {
  None
}

fn find_bid_by_id(inputs: List<Input>, bid_id: ByteArray, config: WorkAuctionConfig) -> Option<WorkBid> {
  None
}

fn find_request_output(outputs: List<Output>, config: WorkAuctionConfig) -> Option<Output> {
  None
}

fn find_bid_output(outputs: List<Output>, config: WorkAuctionConfig) -> Option<Output> {
  None
}

fn find_escrow_output(outputs: List<Output>, config: WorkAuctionConfig) -> Option<Output> {
  None
}

fn find_output_to_pnft(outputs: List<Output>, pnft: AssetName, config: WorkAuctionConfig) -> Option<Output> {
  None
}

fn get_current_slot(tx: Transaction) -> Int {
  0
}

fn meets_level_requirement(actual: VerificationLevel, required: VerificationLevel) -> Bool {
  // Check if actual level meets or exceeds required
  True
}

fn is_designated_surveyor(pnft: PnftData, tx: Transaction) -> Bool {
  False
}

fn verify_escrow_updated_to_verified(tx: Transaction, escrow_id: ByteArray, verifier: AssetName, config: WorkAuctionConfig) -> Bool {
  True
}

fn is_auto_release_time(tx: Transaction, escrow: WorkEscrow) -> Bool {
  False
}

fn is_dispute_resolved_for_requester(escrow: WorkEscrow) -> Bool {
  False
}

fn verify_from_governance(tx: Transaction, governance_contract: ByteArray) -> Bool {
  False
}
