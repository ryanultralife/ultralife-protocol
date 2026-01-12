// =============================================================================
// UltraLife Protocol — Universal Types
// =============================================================================
//
// THE FRAMEWORK: Not defining every activity, but enabling ALL activities
// through universal patterns for offer/need/agree/perform/verify/settle.
//
// Every economic activity in human civilization flows through these patterns.
// The system doesn't judge what you do — it makes it transparent.
//
// =============================================================================

use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId, AssetName}

// =============================================================================
// UNIVERSAL OFFERING
// =============================================================================
// Anyone can offer anything. The framework just needs to know:
// WHO is offering, WHAT they're offering, WHERE, WHEN, and on what TERMS.
// =============================================================================

/// Universal offering — works for ANY economic activity
pub type Offering {
  /// Unique ID
  offering_id: ByteArray,
  /// Who's offering (pNFT)
  offerer: AssetName,
  /// Category (from registry or custom)
  category: CategoryRef,
  /// What specifically
  what: WhatOffered,
  /// Where
  location: LocationScope,
  /// When available
  availability: TimeScope,
  /// Terms
  terms: Terms,
  /// Expected compound flows (transparency)
  expected_compounds: List<CompoundFlow>,
  /// Supporting evidence/credentials
  evidence: List<ByteArray>,
  /// Status
  status: OfferingStatus,
  /// Created
  created_at: Int,
}

pub type CategoryRef {
  /// From community registry
  Registry { code: ByteArray }
  /// Custom (for novel offerings)
  Custom { description_hash: ByteArray }
}

pub type WhatOffered {
  /// Physical thing
  Thing { description_hash: ByteArray, quantity: Option<Int>, unit: Option<ByteArray> }
  /// Work/capability
  Work { description_hash: ByteArray, duration: Option<Int> }
  /// Access to asset
  Access { asset_id: AssetName, access_type: ByteArray, duration: Option<Int> }
  /// Knowledge/information
  Knowledge { description_hash: ByteArray }
  /// Care/support
  Care { description_hash: ByteArray, duration: Option<Int> }
}

pub type LocationScope {
  Specific { bioregion: ByteArray, location_hash: ByteArray }
  Bioregional { bioregion: ByteArray }
  Mobile { range: List<ByteArray> }
  Remote
  Anywhere
}

pub type TimeScope {
  Now
  Scheduled { start: Int, end: Option<Int> }
  Recurring { pattern_hash: ByteArray }
  OnDemand
}

pub type Terms {
  Priced { amount: Int, negotiable: Bool }
  Range { min: Int, max: Int }
  Auction { starting: Int, reserve: Option<Int> }
  Trade { accepts_hash: ByteArray }
  Gift { conditions: Option<ByteArray> }
  CommunityService
}

pub type OfferingStatus {
  Active
  Paused
  Fulfilled
  Expired
  Cancelled
}

// =============================================================================
// UNIVERSAL NEED
// =============================================================================
// Anyone can express any need. The framework just needs to know:
// WHO needs it, WHAT they need, WHERE, WHEN, their BUDGET, and REQUIREMENTS.
// =============================================================================

/// Universal need — works for ANY requirement
pub type Need {
  /// Unique ID
  need_id: ByteArray,
  /// Who needs it (pNFT)
  needer: AssetName,
  /// Category
  category: CategoryRef,
  /// What specifically
  what: WhatNeeded,
  /// Where
  location: LocationScope,
  /// When needed
  when_needed: TimeScope,
  /// Budget
  budget: Budget,
  /// Requirements for fulfiller
  requirements: List<Requirement>,
  /// Maximum acceptable impacts
  impact_limits: Option<List<CompoundLimit>>,
  /// Status
  status: NeedStatus,
  /// Created
  created_at: Int,
  /// Deadline for responses
  deadline: Option<Int>,
}

pub type WhatNeeded {
  Thing { description_hash: ByteArray, quantity: Option<Int> }
  Work { description_hash: ByteArray, scope_hash: ByteArray }
  Access { asset_type_hash: ByteArray, duration: Option<Int> }
  Knowledge { topic_hash: ByteArray }
  Care { description_hash: ByteArray, duration: Option<Int> }
}

pub type Budget {
  Fixed { amount: Int }
  Range { min: Int, max: Int }
  Negotiable
  Trade { offering_hash: ByteArray }
}

pub type Requirement {
  MinVerification { level: Int }  // 1=Standard, 2=Verified, 3=Steward
  Credential { credential_hash: ByteArray }
  Residency { bioregion: ByteArray }
  MinEfficiency { compound: ByteArray, max_rating: Int }
  Custom { requirement_hash: ByteArray }
}

pub type CompoundLimit {
  compound: ByteArray,
  max_quantity: Int,
  unit: ByteArray,
}

pub type NeedStatus {
  Open
  InProgress { fulfiller: AssetName }
  Fulfilled
  Cancelled
  Expired
}

// =============================================================================
// UNIVERSAL AGREEMENT
// =============================================================================
// When offer meets need, an agreement forms.
// =============================================================================

/// Universal agreement — the contract between parties
pub type Agreement {
  /// Unique ID
  agreement_id: ByteArray,
  /// The parties
  party_a: AssetName,
  party_b: AssetName,
  /// What's being exchanged
  deliverable_hash: ByteArray,
  /// Payment
  payment: Int,
  /// Timeline
  start_by: Option<Int>,
  complete_by: Int,
  /// Expected compounds
  expected_compounds: List<CompoundFlow>,
  /// Verification method
  verification: VerificationMethod,
  /// Escrow
  escrow: Option<Escrow>,
  /// Status
  status: AgreementStatus,
  /// Created
  created_at: Int,
}

pub type VerificationMethod {
  SelfReported
  CounterpartyConfirm
  CommunityAttestation { min_attestors: Int }
  DesignatedVerifier { verifier: AssetName }
  Automatic { oracle_hash: ByteArray }
}

pub type Escrow {
  escrow_id: ByteArray,
  amount: Int,
  release_conditions_hash: ByteArray,
}

pub type AgreementStatus {
  Pending
  Active
  WorkSubmitted { evidence_hash: ByteArray }
  Verified
  Complete
  Disputed { reason_hash: ByteArray }
  Cancelled
}

// =============================================================================
// UNIVERSAL ACTIVITY RECORD
// =============================================================================
// What actually happened — the chemistry
// =============================================================================

/// Record of what actually happened
pub type ActivityRecord {
  /// Unique ID
  record_id: ByteArray,
  /// Which agreement this fulfills
  agreement_id: ByteArray,
  /// Who performed
  performer: AssetName,
  /// What compounds flowed
  compound_flows: List<CompoundFlow>,
  /// Evidence
  evidence_hash: ByteArray,
  /// When
  timestamp: Int,
  /// Who verified
  verified_by: List<AssetName>,
  /// Where impacts accrue
  impacts_to: ImpactDestination,
}

pub type ImpactDestination {
  Asset { asset_id: AssetName }
  Consumer { consumer_pnft: AssetName }
  Commons { bioregion: ByteArray }
}

// =============================================================================
// COMPOUND FLOWS — THE CHEMISTRY
// =============================================================================
// What actually moves in the physical world
// =============================================================================

/// A single compound flow
pub type CompoundFlow {
  /// Compound code (from registry: CO2, H2O, NOx, etc.)
  compound: ByteArray,
  /// Signed quantity: + = produced/released, - = consumed/sequestered
  quantity: Int,
  /// Unit
  unit: ByteArray,
  /// Measurement method
  measurement: ByteArray,
  /// Confidence (0-100)
  confidence: Int,
}

/// Accumulated balance
pub type CompoundBalance {
  compound: ByteArray,
  quantity: Int,
  unit: ByteArray,
}

// =============================================================================
// UNIVERSAL STAKE
// =============================================================================
// Anyone can stake in anything
// =============================================================================

/// Universal stake
pub type Stake {
  stake_id: ByteArray,
  staker: AssetName,
  target: StakeTarget,
  amount: Int,
  start: Int,
  end: Option<Int>,
  returns: StakeReturns,
  status: StakeStatus,
}

pub type StakeTarget {
  Offering { offering_id: ByteArray }
  Collective { collective_id: ByteArray }
  BioregionFund { bioregion: ByteArray, category: ByteArray }
  Asset { asset_id: AssetName }
  Research { research_id: ByteArray }
  Pool { pool_id: ByteArray }
}

pub type StakeReturns {
  Yield { rate_bps: Int }
  Access { access_hash: ByteArray }
  ProductRights { allocation_hash: ByteArray }
  Governance { weight: Int }
  ImpactCredits { compound: ByteArray, multiplier: Int }
}

pub type StakeStatus {
  Active
  Withdrawn
  Matured
}

// =============================================================================
// BIOREGION INDEX
// =============================================================================
// Aggregate health of the bioregion
// =============================================================================

/// Bioregion health index
pub type BioregionIndex {
  bioregion: ByteArray,
  cycle: Int,
  
  /// Resource health (each 0-10000)
  water_index: IndexValue,
  land_index: IndexValue,
  air_index: IndexValue,
  energy_index: IndexValue,
  
  /// Human wellbeing (each 0-10000)
  health_index: IndexValue,
  education_index: IndexValue,
  housing_index: IndexValue,
  food_security_index: IndexValue,
  care_availability_index: IndexValue,
  
  /// Economic activity
  offerings_active: Int,
  needs_active: Int,
  agreements_completed: Int,
  value_transacted: Int,
  care_hours: Int,
  
  /// Compound balances
  compound_balances: List<CompoundBalance>,
  
  /// Overall health
  health_score: Int,
  
  /// Last updated
  updated_at: Int,
}

pub type IndexValue {
  value: Int,
  trend: Int,
  confidence: Int,
}

// =============================================================================
// REGISTRY — COMMUNITY-DEFINED CLASSIFICATIONS
// =============================================================================
// Communities define their own codes. The framework doesn't impose.
// =============================================================================

/// Registry entry
pub type RegistryEntry {
  code: ByteArray,
  parent: Option<ByteArray>,
  name_hash: ByteArray,
  description_hash: ByteArray,
  defined_by: RegistryAuthority,
  typical_compounds: List<ByteArray>,
  status: RegistryStatus,
}

pub type RegistryAuthority {
  Global { standard: ByteArray }
  Bioregional { bioregion: ByteArray }
  Collective { collective_id: ByteArray }
  Individual { pnft: AssetName }
}

pub type RegistryStatus {
  Active
  Deprecated { replacement: Option<ByteArray> }
}

// =============================================================================
// IDENTITY — WHO
// =============================================================================

/// Verification levels
pub type VerificationLevel {
  Basic      // Wallet only
  Standard   // DNA verified
  Verified   // + bioregion residency
  Steward    // + community endorsement
}

/// pNFT datum
pub type PnftDatum {
  pnft_id: ByteArray,
  owner: VerificationKeyHash,
  level: VerificationLevel,
  bioregion: Option<ByteArray>,
  dna_hash: Option<ByteArray>,
  created_at: Int,
  /// Consumer's accumulated impacts
  consumer_impacts: Option<List<CompoundBalance>>,
  /// Care credits earned
  care_credits: Int,
}

// =============================================================================
// COLLECTIVE — GROUPS OF HUMANS
// =============================================================================

/// Collective (group of pNFTs working together)
pub type Collective {
  collective_id: ByteArray,
  name_hash: ByteArray,
  members: List<AssetName>,
  resources: List<AssetName>,
  governance_hash: ByteArray,
  treasury: ByteArray,
  bioregion: ByteArray,
}

// =============================================================================
// THAT'S IT
// =============================================================================
// These universal types handle ANY economic activity:
// - Farming, fishing, forestry, mining → Offerings of type Thing/Work
// - Manufacturing, construction → Needs matched with Work offerings
// - Services of any kind → Offerings of type Work/Knowledge/Care
// - Research, education → Offerings of type Knowledge
// - Childcare, eldercare → Offerings of type Care
// - Any asset transfer → Agreement with Thing
// - Any rental → Offering of type Access
//
// The framework doesn't define what's valid. Communities define their own
// registry codes. The system just makes everything transparent.
//
// The result: markets optimize for what's measured (compound flows),
// creating the greatest abundance of carbon-based life ever.
// =============================================================================
