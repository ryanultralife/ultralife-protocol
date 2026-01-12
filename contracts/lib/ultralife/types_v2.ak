// =============================================================================
// UltraLife Protocol — Core Types V2
// =============================================================================
//
// FUNDAMENTAL PRINCIPLES:
// 1. Every transaction has impact — there is no "neutral"
// 2. Impact measures physical reality — compounds affecting carbon-based life
// 3. UltraLife token IS the economy — not a layer on top
// 4. Bioregions have stake pools — economic infrastructure tied to land
// 5. Validators opt into bioregional economics
//
// =============================================================================

use aiken/crypto.{VerificationKeyHash, Blake2b_256, Hash}
use cardano/assets.{PolicyId, AssetName}

// =============================================================================
// PHYSICAL REALITY — IMPACT COMPOUNDS
// =============================================================================
//
// These are not abstract categories. These are the actual molecular and
// energetic flows that sustain or degrade carbon-based life on Earth.
//
// Every transaction transforms matter and energy. Every action has consequence.
// The economy must account for physical reality.
//
// =============================================================================

/// Impact Category — physical systems affecting planetary vitality
/// Codes are hierarchical: 0x05XX where XX identifies subcategory
// =============================================================================
// IMPACT COMPOUNDS — The Chemistry of Activity
// =============================================================================
// Impacts are not abstract metrics. They are actual chemical compounds.
// When you pour concrete, you release CO₂, NOₓ, PM₂.₅ — real molecules.
// When a forest grows, it fixes CO₂ into cellulose — real chemistry.
// =============================================================================

/// Compound codes — actual chemical formulas
/// First byte: Element group, remaining bytes: specific compound
pub type CompoundCode = ByteArray

/// Carbon compounds (0x01xx)
/// CO2 = #"0101", CH4 = #"0102", CO = #"0103", Glucose = #"0104"
/// Cellulose = #"0105", Lignin = #"0106", Humus = #"0107", Biochar = #"0108"

/// Nitrogen compounds (0x02xx)
/// N2 = #"0201", NO = #"0202", NO2 = #"0203", N2O = #"0204"
/// NH3 = #"0205", NO3 = #"0206", N_organic = #"0207"

/// Sulfur compounds (0x03xx)
/// SO2 = #"0301", SO3 = #"0302", H2S = #"0303", SO4 = #"0304"

/// Water & oxygen (0x04xx)
/// H2O = #"0401", O2 = #"0402", O3 = #"0403"

/// Phosphorus (0x05xx)
/// PO4 = #"0501", P_organic = #"0502"

/// Particulates (0x06xx)
/// PM10 = #"0601", PM25 = #"0602", BlackCarbon = #"0603", Dust = #"0604"

/// Metals (0x07xx)
/// Fe = #"0701", Al = #"0702", Pb = #"0703", Hg = #"0704", Cd = #"0705", As = #"0706"

/// Calcium (0x08xx)
/// CaCO3 = #"0801", Ca(OH)2 = #"0802"

/// System domains affected by compound flows
pub type SystemDomain {
  /// Carbon cycle: atmosphere, biosphere, pedosphere
  CarbonCycle
  /// Nitrogen cycle: atmosphere, soil, water
  NitrogenCycle
  /// Water cycle: hydrosphere, atmosphere
  WaterCycle
  /// Air quality: troposphere
  AirQuality
  /// Soil health: pedosphere, microbial
  SoilHealth
  /// Biodiversity: structural/habitat (not a compound)
  Biodiversity
}

/// Unit of mass/volume for compound quantities
pub type MassUnit {
  Grams
  Kilograms
  MetricTons
  Liters
  CubicMeters
  Moles
}

/// How was this compound flow measured?
pub type MeasurementMethod {
  /// Direct measurement (sensor, lab test)
  Direct { 
    instrument: ByteArray,
    calibration_date: Int,
  }
  /// Calculated from activity data
  Calculated {
    formula: ByteArray,
    input_sources: List<ByteArray>,
  }
  /// Estimated from similar activities
  Estimated {
    reference: ByteArray,
    similarity: Int,
  }
  /// Certified by surveyor (pNFT)
  Surveyed {
    surveyor_pnft: AssetName,
    survey_date: Int,
  }
}

/// A single compound flow — what actually moved in the physical world
pub type CompoundFlow {
  /// Which compound (chemical formula code)
  compound: CompoundCode,
  /// SIGNED quantity: Positive = released/produced, Negative = consumed/sequestered
  /// +1000 grams CO2 = you released 1kg CO2 to atmosphere
  /// -1000 grams CO2 = you sequestered 1kg CO2 from atmosphere
  quantity: Int,
  /// Unit of measurement
  unit: MassUnit,
  /// How was this measured?
  measurement: MeasurementMethod,
  /// Confidence in measurement (0-100)
  confidence: Int,
  /// Which system domain is affected
  system: SystemDomain,
}

/// Legacy ImpactCategory for backward compatibility
/// DEPRECATED: Use CompoundFlow instead
pub type ImpactCategory {
  /// Carbon cycle: CO2, CH4, soil carbon, biomass
  /// Subcodes: 0x0500 (general), 0x0501 (CO2), 0x0502 (CH4), 0x0503 (soil), 0x0504 (biomass)
  Carbon
  
  /// Water cycle: aquifer, watershed, contamination, evapotranspiration
  /// Subcodes: 0x0510 (general), 0x0511 (aquifer), 0x0512 (watershed), 0x0513 (quality)
  Water
  
  /// Biodiversity: habitat, species, genetics, pollinators
  /// Subcodes: 0x0520 (general), 0x0521 (habitat), 0x0522 (species), 0x0523 (genetic)
  Biodiversity
  
  /// Soil biology: microbes, fungi, organic matter, erosion
  /// Subcodes: 0x0530 (general), 0x0531 (microbial), 0x0532 (fungal), 0x0533 (organic)
  Soil
  
  /// Atmospheric: oxygen, particulates, ozone, NOx/SOx
  /// Subcodes: 0x0540 (general), 0x0541 (O2), 0x0542 (particulate), 0x0543 (ozone)
  Air
  
  /// Material flows: waste, toxins, resources, entropy
  /// Subcodes: 0x0550 (general), 0x0551 (waste), 0x0552 (toxin), 0x0553 (resource)
  Waste
  
  /// Energy: renewable, fossil, efficiency, storage
  /// Subcodes: 0x0560 (general), 0x0561 (renewable), 0x0562 (fossil), 0x0563 (efficiency)
  Energy
  
  /// Land use: conversion, restoration, fragmentation
  /// Subcodes: 0x0570 (general), 0x0571 (agriculture), 0x0572 (forest), 0x0573 (urban)
  LandUse
}

/// Single impact measurement — physical consequence
/// Uses compound flows for actual chemistry
pub type Impact {
  /// Specific compound code (actual chemistry)
  compound: CompoundCode,
  /// SIGNED magnitude: positive = released, negative = sequestered
  magnitude: Int,
  /// Unit of measurement
  unit: MassUnit,
  /// How was this measured?
  measurement: MeasurementMethod,
  /// Measurement confidence (0-100)
  confidence: Int,
  /// Which system domain is affected
  system: SystemDomain,
  /// Geographic specificity
  locality: ImpactLocality,
}

/// Where does this impact manifest?
pub type ImpactLocality {
  /// Affects only the specific site
  Site
  /// Affects the watershed/airshed
  Local
  /// Affects the bioregion
  Regional
  /// Affects planetary systems
  Global
}

// =============================================================================
// UNIVERSAL IMPACT — NO TRANSACTION WITHOUT CONSEQUENCE
// =============================================================================

/// Transaction metadata — IMPACT IS MANDATORY
/// Every movement of value has physical consequence. No exceptions.
pub type TransactionMeta {
  /// Type of economic activity
  tx_type: TransactionType,
  /// REQUIRED: List of impacts. CANNOT BE EMPTY.
  /// "Neutral" doesn't exist — even a digital transaction uses energy.
  /// Declare all known impacts honestly. Attestors will verify.
  impacts: List<Impact>,
  /// Evidence hash (IPFS CID) — methodology, measurements, photos
  evidence_hash: ByteArray,
  /// Who attested to these impacts? (pNFT IDs)
  attestors: List<AssetName>,
  /// Timestamp of measurement (may differ from transaction time)
  measured_at: Int,
}

/// Types of economic transactions
pub type TransactionType {
  /// Payment for labor/work
  Labor { 
    work_code: ByteArray,
    hours: Option<Int>,
  }
  /// Payment for physical goods
  Goods { 
    product_code: ByteArray,
    quantity: Int,
    unit_code: ByteArray,
  }
  /// Payment for services
  Services { 
    service_code: ByteArray,
  }
  /// Gift or donation
  Gift
  /// Investment or loan
  Investment { 
    terms_hash: ByteArray,
  }
  /// Remediation payment (offsetting negative impact)
  Remediation { 
    bond_id: ByteArray,
  }
  /// UBI distribution
  UBI { 
    cycle: Int,
  }
  /// Governance reward
  GovernanceReward { 
    proposal_id: ByteArray,
  }
  /// Internal transfer (same owner, different UTXOs)
  Internal
  /// Stake pool delegation reward
  StakeReward {
    pool_id: ByteArray,
    epoch: Int,
  }
  /// Impact token trade (buying/selling offsets)
  ImpactTrade {
    impact_token_id: ByteArray,
    direction: TradeDirection,
  }
}

/// Direction of impact token trade
pub type TradeDirection {
  /// Buying offsets (to remediate negative impact)
  Buy
  /// Selling offsets (monetizing positive impact)
  Sell
}

// =============================================================================
// BIOREGIONAL STAKE POOLS — ECONOMIC INFRASTRUCTURE
// =============================================================================
//
// Each bioregion has stake pools that:
// 1. Validate Cardano blocks (earn ADA rewards)
// 2. Accept UltraLife token delegation
// 3. Distribute rewards in UltraLife tokens
// 4. Serve as economic health indicator for the bioregion
// 5. Provide liquidity between ADA and UltraLife
//
// Validators OPT IN to bioregional economics by:
// - Registering their pool with a bioregion
// - Accepting UltraLife delegations
// - Committing to impact transparency
//
// =============================================================================

/// Bioregion Datum — complete bioregional economic and ecological state
pub type BioregionDatum {
  /// Unique bioregion identifier
  bioregion_id: ByteArray,
  /// Human-readable name hash
  name_hash: ByteArray,
  /// Geographic bounds hash (GeoJSON on IPFS)
  bounds_hash: ByteArray,
  /// Current health index (0-10000 = 0-100.00%)
  health_index: Int,
  /// Number of registered residents (pNFT holders)
  resident_count: Int,
  /// Bioregion treasury script hash
  treasury: ByteArray,
  /// Creation slot
  created_at: Int,
  /// Last health update cycle
  last_health_update: Int,
  
  // === STAKE POOL ECONOMICS ===
  
  /// Registered stake pools in this bioregion
  stake_pools: List<BioregionPool>,
  /// Total UltraLife tokens staked to bioregion pools
  total_staked: Int,
  /// Stake from residents (home bioregion)
  resident_stake: Int,
  /// Stake from non-residents (external investment)
  external_stake: Int,
  /// Current epoch
  current_epoch: Int,
  /// Cumulative impact score (sum of all transaction impacts)
  cumulative_impact: Int,
  /// Economic velocity (transactions per cycle)
  tx_velocity: Int,
  
  // === PRESERVATION METRICS ===
  
  /// Total area under active preservation grants (m²)
  preserved_area: Int,
  /// Active preservation grants count
  active_grants: Int,
  /// Total distributed to preservation this cycle
  preservation_distributed: Int,
  /// Certified surveyors in this bioregion
  surveyor_count: Int,
  /// Surveys completed this cycle
  surveys_this_cycle: Int,
  /// Average ecosystem health across surveyed locations
  average_ecosystem_health: Int,
  /// Ecosystem health trend
  health_trend: HealthTrend,
  
  // === BIODIVERSITY INDICATORS ===
  
  /// Species count (from surveys)
  documented_species: Int,
  /// Habitat connectivity score (0-100)
  connectivity_score: Int,
  /// Native vs invasive ratio (0-10000 = 0-100%)
  native_ratio: Int,
  /// Restoration projects active
  restoration_projects: Int,
}

/// Stake pool registered to a bioregion
pub type BioregionPool {
  /// Cardano pool ID (bech32 hash)
  pool_id: ByteArray,
  /// Pool operator pNFT (must be Verified+ in this bioregion)
  operator_pnft: AssetName,
  /// UltraLife tokens delegated to this pool
  ultralife_stake: Int,
  /// Pool's declared impact commitment
  impact_commitment: PoolImpactCommitment,
  /// Registration slot
  registered_at: Int,
  /// Is pool active?
  active: Bool,
  /// Pool margin (percentage kept by operator, in basis points)
  margin: Int,
  /// Minimum delegation amount
  min_delegation: Int,
}

/// Pool operator's commitment to impact transparency
pub type PoolImpactCommitment {
  /// Does pool run on renewable energy?
  renewable_energy: Bool,
  /// Pool's operational carbon footprint (kg CO2e per epoch)
  carbon_footprint: Int,
  /// Percentage of rewards directed to bioregion treasury
  treasury_contribution: Int,
  /// Commitment to fund local impact projects
  local_reinvestment: Int,
  /// Evidence hash for these claims
  evidence_hash: ByteArray,
}

/// Delegation of UltraLife tokens to a bioregion pool
pub type StakeDelegation {
  /// Delegator's pNFT
  delegator: AssetName,
  /// Target pool
  pool_id: ByteArray,
  /// Amount delegated
  amount: Int,
  /// Delegation start epoch
  start_epoch: Int,
  /// Auto-compound rewards?
  auto_compound: Bool,
  /// Lock period (0 = liquid)
  lock_epochs: Int,
}

/// Stake pool reward distribution
pub type PoolRewards {
  /// Pool ID
  pool_id: ByteArray,
  /// Epoch
  epoch: Int,
  /// Total rewards earned (in UltraLife tokens)
  total_rewards: Int,
  /// Operator share
  operator_share: Int,
  /// Delegator share
  delegator_share: Int,
  /// Treasury share (goes to bioregion)
  treasury_share: Int,
  /// Impact bonus/penalty based on pool's verified impact
  impact_modifier: Int,
}

// =============================================================================
// IDENTITY TYPES
// =============================================================================

/// Verification levels for pNFTs
pub type VerificationLevel {
  /// Wallet signature only. Can view data. Cannot transact tokens.
  Basic
  /// DNA verified. Can transact, claim grants, vote, delegate stake.
  Standard
  /// Standard + bioregion residency. Can propose, operate pools, higher voting weight.
  Verified
  /// Verified + community endorsement. Multi-sig, emergency gov, pool endorsement.
  Steward
}

/// pNFT Datum — personal identity token
/// This is your complete economic identity on-chain
pub type PnftDatum {
  /// Unique identifier (derived from DNA hash)
  pnft_id: ByteArray,
  /// Owner's verification key hash
  owner: VerificationKeyHash,
  /// Current verification level
  level: VerificationLevel,
  /// Assigned bioregion (None for Basic)
  bioregion: Option<ByteArray>,
  /// DNA verification hash (None for Basic)
  dna_hash: Option<ByteArray>,
  /// Creation slot
  created_at: Int,
  /// Last level upgrade slot
  upgraded_at: Option<Int>,
  
  // === STAKE VISIBILITY ===
  // Shows exactly where this person's economic commitment lies
  
  /// Detailed stake delegations (visible to all)
  stake_portfolio: StakePortfolio,
  
  // === IMPACT TRACKING ===
  
  /// Cumulative lifetime impact score
  lifetime_impact: Int,
  /// Current cycle impact score
  cycle_impact: Int,
  /// Impact breakdown by category (lifetime)
  impact_by_category: List<(ImpactCategory, Int)>,
  
  // === SURVEYOR/VERIFIER CREDENTIALS ===
  
  /// Is this pNFT a certified surveyor?
  surveyor_certification: Option<SurveyorCert>,
  /// Bioregions this person can survey (if certified)
  survey_regions: List<ByteArray>,
}

/// Complete visibility into where someone stakes
pub type StakePortfolio {
  /// Total tokens currently staked
  total_staked: Int,
  /// Staked in home bioregion
  home_bioregion_stake: Int,
  /// Staked in other bioregions
  external_stakes: List<ExternalStake>,
  /// Percentage staked in home bioregion (0-10000 = 0-100%)
  home_percentage: Int,
  /// Unclaimed rewards
  pending_rewards: Int,
  /// Last reward claim epoch
  last_claim_epoch: Int,
}

/// Stake in a bioregion other than home
pub type ExternalStake {
  /// Target bioregion
  bioregion: ByteArray,
  /// Pool ID
  pool_id: ByteArray,
  /// Amount delegated
  amount: Int,
  /// Lock status
  locked_until_epoch: Option<Int>,
}

/// Surveyor certification for biodiversity/impact verification
pub type SurveyorCert {
  /// Certification type
  cert_type: SurveyorType,
  /// Issuing authority (governance proposal that certified)
  issued_by: ByteArray,
  /// Issue date
  issued_at: Int,
  /// Expiration (must be renewed)
  expires_at: Int,
  /// Specializations (which impact categories)
  specializations: List<ImpactCategory>,
  /// Completed surveys
  surveys_completed: Int,
  /// Accuracy score (verified vs disputed)
  accuracy_score: Int,
}

// =============================================================================
// TRANSACTION RECORDS — FULL HISTORY
// =============================================================================

/// On-chain transaction record
pub type TransactionRecord {
  /// Sender pNFT
  sender: AssetName,
  /// Sender bioregion
  sender_bioregion: ByteArray,
  /// Recipient pNFT
  recipient: AssetName,
  /// Recipient bioregion
  recipient_bioregion: ByteArray,
  /// Token amount
  amount: Int,
  /// Transaction type
  tx_type: TransactionType,
  /// ALL impacts (cannot be empty)
  impacts: List<Impact>,
  /// Net impact score (sum of magnitude * confidence / 100)
  net_impact: Int,
  /// PRC-37 cycle
  cycle: Int,
  /// Slot
  slot: Int,
  /// Evidence hash
  evidence_hash: ByteArray,
}

/// Avatar cycle statistics
pub type AvatarCycleStats {
  /// pNFT identifier
  pnft: AssetName,
  /// Bioregion
  bioregion: ByteArray,
  /// Cycle number
  cycle: Int,
  /// Transactions sent
  tx_sent: Int,
  /// Transactions received
  tx_received: Int,
  /// Volume sent
  volume_sent: Int,
  /// Volume received
  volume_received: Int,
  /// Net impact this cycle
  impact_score: Int,
  /// Impact breakdown by category
  impact_by_category: List<(ImpactCategory, Int)>,
  /// Participation score (0-100)
  participation: Int,
  /// Staking rewards earned
  stake_rewards: Int,
}

/// Bioregion cycle statistics
pub type BioregionCycleStats {
  /// Bioregion ID
  bioregion: ByteArray,
  /// Cycle
  cycle: Int,
  /// Active participants
  active_participants: Int,
  /// Total transactions
  total_transactions: Int,
  /// Total volume
  total_volume: Int,
  /// Net impact (all transactions)
  net_impact: Int,
  /// Impact by category
  impact_by_category: List<(ImpactCategory, Int)>,
  /// Health index at cycle end
  health_index: Int,
  /// Total staked in bioregion pools
  total_staked: Int,
  /// Pool rewards distributed
  pool_rewards: Int,
  /// Are stats finalized?
  finalized: Bool,
}

// =============================================================================
// IMPACT TOKEN — TRADEABLE CONSEQUENCE
// =============================================================================

/// Impact token datum — represents verified environmental impact
/// Positive impact tokens can be sold to those who need offsets
/// This creates a market for planetary health
pub type ImpactDatum {
  /// Bioregion where impact occurred
  bioregion: ByteArray,
  /// Impact category
  category: ImpactCategory,
  /// Specific compound code
  compound_code: ByteArray,
  /// Magnitude (ALWAYS POSITIVE for impact tokens)
  /// Negative impacts cannot be tokenized — they must be remediated
  magnitude: Int,
  /// Unit of measurement
  unit: ByteArray,
  /// Confidence level
  confidence: Int,
  /// Evidence hash (IPFS) — photos, lab results, methodology
  evidence_hash: ByteArray,
  /// Who generated this impact (pNFT)
  generator: AssetName,
  /// Current owner (for trades)
  owner: AssetName,
  /// Attestations from Verified+ users
  attestations: List<Attestation>,
  /// Creation slot
  created_at: Int,
  /// Expiration (some impacts are time-limited)
  expires: Option<Int>,
  /// Has this token been used for offset?
  retired: Bool,
  /// If retired, which transaction used it?
  retirement_tx: Option<ByteArray>,
}

/// Attestation of impact claim
pub type Attestation {
  /// Attestor pNFT
  attestor: AssetName,
  /// Attestor's verification level at time of attestation
  level: VerificationLevel,
  /// Attestation slot
  attested_at: Int,
  /// Attestor's confidence in the claim (0-100)
  confidence: Int,
  /// Optional note hash
  note_hash: Option<ByteArray>,
}

// =============================================================================
// REMEDIATION — OFFSETTING NEGATIVE IMPACT
// =============================================================================

/// How negative impact will be remediated
pub type RemediationType {
  /// Immediate: offset in same transaction using impact tokens
  Immediate { 
    /// Impact tokens being burned
    impact_tokens: List<AssetName>,
  }
  /// Bonded: commit tokens as collateral, remediate later
  Bonded { 
    bond_id: ByteArray, 
    deadline: Int,
    /// Collateral amount (tokens locked)
    collateral: Int,
  }
  /// Purchased: buy impact tokens from market
  Purchased {
    /// Tokens being purchased
    tokens: List<AssetName>,
    /// Price paid
    price: Int,
  }
  /// Direct: physical remediation action verified by attestors
  Direct {
    /// Description of remediation action
    action_hash: ByteArray,
    /// Required attestations
    required_attestations: Int,
  }
}

/// Remediation bond datum
pub type BondDatum {
  /// Unique bond ID
  bond_id: ByteArray,
  /// Who posted the bond
  poster: AssetName,
  /// Poster's bioregion
  bioregion: ByteArray,
  /// Impact category being remediated
  category: ImpactCategory,
  /// Required remediation magnitude
  required_magnitude: Int,
  /// Bond amount (collateral)
  bond_amount: Int,
  /// Deadline slot
  deadline: Int,
  /// Current status
  status: BondStatus,
  /// Evidence of completion (if submitted)
  completion_evidence: Option<ByteArray>,
  /// Verifier who confirmed completion
  verified_by: Option<AssetName>,
  /// Creation slot
  created_at: Int,
}

/// Bond lifecycle status
pub type BondStatus {
  /// Bond is active, awaiting completion
  Active
  /// Completion submitted, awaiting verification
  Completed
  /// Verified complete, bond released
  Released
  /// Deadline passed without completion, bond slashed
  Slashed
}

// =============================================================================
// TREASURY — BIOREGION ECONOMIC HUB
// =============================================================================

/// Treasury datum — manages bioregion's economic reserves
pub type TreasuryDatum {
  /// Bioregion this treasury belongs to
  bioregion: ByteArray,
  /// UltraLife token reserves
  token_reserves: Int,
  /// ADA reserves (from pool rewards, entry fees)
  ada_reserves: Int,
  /// Tokens distributed (lifetime)
  tokens_distributed: Int,
  /// Current exchange rate (tokens per ADA, in millionths)
  exchange_rate: Int,
  /// Pool reward share (basis points going to delegators)
  pool_reward_share: Int,
  /// Governance multisig
  multisig: MultisigConfig,
  /// Impact fund (portion of treasury for impact projects)
  impact_fund: Int,
  /// Emergency fund
  emergency_fund: Int,
  /// Preservation fund (for biodiversity/ecosystem grants)
  preservation_fund: Int,
  /// Survey fund (pays surveyors for verification work)
  survey_fund: Int,
}

/// Multisig configuration
pub type MultisigConfig {
  /// Required signatures
  threshold: Int,
  /// Authorized signers (pNFT IDs)
  signers: List<AssetName>,
}

// =============================================================================
// BIOREGIONAL PRESERVATION & SURVEYING
// =============================================================================
//
// Mechanism for biodiversity verification and ecosystem preservation:
//
// 1. SURVEYS: Certified surveyors document ecosystem state
// 2. GRANTS: Treasury funds preservation/restoration projects
// 3. VERIFICATION: Multiple surveyors cross-verify claims
// 4. REWARDS: Residents earn for hosting healthy ecosystems
//
// This creates a market for KNOWING the truth about ecosystem health,
// and PAYING people to maintain/restore it.
//
// =============================================================================

/// Types of surveyors
pub type SurveyorType {
  /// Biodiversity specialist (species counts, habitat assessment)
  BiodiversitySurveyor
  /// Soil health specialist (microbial, fungal, carbon)
  SoilSurveyor
  /// Water quality specialist (aquifer, watershed, contamination)
  WaterSurveyor
  /// Carbon specialist (sequestration, biomass, emissions)
  CarbonSurveyor
  /// General ecosystem surveyor
  EcosystemSurveyor
  /// Traditional ecological knowledge holder
  TEKHolder
}

/// Survey record — documented ecosystem observation
pub type SurveyRecord {
  /// Unique survey ID
  survey_id: ByteArray,
  /// Surveyor pNFT
  surveyor: AssetName,
  /// Bioregion surveyed
  bioregion: ByteArray,
  /// Specific location hash (GPS coordinates on IPFS)
  location_hash: ByteArray,
  /// Survey type
  survey_type: SurveyType,
  /// Measurements taken
  measurements: List<SurveyMeasurement>,
  /// Evidence hash (photos, samples, methodology)
  evidence_hash: ByteArray,
  /// Survey date (slot)
  surveyed_at: Int,
  /// Submission date
  submitted_at: Int,
  /// Verification status
  status: SurveyStatus,
  /// Cross-verifications from other surveyors
  verifications: List<SurveyVerification>,
}

/// What kind of survey
pub type SurveyType {
  /// Baseline assessment (first survey of an area)
  Baseline
  /// Regular monitoring (periodic check)
  Monitoring
  /// Impact verification (verify claimed impacts)
  ImpactVerification
  /// Restoration assessment (track restoration progress)
  RestorationAssessment
  /// Emergency assessment (disaster/damage)
  EmergencyAssessment
}

/// Single measurement from a survey
pub type SurveyMeasurement {
  /// What was measured (impact category)
  category: ImpactCategory,
  /// Specific metric code
  metric_code: ByteArray,
  /// Value measured
  value: Int,
  /// Unit of measurement
  unit: ByteArray,
  /// Methodology code (how it was measured)
  methodology: ByteArray,
  /// Confidence in measurement
  confidence: Int,
}

/// Survey verification status
pub type SurveyStatus {
  /// Submitted, awaiting verification
  Pending
  /// Verified by required number of surveyors
  Verified
  /// Disputed (conflicting verifications)
  Disputed
  /// Rejected (failed verification)
  Rejected
}

/// Cross-verification from another surveyor
pub type SurveyVerification {
  /// Verifying surveyor
  verifier: AssetName,
  /// Do they confirm the findings?
  confirms: Bool,
  /// Their own measurements (if different)
  own_measurements: Option<List<SurveyMeasurement>>,
  /// Notes hash
  notes_hash: Option<ByteArray>,
  /// Verification date
  verified_at: Int,
}

/// Preservation grant — funds ecosystem maintenance/restoration
pub type PreservationGrant {
  /// Unique grant ID
  grant_id: ByteArray,
  /// Bioregion funding this grant
  bioregion: ByteArray,
  /// Grant type
  grant_type: GrantType,
  /// Recipient pNFT (land steward)
  recipient: AssetName,
  /// Location covered by grant
  location_hash: ByteArray,
  /// Area size (in standard units)
  area_size: Int,
  /// Grant amount (tokens)
  amount: Int,
  /// Grant period (cycles)
  duration_cycles: Int,
  /// Start cycle
  start_cycle: Int,
  /// Required survey frequency (cycles between surveys)
  survey_frequency: Int,
  /// Baseline survey ID
  baseline_survey: ByteArray,
  /// Required ecosystem health targets
  health_targets: List<HealthTarget>,
  /// Current status
  status: GrantStatus,
  /// Payments made
  payments: List<GrantPayment>,
}

/// Types of preservation grants
pub type GrantType {
  /// Maintain existing healthy ecosystem
  Maintenance
  /// Restore degraded ecosystem
  Restoration
  /// Protect critical habitat
  HabitatProtection
  /// Support traditional land management
  TraditionalManagement
  /// Rewild previously developed land
  Rewilding
  /// Corridor creation (connecting habitats)
  CorridorCreation
}

/// Health target for grant compliance
pub type HealthTarget {
  /// Impact category being targeted
  category: ImpactCategory,
  /// Metric code
  metric_code: ByteArray,
  /// Minimum required value
  minimum_value: Int,
  /// Target value (for bonuses)
  target_value: Int,
  /// Maximum allowed (for caps)
  maximum_value: Option<Int>,
}

/// Grant lifecycle status
pub type GrantStatus {
  /// Application submitted
  Applied
  /// Approved, pending baseline survey
  Approved
  /// Active, payments ongoing
  Active
  /// Completed successfully
  Completed
  /// Terminated (failed to meet targets)
  Terminated
  /// Suspended (pending dispute resolution)
  Suspended
}

/// Individual grant payment
pub type GrantPayment {
  /// Cycle paid for
  cycle: Int,
  /// Amount paid
  amount: Int,
  /// Survey that verified this period
  verification_survey: ByteArray,
  /// Did recipient meet targets?
  targets_met: Bool,
  /// Bonus/penalty applied
  adjustment: Int,
  /// Payment slot
  paid_at: Int,
}

/// Ecosystem health record for a location
pub type EcosystemHealthRecord {
  /// Location hash
  location_hash: ByteArray,
  /// Bioregion
  bioregion: ByteArray,
  /// Current health scores by category
  health_scores: List<(ImpactCategory, Int)>,
  /// Overall health index (0-10000)
  overall_health: Int,
  /// Trend (improving, stable, declining)
  trend: HealthTrend,
  /// Last survey date
  last_surveyed: Int,
  /// Survey count (more surveys = more confidence)
  survey_count: Int,
  /// Land steward (if any)
  steward: Option<AssetName>,
  /// Active grants (if any)
  active_grants: List<ByteArray>,
}

/// Ecosystem health trend
pub type HealthTrend {
  /// Getting better
  Improving
  /// Staying same
  Stable
  /// Getting worse
  Declining
  /// Not enough data
  Unknown
}

// =============================================================================
// UBI — UNIVERSAL BASIC INCOME
// =============================================================================

/// UBI pool datum
pub type UbiPoolDatum {
  /// Bioregion
  bioregion: ByteArray,
  /// Current cycle
  cycle: Int,
  /// Tokens available for distribution
  available: Int,
  /// Claims made this cycle
  claims_count: Int,
  /// Distribution start slot
  distribution_start: Int,
}

/// UBI claim record
pub type UbiClaimDatum {
  /// Claimant pNFT
  pnft: AssetName,
  /// Cycle claimed
  cycle: Int,
  /// Amount received
  amount: Int,
  /// Claim slot
  claimed_at: Int,
  /// Claimant's impact score (affects amount)
  impact_score: Int,
  /// Claimant's participation score
  participation_score: Int,
}

// =============================================================================
// GOVERNANCE
// =============================================================================

/// Proposal types
pub type ProposalType {
  /// Budget allocation
  Budget { amount: Int, recipient: ByteArray }
  /// Policy change
  Policy { policy_hash: ByteArray }
  /// Emergency action (faster voting)
  Emergency { action_hash: ByteArray }
  /// Constitutional amendment (supermajority)
  Constitutional { amendment_hash: ByteArray }
  /// Pool registration/deregistration
  PoolAction { pool_id: ByteArray, action: PoolActionType }
  /// Impact standard change
  ImpactStandard { category: ImpactCategory, new_standard: ByteArray }
}

/// Pool governance actions
pub type PoolActionType {
  /// Register new pool
  Register
  /// Deregister pool (remove from bioregion)
  Deregister
  /// Update pool parameters
  UpdateParams
  /// Endorse pool (from Stewards)
  Endorse
}

/// Proposal datum
pub type ProposalDatum {
  /// Unique proposal ID
  proposal_id: ByteArray,
  /// Proposer pNFT
  proposer: AssetName,
  /// Bioregion
  bioregion: ByteArray,
  /// Proposal type
  proposal_type: ProposalType,
  /// Content hash (full proposal on IPFS)
  content_hash: ByteArray,
  /// Voting start slot
  voting_start: Int,
  /// Voting end slot
  voting_end: Int,
  /// Votes in favor (weighted)
  votes_for: Int,
  /// Votes against (weighted)
  votes_against: Int,
  /// Current status
  status: ProposalStatus,
  /// Stake locked by proposer
  stake_locked: Int,
}

/// Proposal lifecycle
pub type ProposalStatus {
  Active
  Passed
  Failed
  Executed
  Expired
}

/// Vote record
pub type VoteDatum {
  /// Proposal being voted on
  proposal_id: ByteArray,
  /// Voter pNFT
  voter: AssetName,
  /// Vote direction
  vote_for: Bool,
  /// Vote weight (from verification level + stake)
  weight: Int,
  /// Vote slot
  voted_at: Int,
}

// =============================================================================
// MEMORY — COLLECTIVE INTERPRETATION
// =============================================================================

/// Interpretation datum
pub type InterpretationDatum {
  /// What is being interpreted
  substrate_ref: ByteArray,
  /// Who is interpreting
  interpreter: InterpreterType,
  /// Interpreter identifier
  interpreter_id: ByteArray,
  /// Content hash
  content_hash: ByteArray,
  /// Creation slot
  created_at: Int,
  /// Resonance score
  resonance: Int,
  /// Vitality
  vitality: Int,
  /// Cycle created
  cycle: Int,
}

/// Types of interpreters
pub type InterpreterType {
  Individual
  Community
  Collective
}

// =============================================================================
// RECORDS DATUM UNION
// =============================================================================

/// Datum variants for records contract
pub type RecordsDatum {
  Record(TransactionRecord)
  AvatarStats(AvatarCycleStats)
  BioregionStats(BioregionCycleStats)
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/// Get voting weight from verification level
pub fn voting_weight(level: VerificationLevel) -> Int {
  when level is {
    Basic -> 0
    Standard -> 1
    Verified -> 2
    Steward -> 3
  }
}

/// Check if level can transact
pub fn can_transact(level: VerificationLevel) -> Bool {
  level != Basic
}

/// Check if level can propose
pub fn can_propose(level: VerificationLevel) -> Bool {
  when level is {
    Basic -> False
    Standard -> False
    Verified -> True
    Steward -> True
  }
}

/// Check if level can operate a pool
pub fn can_operate_pool(level: VerificationLevel) -> Bool {
  when level is {
    Basic -> False
    Standard -> False
    Verified -> True
    Steward -> True
  }
}

/// Check if level can endorse pools
pub fn can_endorse_pool(level: VerificationLevel) -> Bool {
  level == Steward
}

/// Get transaction type code
pub fn tx_type_code(tx_type: TransactionType) -> Int {
  when tx_type is {
    Labor { .. } -> 1
    Goods { .. } -> 2
    Services { .. } -> 3
    Gift -> 4
    Investment { .. } -> 5
    Remediation { .. } -> 6
    UBI { .. } -> 7
    GovernanceReward { .. } -> 8
    Internal -> 9
    StakeReward { .. } -> 10
    ImpactTrade { .. } -> 11
  }
}

/// Get impact category code
pub fn impact_category_code(category: ImpactCategory) -> ByteArray {
  when category is {
    Carbon -> #"0500"
    Water -> #"0510"
    Biodiversity -> #"0520"
    Soil -> #"0530"
    Air -> #"0540"
    Waste -> #"0550"
    Energy -> #"0560"
    LandUse -> #"0570"
  }
}

/// Calculate net impact from list of impacts
/// Weighted by confidence
pub fn calculate_net_impact(impacts: List<Impact>) -> Int {
  list.foldl(impacts, 0, fn(impact, acc) {
    let weighted = impact.magnitude * impact.confidence / 100
    acc + weighted
  })
}

/// Check if impacts require remediation (net negative)
pub fn requires_remediation(impacts: List<Impact>) -> Bool {
  calculate_net_impact(impacts) < 0
}

/// Calculate required remediation amount
pub fn remediation_required(impacts: List<Impact>) -> Int {
  let net = calculate_net_impact(impacts)
  if net < 0 { -net } else { 0 }
}

/// Check if impacts list is valid (non-empty, all valid)
pub fn valid_impacts(impacts: List<Impact>) -> Bool {
  // Must have at least one impact
  let non_empty = list.length(impacts) > 0
  
  // All impacts must be valid
  let all_valid = list.all(impacts, fn(impact) {
    impact.compound_code != "" &&
    impact.unit != "" &&
    impact.confidence >= 0 &&
    impact.confidence <= 100
  })
  
  non_empty && all_valid
}

/// Calculate stake-weighted voting power
pub fn stake_voting_power(level: VerificationLevel, staked: Int) -> Int {
  let base = voting_weight(level)
  // Every 1000 tokens staked adds 1 vote weight
  let stake_bonus = staked / 1000
  base + stake_bonus
}

// Import list for foldl, all, length
use aiken/collection/list
