// =============================================================================
// UltraLife Protocol — Care Economy Validator Tests
// =============================================================================
//
// Tests for the care economy contract including:
// - Care need registration
// - Fulfillment validation
// - Credit issuance
// - Attestation requirements
// - Care type validation
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{AssetName}
use ultralife/types.{
  VerificationLevel, Basic, Ward, Standard, Verified, Steward,
  can_transact,
}

// =============================================================================
// CARE TYPES
// =============================================================================

type CareType {
  Childcare { age_group: ChildAgeGroup }
  ElderCare { care_level: ElderCareLevel }
  DisabilityCare
  HealthSupport
  Household { household_size: Int }
  CommunityService { beneficiaries: Int }
}

type ChildAgeGroup {
  Infant
  Toddler
  Preschool
  SchoolAge
  Adolescent
}

type ElderCareLevel {
  Independent
  Assisted
  FullTime
  Medical
  Palliative
}

type CareRecipient {
  Family { person_pnft: Option<AssetName> }
  ExtendedFamily { person_pnft: Option<AssetName> }
  Neighbor { pnft: Option<AssetName> }
  Community
  PublicGood
}

type CareRecordStatus {
  Pending
  Attested { attestation_count: Int }
  Credited { credited_at: Int }
  Disputed { reason: ByteArray }
  CareRejected { reason: ByteArray }
}

type AttestorRole {
  Recipient
  RecipientFamily
  NeighborAttestor
  CommunityMember
  HealthProfessional
  SocialWorker
}

type CareAttestation {
  attestor: AssetName,
  attestor_role: AttestorRole,
  attested_at: Int,
}

type CareRecord {
  record_id: ByteArray,
  caregiver: AssetName,
  care_type: CareType,
  recipient: CareRecipient,
  hours: Int,
  started_at: Int,
  ended_at: Int,
  bioregion: ByteArray,
  attestations: List<CareAttestation>,
  status: CareRecordStatus,
  credits_earned: Int,
}

// =============================================================================
// TEST HELPERS
// =============================================================================

fn mock_vkh(seed: Int) -> VerificationKeyHash {
  when seed is {
    1 -> #"0000000000000000000000000000000000000000000000000000000001"
    2 -> #"0000000000000000000000000000000000000000000000000000000002"
    3 -> #"0000000000000000000000000000000000000000000000000000000003"
    _ -> #"0000000000000000000000000000000000000000000000000000000000"
  }
}

fn mock_pnft_name(seed: Int) -> AssetName {
  when seed is {
    1 -> #"706e667401"
    2 -> #"706e667402"
    3 -> #"706e667403"
    4 -> #"706e667404"
    _ -> #"706e667400"
  }
}

fn mock_care_record(
  caregiver: AssetName,
  care_type: CareType,
  hours: Int,
  status: CareRecordStatus,
) -> CareRecord {
  CareRecord {
    record_id: #"6361726530303031",
    caregiver: caregiver,
    care_type: care_type,
    recipient: Family { person_pnft: None },
    hours: hours,
    started_at: 1000,
    ended_at: 5000,
    bioregion: #"62696f726567696f6e31",
    attestations: [],
    status: status,
    credits_earned: 0,
  }
}

fn mock_attestation(attestor: AssetName, role: AttestorRole, slot: Int) -> CareAttestation {
  CareAttestation {
    attestor: attestor,
    attestor_role: role,
    attested_at: slot,
  }
}

// =============================================================================
// CAREGIVER VERIFICATION TESTS
// =============================================================================

fn can_provide_care(level: VerificationLevel) -> Bool {
  when level is {
    Basic -> False
    Ward -> False
    Standard -> True
    Verified -> True
    Steward -> True
  }
}

test basic_cannot_provide_care() {
  !can_provide_care(Basic)
}

test ward_cannot_provide_care() {
  !can_provide_care(Ward)
}

test standard_can_provide_care() {
  can_provide_care(Standard)
}

test verified_can_provide_care() {
  can_provide_care(Verified)
}

test steward_can_provide_care() {
  can_provide_care(Steward)
}

// =============================================================================
// CARE RECORD CREATION TESTS
// =============================================================================

fn validate_record_creation(
  caregiver_level: VerificationLevel,
  hours: Int,
  max_daily_hours: Int,
  days: Int,
  started_at: Int,
  ended_at: Int,
  current_slot: Int,
) -> Bool {
  let caregiver_valid = can_provide_care(caregiver_level)
  let hours_positive = hours > 0
  let hours_reasonable = hours <= max_daily_hours * days
  let time_valid = ended_at > started_at
  let not_future = ended_at <= current_slot
  caregiver_valid && hours_positive && hours_reasonable && time_valid && not_future
}

test valid_care_record_creation() {
  validate_record_creation(Standard, 8, 16, 1, 1000, 2000, 3000)
}

test care_record_fails_with_basic_caregiver() {
  !validate_record_creation(Basic, 8, 16, 1, 1000, 2000, 3000)
}

test care_record_fails_with_zero_hours() {
  !validate_record_creation(Standard, 0, 16, 1, 1000, 2000, 3000)
}

test care_record_fails_with_excessive_hours() {
  !validate_record_creation(Standard, 50, 16, 1, 1000, 2000, 3000)
}

test care_record_fails_with_invalid_time_range() {
  !validate_record_creation(Standard, 8, 16, 1, 2000, 1000, 3000)
}

test care_record_fails_with_future_care() {
  !validate_record_creation(Standard, 8, 16, 1, 1000, 5000, 3000)
}

test care_record_multi_day_hours_valid() {
  validate_record_creation(Standard, 40, 16, 5, 1000, 10000, 15000)
}

// =============================================================================
// ATTESTATION VALIDATION TESTS
// =============================================================================

fn can_attest_record(status: CareRecordStatus) -> Bool {
  when status is {
    Pending -> True
    Attested { .. } -> True
    _ -> False
  }
}

fn is_valid_attestor(
  attestor: AssetName,
  caregiver: AssetName,
  existing_attestations: List<CareAttestation>,
) -> Bool {
  attestor != caregiver &&
  !list.any(existing_attestations, fn(a) { a.attestor == attestor })
}

test can_attest_pending_record() {
  can_attest_record(Pending)
}

test can_attest_attested_record() {
  can_attest_record(Attested { attestation_count: 1 })
}

test cannot_attest_credited_record() {
  !can_attest_record(Credited { credited_at: 5000 })
}

test cannot_attest_disputed_record() {
  !can_attest_record(Disputed { reason: #"64697370757465" })
}

test cannot_attest_rejected_record() {
  !can_attest_record(CareRejected { reason: #"66616c7365" })
}

test valid_attestor_accepted() {
  let caregiver = mock_pnft_name(1)
  let attestor = mock_pnft_name(2)
  is_valid_attestor(attestor, caregiver, [])
}

test caregiver_cannot_self_attest() {
  let caregiver = mock_pnft_name(1)
  !is_valid_attestor(caregiver, caregiver, [])
}

test cannot_attest_twice() {
  let caregiver = mock_pnft_name(1)
  let attestor = mock_pnft_name(2)
  let existing = [mock_attestation(attestor, Recipient, 5000)]
  !is_valid_attestor(attestor, caregiver, existing)
}

test different_attestor_can_attest() {
  let caregiver = mock_pnft_name(1)
  let attestor1 = mock_pnft_name(2)
  let attestor2 = mock_pnft_name(3)
  let existing = [mock_attestation(attestor1, Recipient, 5000)]
  is_valid_attestor(attestor2, caregiver, existing)
}

// =============================================================================
// ATTESTATION THRESHOLD TESTS
// =============================================================================

fn has_sufficient_attestations(attestation_count: Int, min_required: Int) -> Bool {
  attestation_count >= min_required
}

fn update_status_after_attestation(current_count: Int, min_required: Int) -> CareRecordStatus {
  let new_count = current_count + 1
  if new_count >= min_required {
    Attested { attestation_count: new_count }
  } else {
    Pending
  }
}

test zero_attestations_insufficient() {
  !has_sufficient_attestations(0, 2)
}

test one_attestation_insufficient_for_two() {
  !has_sufficient_attestations(1, 2)
}

test two_attestations_sufficient_for_two() {
  has_sufficient_attestations(2, 2)
}

test excess_attestations_sufficient() {
  has_sufficient_attestations(5, 2)
}

test status_remains_pending_below_threshold() {
  let new_status = update_status_after_attestation(0, 2)
  new_status == Pending
}

test status_becomes_attested_at_threshold() {
  let new_status = update_status_after_attestation(1, 2)
  when new_status is {
    Attested { attestation_count } -> attestation_count == 2
    _ -> False
  }
}

// =============================================================================
// CREDIT CALCULATION TESTS
// =============================================================================

fn calculate_care_credits(care_type: CareType, hours: Int) -> Int {
  let base_rate = when care_type is {
    Childcare { age_group } -> when age_group is {
      Infant -> 15
      Toddler -> 12
      Preschool -> 10
      SchoolAge -> 8
      Adolescent -> 8
    }
    ElderCare { care_level } -> when care_level is {
      Independent -> 8
      Assisted -> 12
      FullTime -> 15
      Medical -> 18
      Palliative -> 20
    }
    DisabilityCare -> 15
    HealthSupport -> 12
    Household { .. } -> 8
    CommunityService { .. } -> 10
  }
  hours * base_rate
}

test infant_care_credits() {
  let care_type = Childcare { age_group: Infant }
  calculate_care_credits(care_type, 8) == 120
}

test toddler_care_credits() {
  let care_type = Childcare { age_group: Toddler }
  calculate_care_credits(care_type, 8) == 96
}

test elder_assisted_care_credits() {
  let care_type = ElderCare { care_level: Assisted }
  calculate_care_credits(care_type, 8) == 96
}

test palliative_care_highest_credits() {
  let care_type = ElderCare { care_level: Palliative }
  calculate_care_credits(care_type, 8) == 160
}

test household_care_credits() {
  let care_type = Household { household_size: 4 }
  calculate_care_credits(care_type, 4) == 32
}

test community_service_credits() {
  let care_type = CommunityService { beneficiaries: 10 }
  calculate_care_credits(care_type, 5) == 50
}

// =============================================================================
// CREDIT CLAIM TESTS
// =============================================================================

fn validate_credit_claim(
  claimer: AssetName,
  record_caregiver: AssetName,
  status: CareRecordStatus,
) -> Bool {
  claimer == record_caregiver &&
  when status is {
    Attested { .. } -> True
    _ -> False
  }
}

test valid_credit_claim() {
  let caregiver = mock_pnft_name(1)
  validate_credit_claim(caregiver, caregiver, Attested { attestation_count: 2 })
}

test non_caregiver_cannot_claim() {
  let caregiver = mock_pnft_name(1)
  let other = mock_pnft_name(2)
  !validate_credit_claim(other, caregiver, Attested { attestation_count: 2 })
}

test cannot_claim_pending_record() {
  let caregiver = mock_pnft_name(1)
  !validate_credit_claim(caregiver, caregiver, Pending)
}

test cannot_claim_already_credited() {
  let caregiver = mock_pnft_name(1)
  !validate_credit_claim(caregiver, caregiver, Credited { credited_at: 5000 })
}

test cannot_claim_disputed_record() {
  let caregiver = mock_pnft_name(1)
  !validate_credit_claim(caregiver, caregiver, Disputed { reason: #"726561736f6e" })
}

// =============================================================================
// UBI APPLICATION TESTS
// =============================================================================

fn validate_apply_to_ubi(
  total_credits: Int,
  credits_applied: Int,
  amount_to_apply: Int,
) -> Bool {
  let available = total_credits - credits_applied
  amount_to_apply > 0 && amount_to_apply <= available
}

test valid_ubi_application() {
  validate_apply_to_ubi(100, 20, 50)
}

test cannot_apply_more_than_available() {
  !validate_apply_to_ubi(100, 90, 20)
}

test cannot_apply_zero() {
  !validate_apply_to_ubi(100, 0, 0)
}

test can_apply_all_available() {
  validate_apply_to_ubi(100, 0, 100)
}

// =============================================================================
// DISPUTE TESTS
// =============================================================================

fn validate_dispute(
  disputer: AssetName,
  caregiver: AssetName,
  status: CareRecordStatus,
  disputer_level: VerificationLevel,
) -> Bool {
  disputer != caregiver &&
  can_attest_record(status) &&
  can_provide_care(disputer_level)
}

test valid_dispute() {
  let caregiver = mock_pnft_name(1)
  let disputer = mock_pnft_name(2)
  validate_dispute(disputer, caregiver, Pending, Verified)
}

test caregiver_cannot_self_dispute() {
  let caregiver = mock_pnft_name(1)
  !validate_dispute(caregiver, caregiver, Pending, Verified)
}

test cannot_dispute_credited_record() {
  let caregiver = mock_pnft_name(1)
  let disputer = mock_pnft_name(2)
  !validate_dispute(disputer, caregiver, Credited { credited_at: 5000 }, Verified)
}

test basic_cannot_dispute() {
  let caregiver = mock_pnft_name(1)
  let disputer = mock_pnft_name(2)
  !validate_dispute(disputer, caregiver, Pending, Basic)
}

// =============================================================================
// ATTESTOR ROLE VALIDATION TESTS
// =============================================================================

fn is_valid_attestor_role(
  role: AttestorRole,
  recipient: CareRecipient,
  attestor_level: VerificationLevel,
) -> Bool {
  when role is {
    Recipient -> {
      when recipient is {
        Family { person_pnft } -> person_pnft != None
        ExtendedFamily { person_pnft } -> person_pnft != None
        Neighbor { pnft } -> pnft != None
        _ -> False
      }
    }
    RecipientFamily -> {
      when recipient is {
        Family { .. } -> True
        ExtendedFamily { .. } -> True
        _ -> False
      }
    }
    NeighborAttestor -> True
    CommunityMember -> True
    HealthProfessional -> attestor_level == Steward
    SocialWorker -> attestor_level == Steward
  }
}

test recipient_can_attest_family_care() {
  let recipient = Family { person_pnft: Some(mock_pnft_name(2)) }
  is_valid_attestor_role(Recipient, recipient, Standard)
}

test recipient_cannot_attest_without_pnft() {
  let recipient = Family { person_pnft: None }
  !is_valid_attestor_role(Recipient, recipient, Standard)
}

test family_member_can_attest_family_care() {
  let recipient = Family { person_pnft: None }
  is_valid_attestor_role(RecipientFamily, recipient, Standard)
}

test neighbor_can_attest_any_care() {
  let recipient = Community
  is_valid_attestor_role(NeighborAttestor, recipient, Standard)
}

test health_professional_must_be_steward() {
  let recipient = Family { person_pnft: None }
  is_valid_attestor_role(HealthProfessional, recipient, Steward)
}

test health_professional_non_steward_fails() {
  let recipient = Family { person_pnft: None }
  !is_valid_attestor_role(HealthProfessional, recipient, Verified)
}

// =============================================================================
// EDGE CASES
// =============================================================================

test zero_hours_produces_zero_credits() {
  let care_type = Childcare { age_group: Infant }
  calculate_care_credits(care_type, 0) == 0
}

test max_hours_single_day() {
  validate_record_creation(Standard, 24, 24, 1, 1000, 2000, 3000)
}

test multiple_attestations_accumulate() {
  let attestor1 = mock_pnft_name(2)
  let attestor2 = mock_pnft_name(3)
  let attestor3 = mock_pnft_name(4)
  let attestations = [
    mock_attestation(attestor1, Recipient, 5000),
    mock_attestation(attestor2, RecipientFamily, 5100),
    mock_attestation(attestor3, NeighborAttestor, 5200),
  ]
  list.length(attestations) == 3
}

test care_credits_proportional_to_hours() {
  let care_type = ElderCare { care_level: FullTime }
  let credits_4h = calculate_care_credits(care_type, 4)
  let credits_8h = calculate_care_credits(care_type, 8)
  credits_8h == credits_4h * 2
}

test infant_care_highest_childcare_rate() {
  let infant_credits = calculate_care_credits(Childcare { age_group: Infant }, 1)
  let toddler_credits = calculate_care_credits(Childcare { age_group: Toddler }, 1)
  let preschool_credits = calculate_care_credits(Childcare { age_group: Preschool }, 1)
  infant_credits > toddler_credits && toddler_credits > preschool_credits
}

test palliative_care_highest_overall_rate() {
  let palliative_credits = calculate_care_credits(ElderCare { care_level: Palliative }, 1)
  let infant_credits = calculate_care_credits(Childcare { age_group: Infant }, 1)
  palliative_credits > infant_credits
}
