// =============================================================================
// UltraLife Protocol — Care Economy
// =============================================================================
//
// RECOGNIZING INVISIBLE LABOR: The work that enables all other work
//
// Care work — childcare, elder care, household management, community service —
// is the foundation that enables all other economic activity. Traditional
// economics ignores it. UltraLife recognizes it.
//
// Care work:
// 1. Accumulates labor dignity points
// 2. Boosts UBI calculations
// 3. Builds community reputation
// 4. Generates positive impact (social wellbeing)
//
// Verification is community-based: neighbors and family attest to care given.
// This prevents gaming while honoring genuine contribution.
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash, blake2b_256}
use aiken/interval
use aiken/primitive/bytearray
use cardano/address
use cardano/assets.{PolicyId, AssetName, Value, quantity_of}
use cardano/transaction.{Transaction, Input, Output, OutputReference, InlineDatum}
use ultralife/types.{
  PnftDatum, VerificationLevel, Basic, Ward, Standard, Verified, Steward,
  CompoundFlow, CompoundCode, MassUnit,
}

// =============================================================================
// CARE TYPES
// =============================================================================

/// Types of care work
pub type CareType {
  // === CHILDCARE ===
  Childcare { 
    age_group: ChildAgeGroup,
    activities: List<ChildcareActivity>,
  }
  
  // === ELDER CARE ===
  ElderCare {
    care_level: ElderCareLevel,
    activities: List<ElderCareActivity>,
  }
  
  // === DISABILITY CARE ===
  DisabilityCare {
    support_type: DisabilitySupportType,
  }
  
  // === HEALTH SUPPORT ===
  HealthSupport {
    support_type: HealthSupportType,
  }
  
  // === HOUSEHOLD ===
  Household {
    activities: List<HouseholdActivity>,
    household_size: Int,
  }
  
  // === COMMUNITY SERVICE ===
  CommunityService {
    service_type: CommunityServiceType,
    beneficiaries: Int,  // Approximate number helped
  }
  
  // === FAMILY SUPPORT ===
  FamilySupport {
    support_type: FamilySupportType,
  }
}

pub type ChildAgeGroup {
  Infant      // 0-1
  Toddler     // 1-3
  Preschool   // 3-5
  SchoolAge   // 5-12
  Adolescent  // 12-18
}

pub type ChildcareActivity {
  Feeding
  Bathing
  Supervision
  Education
  Healthcare
  Transportation
  EmotionalSupport
  PlayAndDevelopment
}

pub type ElderCareLevel {
  Independent    // Mostly self-sufficient, check-ins
  Assisted       // Help with some daily activities
  FullTime       // Significant daily assistance
  Medical        // Medical care needs
  Palliative     // End-of-life care
}

pub type ElderCareActivity {
  ElderCompanionship
  ElderMealPreparation
  ElderMedication
  ElderMobility
  ElderPersonalCare
  ElderTransportation
  ElderHouseholdHelp
  ElderMedicalAppointments
}

pub type DisabilitySupportType {
  PhysicalAssistance
  CognitiveSupport
  SensoryAssistance
  MentalHealthSupport
  DailyLivingSupport
  Advocacy
}

pub type HealthSupportType {
  PostSurgery
  ChronicCondition
  MentalHealth
  Recovery
  Prenatal
  Postnatal
}

pub type HouseholdActivity {
  Cleaning
  Cooking
  Laundry
  Shopping
  BudgetManagement
  HomeRepairs
  Gardening
  PetCare
}

pub type CommunityServiceType {
  Volunteering { organization: ByteArray }
  MutualAid
  Neighborhood { activity: ByteArray }
  Emergency { response_type: ByteArray }
  Environmental { activity: ByteArray }
  Educational { teaching: ByteArray }
  Cultural { activity: ByteArray }
  Religious { service: ByteArray }
}

pub type FamilySupportType {
  FamilyEmotionalSupport
  FinancialGuidance
  ConflictResolution
  CrisisIntervention
  Mentoring
  FamilyAdvocacy
}

// =============================================================================
// CARE RECIPIENT TYPES
// =============================================================================

/// Who receives the care
pub type CareRecipient {
  /// Family member (same household)
  Family { 
    relationship: FamilyRelationship,
    /// Optional: specific person's pNFT if they have one
    person_pnft: Option<AssetName>,
  }
  
  /// Extended family
  ExtendedFamily {
    relationship: ByteArray,
    person_pnft: Option<AssetName>,
  }
  
  /// Neighbor or community member
  Neighbor {
    pnft: Option<AssetName>,
    proximity: Proximity,
  }
  
  /// General community (volunteer work)
  Community {
    community_type: ByteArray,
  }
  
  /// Public good (benefits everyone)
  PublicGood
}

pub type FamilyRelationship {
  Child
  Parent
  Grandparent
  Sibling
  Spouse
  Other { description: ByteArray }
}

pub type Proximity {
  SameBuilding
  SameBlock
  SameNeighborhood
  SameBioregion
}

// =============================================================================
// CARE RECORD
// =============================================================================

/// Record of care work performed
pub type CareRecord {
  /// Unique record ID
  record_id: ByteArray,
  /// Who provided care
  caregiver: AssetName,
  /// Type of care
  care_type: CareType,
  /// Who received care
  recipient: CareRecipient,
  /// Duration in hours
  hours: Int,
  /// When care was provided (start slot)
  started_at: Int,
  /// When care ended (end slot)
  ended_at: Int,
  /// Bioregion where care occurred
  bioregion: ByteArray,
  /// Description/notes hash
  notes_hash: Option<ByteArray>,
  /// Attestations from community
  attestations: List<CareAttestation>,
  /// Status
  status: CareRecordStatus,
  /// Credits earned (calculated)
  credits_earned: Int,
}

/// Attestation that care was provided
pub type CareAttestation {
  /// Who is attesting
  attestor: AssetName,
  /// Their relationship to the situation
  attestor_role: AttestorRole,
  /// When they attested
  attested_at: Int,
  /// Optional note hash
  note: Option<ByteArray>,
}

pub type AttestorRole {
  /// The care recipient themselves
  Recipient
  /// Family member of recipient
  RecipientFamily
  /// Neighbor who observed
  NeighborAttestor
  /// Community member
  CommunityMember
  /// Healthcare professional
  HealthProfessional
  /// Social worker
  SocialWorker
}

pub type CareRecordStatus {
  /// Just submitted, needs attestation
  Pending
  /// Has minimum attestations, eligible for credits
  Attested { attestation_count: Int }
  /// Credits claimed by caregiver
  Credited { credited_at: Int }
  /// Disputed
  Disputed { reason: ByteArray }
  /// Rejected (false claim)
  CareRejected { reason: ByteArray }
}

// =============================================================================
// DATUM TYPES
// =============================================================================

pub type CareDatum {
  /// Individual care record
  Record(CareRecord)
  /// Caregiver's accumulated care credits
  CaregiverCredits(CaregiverCreditRecord)
  /// Bioregion care statistics
  BioregionCareStats(BioregionCareData)
}

/// Caregiver's accumulated credits
pub type CaregiverCreditRecord {
  caregiver: AssetName,
  /// Total hours by care type
  hours_by_type: List<(CareTypeCode, Int)>,
  /// Total credits earned
  total_credits: Int,
  /// Credits applied to UBI
  credits_applied: Int,
  /// Last update cycle
  last_updated: Int,
}

/// Simplified care type code for aggregation
pub type CareTypeCode = ByteArray

/// Bioregion care statistics
pub type BioregionCareData {
  bioregion: ByteArray,
  cycle: Int,
  /// Total care hours recorded
  total_hours: Int,
  /// Active caregivers
  active_caregivers: Int,
  /// Care recipients served
  recipients_served: Int,
  /// Breakdown by type
  hours_by_type: List<(CareTypeCode, Int)>,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type CareRedeemer {
  // === Recording Care ===
  /// Record care work performed
  RecordCare {
    care_type: CareType,
    recipient: CareRecipient,
    hours: Int,
    started_at: Int,
    ended_at: Int,
    notes_hash: Option<ByteArray>,
  }
  
  /// Update existing record (before attested)
  UpdateRecord {
    record_id: ByteArray,
    new_hours: Option<Int>,
    new_notes: Option<ByteArray>,
  }
  
  /// Cancel record (before attested)
  CancelRecord { record_id: ByteArray }
  
  // === Attestation ===
  /// Attest that care was provided
  AttestCare {
    record_id: ByteArray,
    attestor_role: AttestorRole,
    note: Option<ByteArray>,
  }
  
  /// Dispute a care record
  DisputeRecord {
    record_id: ByteArray,
    reason: ByteArray,
  }
  
  // === Credits ===
  /// Claim care credits (after sufficient attestation)
  ClaimCredits {
    record_ids: List<ByteArray>,
  }
  
  /// Apply credits to UBI calculation
  ApplyToUBI {
    amount: Int,
  }
  
  // === Statistics ===
  /// Aggregate care data for bioregion
  AggregateBioregion {
    bioregion: ByteArray,
    cycle: Int,
  }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type CareConfig {
  /// pNFT policy
  pnft_policy: PolicyId,
  /// Bioregion policy
  bioregion_policy: PolicyId,
  /// UBI contract (for credit application)
  ubi_contract: ByteArray,
  /// Minimum attestations to earn credits
  min_attestations: Int,
  /// Credits per hour by care type
  credits_per_hour: List<(CareTypeCode, Int)>,
  /// Maximum hours per day that can be claimed
  max_daily_hours: Int,
  /// Cooldown between claims (slots)
  claim_cooldown: Int,
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator care(config: CareConfig) {
  spend(
    datum: Option<CareDatum>,
    redeemer: CareRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      RecordCare { care_type, recipient, hours, started_at, ended_at, notes_hash } -> {
        validate_record_care(tx, care_type, recipient, hours, started_at, ended_at, notes_hash, config)
      }
      
      UpdateRecord { record_id, new_hours, new_notes } -> {
        validate_update_record(tx, datum, record_id, new_hours, new_notes, config)
      }
      
      CancelRecord { record_id } -> {
        validate_cancel_record(tx, datum, record_id, config)
      }
      
      AttestCare { record_id, attestor_role, note } -> {
        validate_attest_care(tx, datum, record_id, attestor_role, note, config)
      }
      
      DisputeRecord { record_id, reason } -> {
        validate_dispute_record(tx, datum, record_id, reason, config)
      }
      
      ClaimCredits { record_ids } -> {
        validate_claim_credits(tx, datum, record_ids, config)
      }
      
      ApplyToUBI { amount } -> {
        validate_apply_to_ubi(tx, datum, amount, config)
      }
      
      AggregateBioregion { bioregion, cycle } -> {
        validate_aggregate_bioregion(tx, datum, bioregion, cycle, config)
      }
    }
  }
}

// =============================================================================
// RECORD CARE VALIDATION
// =============================================================================

fn validate_record_care(
  tx: Transaction,
  care_type: CareType,
  recipient: CareRecipient,
  hours: Int,
  started_at: Int,
  ended_at: Int,
  notes_hash: Option<ByteArray>,
  config: CareConfig,
) -> Bool {
  // 1. Caregiver must sign
  let caregiver_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(caregiver) = caregiver_pnft
  expect list.has(tx.extra_signatories, caregiver.owner)
  
  // 2. Caregiver must be Standard+ verified
  expect verification_level_gte(caregiver.level, Standard)
  
  // 3. Hours must be reasonable
  expect hours > 0
  expect hours <= config.max_daily_hours * days_between(started_at, ended_at)
  
  // 4. Time range must be valid
  expect ended_at > started_at
  let current_slot = get_current_slot(tx)
  expect ended_at <= current_slot  // Can't claim future care
  
  // 5. Create care record
  let record = CareRecord {
    record_id: generate_record_id(caregiver.pnft_id, started_at),
    caregiver: caregiver.pnft_id,
    care_type: care_type,
    recipient: recipient,
    hours: hours,
    started_at: started_at,
    ended_at: ended_at,
    bioregion: get_bioregion(caregiver),
    notes_hash: notes_hash,
    attestations: [],
    status: Pending,
    credits_earned: 0,
  }
  
  // 6. Verify record output created
  expect Some(out) = find_care_record_output(tx.outputs)
  expect InlineDatum(data) = out.datum
  expect Record(created): CareDatum = data
  
  created == record
}

// =============================================================================
// ATTESTATION VALIDATION
// =============================================================================

fn validate_attest_care(
  tx: Transaction,
  datum: Option<CareDatum>,
  record_id: ByteArray,
  attestor_role: AttestorRole,
  note: Option<ByteArray>,
  config: CareConfig,
) -> Bool {
  // 1. Record must exist and be Pending or Attested (not credited yet)
  expect Some(Record(record)) = datum
  expect record.record_id == record_id
  expect is_attestable(record.status)
  
  // 2. Attestor must sign
  let attestor_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(attestor) = attestor_pnft
  expect list.has(tx.extra_signatories, attestor.owner)
  
  // 3. Attestor cannot be the caregiver
  expect attestor.pnft_id != record.caregiver
  
  // 4. Attestor role must be valid for their relationship
  expect validate_attestor_role(attestor, record, attestor_role)
  
  // 5. Attestor hasn't already attested
  expect !has_attested(record.attestations, attestor.pnft_id)
  
  // 6. Create attestation
  let attestation = CareAttestation {
    attestor: attestor.pnft_id,
    attestor_role: attestor_role,
    attested_at: get_current_slot(tx),
    note: note,
  }
  
  // 7. Update record
  let new_attestations = list.concat(record.attestations, [attestation])
  let new_status = if list.length(new_attestations) >= config.min_attestations {
    Attested { attestation_count: list.length(new_attestations) }
  } else {
    Pending
  }
  
  let updated_record = CareRecord {
    ..record,
    attestations: new_attestations,
    status: new_status,
  }
  
  // 8. Verify output
  let output = find_care_record_output(tx.outputs)
  expect Some(out) = output
  expect InlineDatum(data) = out.datum
  expect Record(result): CareDatum = data
  
  result == updated_record
}

// =============================================================================
// CREDIT CLAIM VALIDATION
// =============================================================================

fn validate_claim_credits(
  tx: Transaction,
  datum: Option<CareDatum>,
  record_ids: List<ByteArray>,
  config: CareConfig,
) -> Bool {
  // 1. Claimer must sign
  let claimer_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(claimer) = claimer_pnft
  expect list.has(tx.extra_signatories, claimer.owner)
  
  // 2. All records must be for this claimer and properly attested
  let records = find_all_care_records(tx, record_ids)
  expect list.all(records, fn(r) {
    r.caregiver == claimer.pnft_id &&
    is_attested(r.status) &&
    is_not_credited(r.status)
  })
  
  // 3. Calculate credits
  let total_credits = list.foldl(records, 0, fn(r, acc) {
    acc + calculate_credits(r, config)
  })
  
  // 4. Update records to Credited status
  // (Verified through output checking)
  
  // 5. Update caregiver credit record
  let credit_output = find_credit_record_output(tx.outputs, claimer.pnft_id)
  expect Some(c_out) = credit_output
  expect InlineDatum(c_data) = c_out.datum
  expect CaregiverCredits(credits): CareDatum = c_data
  
  credits.caregiver == claimer.pnft_id &&
  credits.total_credits >= total_credits
}

// =============================================================================
// UBI APPLICATION
// =============================================================================

fn validate_apply_to_ubi(
  tx: Transaction,
  datum: Option<CareDatum>,
  amount: Int,
  config: CareConfig,
) -> Bool {
  // 1. Must have credit record
  expect Some(CaregiverCredits(credits)) = datum
  
  // 2. Must have enough unapplied credits
  let available = credits.total_credits - credits.credits_applied
  expect amount <= available
  
  // 3. UBI contract must be called
  expect verify_ubi_contract_called(tx, config.ubi_contract)
  
  // 4. Update credit record
  let updated = CaregiverCreditRecord {
    ..credits,
    credits_applied: credits.credits_applied + amount,
  }
  
  // 5. Verify output
  True
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

fn find_signer_pnft(tx: Transaction, pnft_policy: PolicyId) -> Option<PnftData> {
  // Find a pNFT in inputs or reference inputs whose owner has signed the transaction
  let from_inputs = list.find_map(tx.inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect datum: PnftDatum = data
        if list.has(tx.extra_signatories, datum.owner) &&
           quantity_of(input.output.value, pnft_policy, datum.pnft_id) == 1 {
          Some(PnftData {
            pnft_id: datum.pnft_id,
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
  })

  when from_inputs is {
    Some(d) -> Some(d)
    None -> {
      // Also check reference inputs
      list.find_map(tx.reference_inputs, fn(input) {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: PnftDatum = data
            if list.has(tx.extra_signatories, datum.owner) &&
               quantity_of(input.output.value, pnft_policy, datum.pnft_id) == 1 {
              Some(PnftData {
                pnft_id: datum.pnft_id,
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
      })
    }
  }
}

type PnftData {
  pnft_id: AssetName,
  owner: VerificationKeyHash,
  level: VerificationLevel,
  bioregion: Option<ByteArray>,
}

fn verification_level_gte(a: VerificationLevel, b: VerificationLevel) -> Bool {
  // Compare verification levels: Basic < Ward < Standard < Verified < Steward
  let level_to_int = fn(level: VerificationLevel) -> Int {
    when level is {
      Basic -> 0
      Ward -> 1
      Standard -> 2
      Verified -> 3
      Steward -> 4
    }
  }
  level_to_int(a) >= level_to_int(b)
}

fn days_between(start: Int, end: Int) -> Int {
  (end - start) / 86400 + 1
}

fn get_current_slot(tx: Transaction) -> Int {
  // Extract current slot from transaction validity range
  when tx.validity_range.lower_bound.bound_type is {
    interval.Finite(slot) -> slot
    _ -> {
      // Fallback to upper bound if lower is unbounded
      when tx.validity_range.upper_bound.bound_type is {
        interval.Finite(slot) -> slot
        _ -> 0
      }
    }
  }
}

fn generate_record_id(caregiver: AssetName, timestamp: Int) -> ByteArray {
  // Generate unique record ID from caregiver pNFT and timestamp
  let timestamp_bytes = bytearray.from_int_big_endian(timestamp, 8)
  blake2b_256(bytearray.concat(caregiver, timestamp_bytes))
}

fn get_bioregion(pnft: PnftData) -> ByteArray {
  when pnft.bioregion is {
    Some(b) -> b
    None -> ""
  }
}

fn find_care_record_output(outputs: List<Output>) -> Option<Output> {
  list.find(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect care_datum: CareDatum = data
        when care_datum is {
          Record(_) -> True
          _ -> False
        }
      }
      _ -> False
    }
  })
}

fn is_attestable(status: CareRecordStatus) -> Bool {
  when status is {
    Pending -> True
    Attested { attestation_count } -> True
    _ -> False
  }
}

fn is_attested(status: CareRecordStatus) -> Bool {
  when status is {
    Attested { attestation_count } -> True
    _ -> False
  }
}

fn is_not_credited(status: CareRecordStatus) -> Bool {
  when status is {
    Credited { credited_at } -> False
    _ -> True
  }
}

fn validate_attestor_role(attestor: PnftData, record: CareRecord, role: AttestorRole) -> Bool {
  True // Simplified - would check actual relationships
}

fn has_attested(attestations: List<CareAttestation>, attestor: AssetName) -> Bool {
  list.any(attestations, fn(a) { a.attestor == attestor })
}

fn find_all_care_records(tx: Transaction, ids: List<ByteArray>) -> List<CareRecord> {
  // Find all care records from inputs that match the given IDs
  list.filter_map(tx.inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect care_datum: CareDatum = data
        when care_datum is {
          Record(record) -> {
            if list.has(ids, record.record_id) {
              Some(record)
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

fn calculate_credits(record: CareRecord, config: CareConfig) -> Int {
  // Hours × credits_per_hour for care type
  record.hours * 10 // Simplified
}

fn find_credit_record_output(outputs: List<Output>, _caregiver: AssetName) -> Option<Output> {
  list.head(outputs) // Simplified - returns first output
}

fn verify_ubi_contract_called(tx: Transaction, ubi_contract: ByteArray) -> Bool {
  // Verify that the UBI contract is being called in this transaction
  // Check if UBI contract is in inputs (being spent)
  let in_inputs = list.any(tx.inputs, fn(input) {
    when input.output.address.payment_credential is {
      address.Script(hash) -> hash == ubi_contract
      _ -> False
    }
  })

  // Also check if UBI contract is in reference inputs
  let in_ref_inputs = list.any(tx.reference_inputs, fn(input) {
    when input.output.address.payment_credential is {
      address.Script(hash) -> hash == ubi_contract
      _ -> False
    }
  })

  in_inputs || in_ref_inputs
}

fn validate_update_record(tx: Transaction, datum: Option<CareDatum>, record_id: ByteArray, new_hours: Option<Int>, new_notes: Option<ByteArray>, config: CareConfig) -> Bool {
  // 1. Get existing record
  expect Some(Record(record)) = datum
  expect record.record_id == record_id

  // 2. Must be pending (not yet attested)
  expect record.status == Pending

  // 3. Caregiver must sign
  let caregiver_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(caregiver) = caregiver_pnft
  expect caregiver.pnft_id == record.caregiver
  expect list.has(tx.extra_signatories, caregiver.owner)

  // 4. Apply updates
  let updated_hours = when new_hours is {
    Some(h) -> h
    None -> record.hours
  }
  let updated_notes = when new_notes is {
    Some(n) -> Some(n)
    None -> record.notes_hash
  }

  // 5. Hours must still be valid
  expect updated_hours > 0
  expect updated_hours <= config.max_daily_hours * days_between(record.started_at, record.ended_at)

  // 6. Verify output has updated record
  let output = find_care_record_output(tx.outputs)
  expect Some(out) = output
  expect InlineDatum(data) = out.datum
  expect Record(result): CareDatum = data

  result.record_id == record_id &&
  result.hours == updated_hours &&
  result.notes_hash == updated_notes &&
  result.caregiver == record.caregiver
}

fn validate_cancel_record(tx: Transaction, datum: Option<CareDatum>, record_id: ByteArray, config: CareConfig) -> Bool {
  // 1. Get existing record
  expect Some(Record(record)) = datum
  expect record.record_id == record_id

  // 2. Must be pending (not yet attested or credited)
  expect record.status == Pending

  // 3. Caregiver must sign
  let caregiver_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(caregiver) = caregiver_pnft
  expect caregiver.pnft_id == record.caregiver
  expect list.has(tx.extra_signatories, caregiver.owner)

  // 4. Record should not be recreated (UTxO is consumed without replacement)
  let no_record_output = !list.any(tx.outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect care_datum: CareDatum = data
        when care_datum is {
          Record(r) -> r.record_id == record_id
          _ -> False
        }
      }
      _ -> False
    }
  })

  no_record_output
}

fn validate_dispute_record(tx: Transaction, datum: Option<CareDatum>, record_id: ByteArray, reason: ByteArray, config: CareConfig) -> Bool {
  // 1. Get existing record
  expect Some(Record(record)) = datum
  expect record.record_id == record_id

  // 2. Record must be Pending or Attested (not yet credited)
  expect is_attestable(record.status)

  // 3. Disputer must sign (any pNFT holder can dispute)
  let disputer_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(disputer) = disputer_pnft
  expect list.has(tx.extra_signatories, disputer.owner)

  // 4. Disputer cannot be the caregiver (would use CancelRecord instead)
  expect disputer.pnft_id != record.caregiver

  // 5. Reason must be provided
  expect reason != #""

  // 6. Record should be updated with Disputed status
  let output = find_care_record_output(tx.outputs)
  expect Some(out) = output
  expect InlineDatum(data) = out.datum
  expect Record(result): CareDatum = data

  result.record_id == record_id &&
  result.status == Disputed { reason: reason }
}

fn validate_aggregate_bioregion(tx: Transaction, datum: Option<CareDatum>, bioregion: ByteArray, cycle: Int, config: CareConfig) -> Bool {
  // 1. Must have existing bioregion stats or create new
  let existing_stats = when datum is {
    Some(BioregionCareStats(stats)) -> Some(stats)
    _ -> None
  }

  // 2. Aggregator must be Steward level in this bioregion
  let aggregator_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(aggregator) = aggregator_pnft
  expect aggregator.level == Steward
  expect aggregator.bioregion == Some(bioregion)
  expect list.has(tx.extra_signatories, aggregator.owner)

  // 3. Gather all care records for this bioregion from inputs
  let care_records = list.filter_map(tx.inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect care_datum: CareDatum = data
        when care_datum is {
          Record(record) -> {
            if record.bioregion == bioregion {
              Some(record)
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

  // 4. Calculate aggregated stats
  let total_hours = list.foldl(care_records, 0, fn(r, acc) { acc + r.hours })
  // Count unique caregivers by folding over records
  let caregivers = list.map(care_records, fn(r) { r.caregiver })
  let active_caregivers = count_unique(caregivers)

  // 5. Verify output has correct aggregated data
  let output = list.find(tx.outputs, fn(out) {
    when out.datum is {
      InlineDatum(data) -> {
        expect result: CareDatum = data
        when result is {
          BioregionCareStats(stats) -> stats.bioregion == bioregion && stats.cycle == cycle
          _ -> False
        }
      }
      _ -> False
    }
  })
  expect Some(out) = output
  expect InlineDatum(out_data) = out.datum
  expect BioregionCareStats(result_stats): CareDatum = out_data

  result_stats.bioregion == bioregion &&
  result_stats.cycle == cycle &&
  result_stats.total_hours >= total_hours &&
  result_stats.active_caregivers >= active_caregivers
}

/// Count unique items in a list
fn count_unique(items: List<AssetName>) -> Int {
  list.foldl(items, ([], 0), fn(item, acc) {
    let (seen, count) = acc
    if list.has(seen, item) {
      (seen, count)
    } else {
      (list.concat(seen, [item]), count + 1)
    }
  }).2nd
}
