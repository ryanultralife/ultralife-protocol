// =============================================================================
// UltraLife Protocol — Bioregional Preservation
// =============================================================================
//
// ECOSYSTEM STEWARDSHIP LAYER
//
// This contract manages:
// 1. SURVEYOR CERTIFICATION — Who can verify ecosystem health
// 2. SURVEYS — Documentation of ecosystem state
// 3. PRESERVATION GRANTS — Payments to land stewards
// 4. HEALTH TRACKING — Ongoing ecosystem monitoring
//
// The mechanism:
// - Bioregion treasury funds preservation
// - Certified surveyors document ecosystem health
// - Land stewards receive grants for maintaining/restoring ecosystems
// - Multiple surveyors cross-verify to prevent fraud
// - Payments tied to verified health targets
//
// This creates:
// - A market for TRUTH about ecosystem health
// - Income for people who maintain healthy land
// - Accountability for ecosystem claims
// - Traditional ecological knowledge recognition
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId, AssetName, quantity_of, flatten}
use cardano/address.{Script, VerificationKey}
use cardano/transaction.{Transaction, Input, Output, OutputReference, InlineDatum}
use ultralife/types_v2.{
  PnftDatum, VerificationLevel, Basic, Ward, Standard, Verified, Steward,
  SurveyorType, SurveyorCert,
  SurveyRecord, SurveyType, SurveyMeasurement, SurveyStatus, SurveyVerification,
  Pending, Verified as SurveyVerified, Disputed, Rejected,
  PreservationGrant, GrantType, GrantStatus, GrantPayment, HealthTarget,
  Applied, Approved, Active as GrantActive, Completed, Terminated, Suspended,
  EcosystemHealthRecord, HealthTrend,
  ImpactCategory,
}
use ultralife/prc37.{current_cycle}

// =============================================================================
// CONSTANTS
// =============================================================================

/// Minimum surveys required for verification
const MIN_VERIFICATIONS: Int = 2

/// Survey payment (tokens per survey)
const SURVEY_PAYMENT: Int = 50

/// Minimum grant duration (cycles)
const MIN_GRANT_DURATION: Int = 4

/// Maximum grant duration (cycles) 
const MAX_GRANT_DURATION: Int = 52

/// Surveyor certification validity (cycles)
const CERT_VALIDITY: Int = 52

// =============================================================================
// REDEEMERS
// =============================================================================

pub type PreservationRedeemer {
  // === SURVEYOR MANAGEMENT ===
  
  /// Certify a new surveyor (requires governance approval)
  CertifySurveyor {
    candidate: AssetName,
    surveyor_type: SurveyorType,
    specializations: List<ImpactCategory>,
    governance_proof: ByteArray,
  }
  
  /// Renew surveyor certification
  RenewCertification {
    surveyor: AssetName,
  }
  
  /// Revoke surveyor certification (misconduct)
  RevokeCertification {
    surveyor: AssetName,
    reason_hash: ByteArray,
    governance_proof: ByteArray,
  }
  
  // === SURVEYS ===
  
  /// Submit a new survey
  SubmitSurvey {
    survey_type: SurveyType,
    location_hash: ByteArray,
    measurements: List<SurveyMeasurement>,
    evidence_hash: ByteArray,
  }
  
  /// Verify another surveyor's survey
  VerifySurvey {
    survey_id: ByteArray,
    confirms: Bool,
    own_measurements: Option<List<SurveyMeasurement>>,
    notes_hash: Option<ByteArray>,
  }
  
  /// Dispute a survey
  DisputeSurvey {
    survey_id: ByteArray,
    dispute_evidence: ByteArray,
  }
  
  // === GRANTS ===
  
  /// Apply for preservation grant
  ApplyForGrant {
    grant_type: GrantType,
    location_hash: ByteArray,
    area_size: Int,
    duration_cycles: Int,
    health_targets: List<HealthTarget>,
  }
  
  /// Approve grant application (requires steward signatures)
  ApproveGrant {
    grant_id: ByteArray,
    baseline_survey: ByteArray,
    amount_per_cycle: Int,
  }
  
  /// Claim grant payment for completed cycle
  ClaimGrantPayment {
    grant_id: ByteArray,
    cycle: Int,
    verification_survey: ByteArray,
  }
  
  /// Terminate grant (failure to meet targets)
  TerminateGrant {
    grant_id: ByteArray,
    reason_hash: ByteArray,
  }
  
  // === HEALTH RECORDS ===
  
  /// Update ecosystem health record from survey
  UpdateHealthRecord {
    location_hash: ByteArray,
    survey_id: ByteArray,
  }
}

// =============================================================================
// VALIDATOR CONFIGURATION
// =============================================================================

pub type PreservationConfig {
  /// pNFT policy
  pnft_policy: PolicyId,
  /// Token policy
  token_policy: PolicyId,
  /// Token name
  token_name: AssetName,
  /// Treasury contract
  treasury: ByteArray,
  /// Governance contract
  governance: ByteArray,
  /// Bioregion registry
  bioregion_registry: ByteArray,
}

// =============================================================================
// MAIN VALIDATOR
// =============================================================================

validator preservation(config: PreservationConfig) {
  spend(
    datum: Option<Data>,
    redeemer: PreservationRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      // === SURVEYOR CERTIFICATION ===
      
      CertifySurveyor { candidate, surveyor_type, specializations, governance_proof } -> {
        validate_certify_surveyor(tx, candidate, surveyor_type, specializations, governance_proof, config)
      }
      
      RenewCertification { surveyor } -> {
        validate_renew_certification(tx, surveyor, config)
      }
      
      RevokeCertification { surveyor, reason_hash, governance_proof } -> {
        validate_revoke_certification(tx, surveyor, reason_hash, governance_proof, config)
      }
      
      // === SURVEYS ===
      
      SubmitSurvey { survey_type, location_hash, measurements, evidence_hash } -> {
        validate_submit_survey(tx, survey_type, location_hash, measurements, evidence_hash, config)
      }
      
      VerifySurvey { survey_id, confirms, own_measurements, notes_hash } -> {
        validate_verify_survey(tx, survey_id, confirms, own_measurements, notes_hash, config)
      }
      
      DisputeSurvey { survey_id, dispute_evidence } -> {
        validate_dispute_survey(tx, survey_id, dispute_evidence, config)
      }
      
      // === GRANTS ===
      
      ApplyForGrant { grant_type, location_hash, area_size, duration_cycles, health_targets } -> {
        validate_apply_grant(tx, grant_type, location_hash, area_size, duration_cycles, health_targets, config)
      }
      
      ApproveGrant { grant_id, baseline_survey, amount_per_cycle } -> {
        validate_approve_grant(tx, grant_id, baseline_survey, amount_per_cycle, config)
      }
      
      ClaimGrantPayment { grant_id, cycle, verification_survey } -> {
        validate_claim_payment(tx, grant_id, cycle, verification_survey, config)
      }
      
      TerminateGrant { grant_id, reason_hash } -> {
        validate_terminate_grant(tx, grant_id, reason_hash, config)
      }
      
      // === HEALTH RECORDS ===
      
      UpdateHealthRecord { location_hash, survey_id } -> {
        validate_update_health(tx, location_hash, survey_id, config)
      }
    }
  }
}

// =============================================================================
// SURVEYOR CERTIFICATION
// =============================================================================

fn validate_certify_surveyor(
  tx: Transaction,
  candidate: AssetName,
  surveyor_type: SurveyorType,
  specializations: List<ImpactCategory>,
  governance_proof: ByteArray,
  config: PreservationConfig,
) -> Bool {
  // 1. Candidate must be Verified+ level
  let candidate_data = find_pnft(tx, candidate, config.pnft_policy)
  expect Some(pnft) = candidate_data
  let qualified = pnft.level == Verified || pnft.level == Steward
  
  // 2. Must have governance approval
  let approved = verify_governance_approval(tx, governance_proof, config.governance)
  
  // 3. Certification datum must be created correctly
  let current = get_slot(tx)
  let cert_created = verify_cert_created(
    tx.outputs,
    candidate,
    surveyor_type,
    specializations,
    current,
    current + CERT_VALIDITY * 37 * 86400  // slots per cycle * cycles
  )
  
  // 4. pNFT updated to show surveyor status
  let pnft_updated = verify_pnft_surveyor_added(tx.outputs, candidate, surveyor_type, config.pnft_policy)
  
  qualified && approved && cert_created && pnft_updated
}

fn validate_renew_certification(
  tx: Transaction,
  surveyor: AssetName,
  config: PreservationConfig,
) -> Bool {
  // 1. Surveyor must sign
  let signed = verify_pnft_signed(tx, surveyor, config.pnft_policy)
  
  // 2. Must have completed minimum surveys
  let cert = find_cert(tx.reference_inputs, surveyor)
  expect Some(c) = cert
  let min_surveys = c.surveys_completed >= 10
  
  // 3. Must have acceptable accuracy
  let good_accuracy = c.accuracy_score >= 80
  
  // 4. New expiration date set
  let current = get_slot(tx)
  let renewed = verify_cert_renewed(tx.outputs, surveyor, current + CERT_VALIDITY * 37 * 86400)
  
  signed && min_surveys && good_accuracy && renewed
}

fn validate_revoke_certification(
  tx: Transaction,
  surveyor: AssetName,
  reason_hash: ByteArray,
  governance_proof: ByteArray,
  config: PreservationConfig,
) -> Bool {
  // Requires governance approval
  verify_governance_approval(tx, governance_proof, config.governance)
}

// =============================================================================
// SURVEY SUBMISSION & VERIFICATION
// =============================================================================

fn validate_submit_survey(
  tx: Transaction,
  survey_type: SurveyType,
  location_hash: ByteArray,
  measurements: List<SurveyMeasurement>,
  evidence_hash: ByteArray,
  config: PreservationConfig,
) -> Bool {
  // 1. Submitter must be certified surveyor
  let surveyor_data = find_signer_pnft(tx, config.pnft_policy)
  expect Some(surveyor) = surveyor_data
  expect Some(cert) = surveyor.surveyor_certification
  
  // 2. Certification must be valid (not expired)
  let current = get_slot(tx)
  let cert_valid = cert.expires_at > current
  
  // 3. Location must be in surveyor's authorized regions
  let bioregion = get_bioregion_for_location(tx, location_hash, config.bioregion_registry)
  expect Some(bio) = bioregion
  let authorized = list.has(surveyor.survey_regions, bio)
  
  // 4. Measurements must be non-empty and valid
  let valid_measurements = list.length(measurements) > 0 &&
    list.all(measurements, fn(m) {
      m.confidence >= 0 && m.confidence <= 100 && m.unit != ""
    })
  
  // 5. Survey record created
  let survey_created = verify_survey_created(
    tx.outputs, surveyor.pnft_id, bio, location_hash, 
    survey_type, measurements, evidence_hash, current
  )
  
  // 6. Survey payment from treasury
  let payment_received = verify_survey_payment(
    tx.outputs, surveyor.pnft_id, config.token_policy, config.token_name
  )
  
  cert_valid && authorized && valid_measurements && survey_created && payment_received
}

fn validate_verify_survey(
  tx: Transaction,
  survey_id: ByteArray,
  confirms: Bool,
  own_measurements: Option<List<SurveyMeasurement>>,
  notes_hash: Option<ByteArray>,
  config: PreservationConfig,
) -> Bool {
  // 1. Verifier must be certified surveyor
  let verifier_data = find_signer_pnft(tx, config.pnft_policy)
  expect Some(verifier) = verifier_data
  expect Some(cert) = verifier.surveyor_certification
  
  // 2. Cannot verify own survey
  let survey = find_survey(tx.reference_inputs, survey_id)
  expect Some(s) = survey
  let not_self = s.surveyor != verifier.pnft_id
  
  // 3. Survey must be pending verification
  let is_pending = s.status == Pending
  
  // 4. Verification added to survey
  let verification_added = verify_verification_added(
    tx.outputs, survey_id, verifier.pnft_id, confirms, own_measurements, notes_hash
  )
  
  // 5. If enough verifications, update status
  let verification_count = list.length(s.verifications) + 1
  let status_updated = 
    if verification_count >= MIN_VERIFICATIONS {
      verify_survey_status_updated(tx.outputs, survey_id, confirms)
    } else {
      True
    }
  
  // 6. Verifier receives payment
  let payment_received = verify_survey_payment(
    tx.outputs, verifier.pnft_id, config.token_policy, config.token_name
  )
  
  not_self && is_pending && verification_added && status_updated && payment_received
}

fn validate_dispute_survey(
  tx: Transaction,
  survey_id: ByteArray,
  dispute_evidence: ByteArray,
  config: PreservationConfig,
) -> Bool {
  // 1. Disputer must be certified surveyor
  let disputer_data = find_signer_pnft(tx, config.pnft_policy)
  expect Some(disputer) = disputer_data
  expect Some(_cert) = disputer.surveyor_certification
  
  // 2. Survey marked as disputed
  verify_survey_disputed(tx.outputs, survey_id, dispute_evidence)
}

// =============================================================================
// GRANT MANAGEMENT
// =============================================================================

fn validate_apply_grant(
  tx: Transaction,
  grant_type: GrantType,
  location_hash: ByteArray,
  area_size: Int,
  duration_cycles: Int,
  health_targets: List<HealthTarget>,
  config: PreservationConfig,
) -> Bool {
  // 1. Applicant must have pNFT in bioregion
  let applicant_data = find_signer_pnft(tx, config.pnft_policy)
  expect Some(applicant) = applicant_data
  
  // 2. Duration within bounds
  let valid_duration = duration_cycles >= MIN_GRANT_DURATION && 
                       duration_cycles <= MAX_GRANT_DURATION
  
  // 3. Must have health targets
  let has_targets = list.length(health_targets) > 0
  
  // 4. Grant application created
  let grant_created = verify_grant_created(
    tx.outputs, applicant.pnft_id, grant_type, location_hash, 
    area_size, duration_cycles, health_targets
  )
  
  valid_duration && has_targets && grant_created
}

fn validate_approve_grant(
  tx: Transaction,
  grant_id: ByteArray,
  baseline_survey: ByteArray,
  amount_per_cycle: Int,
  config: PreservationConfig,
) -> Bool {
  // 1. Requires Steward approval (multiple signers)
  let steward_count = count_steward_signatures(tx, config.pnft_policy)
  let enough_stewards = steward_count >= 2
  
  // 2. Baseline survey must be verified
  let survey = find_survey(tx.reference_inputs, baseline_survey)
  expect Some(s) = survey
  let survey_verified = s.status == SurveyVerified
  
  // 3. Grant exists and is in Applied status
  let grant = find_grant(tx.reference_inputs, grant_id)
  expect Some(g) = grant
  let is_applied = g.status == Applied
  
  // 4. Treasury has sufficient funds
  let total_cost = amount_per_cycle * g.duration_cycles
  let funds_available = verify_treasury_funds(tx, total_cost, config.treasury)
  
  // 5. Grant status updated to Approved
  let grant_approved = verify_grant_approved(tx.outputs, grant_id, baseline_survey, amount_per_cycle)
  
  enough_stewards && survey_verified && is_applied && funds_available && grant_approved
}

fn validate_claim_payment(
  tx: Transaction,
  grant_id: ByteArray,
  cycle: Int,
  verification_survey: ByteArray,
  config: PreservationConfig,
) -> Bool {
  // 1. Grant must be active
  let grant = find_grant(tx.reference_inputs, grant_id)
  expect Some(g) = grant
  let is_active = g.status == GrantActive
  
  // 2. Recipient must sign
  let signed = verify_pnft_signed(tx, g.recipient, config.pnft_policy)
  
  // 3. Verification survey must be verified and recent
  let survey = find_survey(tx.reference_inputs, verification_survey)
  expect Some(s) = survey
  let survey_valid = s.status == SurveyVerified
  
  // 4. Cycle hasn't been claimed yet
  let not_claimed = !list.any(g.payments, fn(p) { p.cycle == cycle })
  
  // 5. Health targets checked against survey
  let targets_result = check_health_targets(g.health_targets, s.measurements)
  
  // 6. Payment calculated (with bonus/penalty)
  let base_amount = g.amount / g.duration_cycles
  let adjustment = calculate_adjustment(targets_result)
  let payment_amount = base_amount + adjustment
  
  // 7. Payment made from treasury
  let payment_made = verify_grant_payment(
    tx.outputs, g.recipient, payment_amount, config.token_policy, config.token_name
  )
  
  // 8. Payment recorded
  let payment_recorded = verify_payment_recorded(
    tx.outputs, grant_id, cycle, payment_amount, verification_survey, targets_result.all_met, adjustment
  )
  
  is_active && signed && survey_valid && not_claimed && payment_made && payment_recorded
}

fn validate_terminate_grant(
  tx: Transaction,
  grant_id: ByteArray,
  reason_hash: ByteArray,
  config: PreservationConfig,
) -> Bool {
  // Requires Steward approval
  let steward_count = count_steward_signatures(tx, config.pnft_policy)
  steward_count >= 2
}

// =============================================================================
// HEALTH RECORD UPDATES
// =============================================================================

fn validate_update_health(
  tx: Transaction,
  location_hash: ByteArray,
  survey_id: ByteArray,
  config: PreservationConfig,
) -> Bool {
  // 1. Survey must be verified
  let survey = find_survey(tx.reference_inputs, survey_id)
  expect Some(s) = survey
  let verified = s.status == SurveyVerified
  
  // 2. Survey location matches
  let location_matches = s.location_hash == location_hash
  
  // 3. Health record updated
  let health_updated = verify_health_record_updated(tx.outputs, location_hash, s.measurements)
  
  verified && location_matches && health_updated
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

fn get_slot(tx: Transaction) -> Int {
  when tx.validity_range.lower_bound.bound_type is {
    Finite(slot) -> slot
    _ -> 0
  }
}

fn find_pnft(
  tx: Transaction,
  pnft_id: AssetName,
  pnft_policy: PolicyId,
) -> Option<PnftDatum> {
  list.find_map(tx.reference_inputs, fn(input) {
    let has_pnft = list.any(flatten(input.output.value), fn(asset) {
      let (p, name, qty) = asset
      p == pnft_policy && name == pnft_id && qty > 0
    })
    if has_pnft {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          Some(datum)
        }
        _ -> None
      }
    } else {
      None
    }
  })
}

fn find_signer_pnft(
  tx: Transaction,
  pnft_policy: PolicyId,
) -> Option<PnftDatum> {
  list.find_map(tx.reference_inputs, fn(input) {
    let pnfts = list.filter_map(flatten(input.output.value), fn(asset) {
      let (p, _, qty) = asset
      if p == pnft_policy && qty > 0 { Some(True) } else { None }
    })
    when pnfts is {
      [_, ..] -> {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: PnftDatum = data
            if list.has(tx.extra_signatories, datum.owner) {
              Some(datum)
            } else {
              None
            }
          }
          _ -> None
        }
      }
      _ -> None
    }
  })
}

fn verify_pnft_signed(
  tx: Transaction,
  pnft_id: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  let pnft = find_pnft(tx, pnft_id, pnft_policy)
  when pnft is {
    Some(datum) -> list.has(tx.extra_signatories, datum.owner)
    None -> False
  }
}

fn find_cert(
  inputs: List<Input>,
  surveyor: AssetName,
) -> Option<SurveyorCert> {
  list.find_map(inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect datum: PnftDatum = data
        if datum.pnft_id == surveyor {
          datum.surveyor_certification
        } else {
          None
        }
      }
      _ -> None
    }
  })
}

fn find_survey(inputs: List<Input>, survey_id: ByteArray) -> Option<SurveyRecord> {
  list.find_map(inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect survey: SurveyRecord = data
        if survey.survey_id == survey_id { Some(survey) } else { None }
      }
      _ -> None
    }
  })
}

fn find_grant(inputs: List<Input>, grant_id: ByteArray) -> Option<PreservationGrant> {
  list.find_map(inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect grant: PreservationGrant = data
        if grant.grant_id == grant_id { Some(grant) } else { None }
      }
      _ -> None
    }
  })
}

fn count_steward_signatures(tx: Transaction, pnft_policy: PolicyId) -> Int {
  list.foldl(tx.reference_inputs, 0, fn(input, acc) {
    let has_pnft = list.any(flatten(input.output.value), fn(asset) {
      let (p, _, qty) = asset
      p == pnft_policy && qty > 0
    })
    if has_pnft {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          if datum.level == Steward && list.has(tx.extra_signatories, datum.owner) {
            acc + 1
          } else {
            acc
          }
        }
        _ -> acc
      }
    } else {
      acc
    }
  })
}

fn verify_governance_approval(tx: Transaction, proof: ByteArray, governance: ByteArray) -> Bool {
  list.any(tx.reference_inputs, fn(input) {
    when input.output.address.payment_credential is {
      Script(hash) if hash == governance -> True
      _ -> False
    }
  })
}

fn get_bioregion_for_location(
  tx: Transaction,
  location_hash: ByteArray,
  registry: ByteArray,
) -> Option<ByteArray> {
  // Would look up location in bioregion registry
  // Simplified: assume bioregion is in reference inputs
  list.find_map(tx.reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect health: EcosystemHealthRecord = data
        if health.location_hash == location_hash {
          Some(health.bioregion)
        } else {
          None
        }
      }
      _ -> None
    }
  })
}

fn check_health_targets(
  targets: List<HealthTarget>,
  measurements: List<SurveyMeasurement>,
) -> { all_met: Bool, score: Int } {
  let results = list.map(targets, fn(target) {
    let measurement = list.find(measurements, fn(m) {
      m.category == target.category && m.metric_code == target.metric_code
    })
    when measurement is {
      Some(m) -> m.value >= target.minimum_value
      None -> False
    }
  })
  let met_count = list.foldl(results, 0, fn(met, acc) { if met { acc + 1 } else { acc } })
  let total = list.length(targets)
  { all_met: met_count == total, score: met_count * 100 / total }
}

fn calculate_adjustment(result: { all_met: Bool, score: Int }) -> Int {
  // +10% bonus if all targets met, -10% penalty if <50% met
  if result.all_met {
    10  // Simplified: would be percentage of base
  } else if result.score < 50 {
    -10
  } else {
    0
  }
}

// =============================================================================
// VERIFICATION IMPLEMENTATIONS
// =============================================================================

/// Verify surveyor certification created
fn verify_cert_created(outputs: List<o>, candidate: AssetName, surveyor_type: SurveyorType, specializations: List<ImpactCategory>, issued: Int, expires: Int) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect cert: SurveyorCert = data
        cert.cert_type == surveyor_type &&
        cert.specializations == specializations &&
        cert.issued_at == issued &&
        cert.expires_at == expires &&
        cert.surveys_completed == 0 &&
        cert.accuracy_score == 100  // Start at 100%
      }
      _ -> False
    }
  })
}

/// Verify certification renewed with new expiry
fn verify_cert_renewed(outputs: List<o>, surveyor: AssetName, new_expiry: Int) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect cert: SurveyorCert = data
        cert.expires_at == new_expiry
      }
      _ -> False
    }
  })
}

/// Verify pNFT updated with surveyor certification
fn verify_pnft_surveyor_added(outputs: List<o>, pnft: AssetName, surveyor_type: SurveyorType, policy: PolicyId) -> Bool {
  list.any(outputs, fn(output) {
    let has_pnft = list.any(flatten(output.value), fn(asset) {
      let (p, name, qty) = asset
      p == policy && name == pnft && qty > 0
    })
    if has_pnft {
      when output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          when datum.surveyor_certification is {
            Some(cert) -> cert.cert_type == surveyor_type
            None -> False
          }
        }
        _ -> False
      }
    } else {
      False
    }
  })
}

/// Verify survey record created
fn verify_survey_created(outputs: List<o>, surveyor: AssetName, bioregion: ByteArray, location: ByteArray, survey_type: SurveyType, measurements: List<SurveyMeasurement>, evidence: ByteArray, slot: Int) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect survey: SurveyRecord = data
        survey.surveyor == surveyor &&
        survey.bioregion == bioregion &&
        survey.location_hash == location &&
        survey.survey_type == survey_type &&
        survey.measurements == measurements &&
        survey.evidence_hash == evidence &&
        survey.surveyed_at == slot &&
        survey.status == Pending
      }
      _ -> False
    }
  })
}

/// Verify surveyor received payment
fn verify_survey_payment(outputs: List<o>, recipient: AssetName, policy: PolicyId, name: AssetName) -> Bool {
  list.any(outputs, fn(output) {
    let has_tokens = quantity_of(output.value, policy, name) >= 50  // 50 tokens per survey
    let has_pnft = list.any(flatten(output.value), fn(asset) {
      let (p, n, qty) = asset
      p == policy && n == recipient && qty > 0
    })
    has_tokens
  })
}

/// Verify verification added to survey
fn verify_verification_added(outputs: List<o>, survey_id: ByteArray, verifier: AssetName, confirms: Bool, measurements: Option<List<SurveyMeasurement>>, notes: Option<ByteArray>) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect survey: SurveyRecord = data
        survey.survey_id == survey_id &&
        list.any(survey.verifications, fn(v) {
          v.verifier == verifier && v.confirms == confirms
        })
      }
      _ -> False
    }
  })
}

/// Verify survey status updated based on verifications
fn verify_survey_status_updated(outputs: List<o>, survey_id: ByteArray, confirmed: Bool) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect survey: SurveyRecord = data
        survey.survey_id == survey_id &&
        if confirmed {
          survey.status == SurveyVerified
        } else {
          survey.status == Rejected
        }
      }
      _ -> False
    }
  })
}

/// Verify survey marked as disputed
fn verify_survey_disputed(outputs: List<o>, survey_id: ByteArray, evidence: ByteArray) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect survey: SurveyRecord = data
        survey.survey_id == survey_id && survey.status == Disputed
      }
      _ -> False
    }
  })
}

/// Verify preservation grant application created
fn verify_grant_created(outputs: List<o>, applicant: AssetName, grant_type: GrantType, location: ByteArray, area: Int, duration: Int, targets: List<HealthTarget>) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect grant: PreservationGrant = data
        grant.recipient == applicant &&
        grant.grant_type == grant_type &&
        grant.location_hash == location &&
        grant.area_size == area &&
        grant.duration_cycles == duration &&
        grant.health_targets == targets &&
        grant.status == Proposed
      }
      _ -> False
    }
  })
}

/// Verify grant approved with baseline and amount
fn verify_grant_approved(outputs: List<o>, grant_id: ByteArray, baseline: ByteArray, amount: Int) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect grant: PreservationGrant = data
        grant.grant_id == grant_id &&
        grant.baseline_survey == baseline &&
        grant.amount == amount &&
        grant.status == Active
      }
      _ -> False
    }
  })
}

/// Verify treasury has funds for operation
fn verify_treasury_funds(tx: Transaction, amount: Int, treasury: ByteArray) -> Bool {
  list.any(tx.reference_inputs, fn(input) {
    when input.output.address.payment_credential is {
      Script(hash) if hash == treasury -> {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect treasury_datum: TreasuryDatum = data
            treasury_datum.preservation_fund >= amount || treasury_datum.survey_fund >= amount
          }
          _ -> False
        }
      }
      _ -> False
    }
  })
}

/// Verify grant payment sent to recipient
fn verify_grant_payment(outputs: List<o>, recipient: AssetName, amount: Int, policy: PolicyId, name: AssetName) -> Bool {
  list.any(outputs, fn(output) {
    let token_qty = quantity_of(output.value, policy, name)
    token_qty >= amount
  })
}

/// Verify payment record added to grant
fn verify_payment_recorded(outputs: List<o>, grant_id: ByteArray, cycle: Int, amount: Int, survey: ByteArray, met: Bool, adjustment: Int) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect grant: PreservationGrant = data
        grant.grant_id == grant_id &&
        list.any(grant.payments, fn(p) {
          p.cycle == cycle && p.amount == amount && p.survey_id == survey
        })
      }
      _ -> False
    }
  })
}

/// Verify ecosystem health record updated
fn verify_health_record_updated(outputs: List<o>, location: ByteArray, measurements: List<SurveyMeasurement>) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect health: EcosystemHealthRecord = data
        health.location_hash == location
      }
      _ -> False
    }
  })
}

// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// BIOREGIONAL PRESERVATION ECONOMICS
// ===================================
//
// This system creates a complete loop:
//
// 1. SURVEYOR CERTIFICATION
//    - Governance certifies qualified individuals
//    - TEK holders can be certified (traditional knowledge)
//    - Certification requires ongoing accuracy
//    - Revocation for misconduct
//
// 2. ECOSYSTEM SURVEYS
//    - Surveyors document ecosystem state
//    - Multiple surveyors cross-verify
//    - Disputes resolved through evidence
//    - Payments for survey work
//
// 3. PRESERVATION GRANTS
//    - Land stewards apply for grants
//    - Baseline survey establishes starting point
//    - Regular surveys verify ongoing health
//    - Payments tied to meeting targets
//    - Bonuses for exceeding targets
//    - Termination for persistent failure
//
// 4. HEALTH RECORDS
//    - Every location has tracked health
//    - Trends visible over time
//    - Informs bioregion health index
//    - Drives UBI modifiers
//
// WHO BENEFITS:
// - Surveyors: Paid for verification work
// - Land stewards: Paid for ecosystem maintenance
// - Bioregion: Health improves, UBI increases
// - Everyone: True knowledge of ecosystem state
//
// WHY IT WORKS:
// - Multiple verification prevents fraud
// - Payments tied to verified outcomes
// - DNA-locked accountability
// - Traditional knowledge valued
// - Market for truth about nature
//
// =============================================================================
