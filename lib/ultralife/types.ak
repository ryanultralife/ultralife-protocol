// =============================================================================
// UltraLife Protocol — Shared Types
// =============================================================================
//
// Core type definitions used across all contracts.
// These types define the data structures that make the transparent economy work.
//
// =============================================================================

use aiken/crypto.{VerificationKeyHash, Blake2b_256, Hash}
use cardano/assets.{PolicyId, AssetName}

// =============================================================================
// IDENTITY TYPES
// =============================================================================

/// Verification levels for pNFTs
/// Each level unlocks more capabilities and carries more weight
pub type VerificationLevel {
  /// Wallet signature only. Can create pNFT, view data. Cannot transact tokens.
  Basic
  /// Ward pNFT - guardian-linked. For children, elderly, infirm, incapacitated.
  /// Transactions require guardian co-signature.
  Ward
  /// DNA verified. Can transact, claim grants, vote. Required for economy.
  Standard
  /// Standard + bioregion residency proof. Can propose, higher voting weight.
  Verified
  /// Verified + community endorsement. Can participate in multi-sig, emergency gov.
  Steward
}

/// pNFT Datum — stored with each personal NFT
pub type PnftDatum {
  /// Unique identifier (derived from DNA hash, or guardian attestation for wards)
  pnft_id: ByteArray,
  /// Owner's verification key hash
  owner: VerificationKeyHash,
  /// Current verification level
  level: VerificationLevel,
  /// Assigned bioregion (None for Basic)
  bioregion: Option<ByteArray>,
  /// DNA verification hash (None for Basic and Ward)
  dna_hash: Option<ByteArray>,
  /// Guardian pNFT (only for Ward level, None otherwise)
  guardian: Option<AssetName>,
  /// Ward start slot (when guardianship began)
  ward_since: Option<Int>,
  /// Creation slot
  created_at: Int,
  /// Last level upgrade slot
  upgraded_at: Option<Int>,
  /// Consumer's lifetime compound balances (from consumption decisions)
  /// Positive = released to environment, Negative = sequestered
  consumer_impact: Option<ConsumerImpactRecord>,
  /// Optional DNA-derived nutritional profile (privacy-protected, ZK-compatible)
  /// Used for matching food that optimizes health, not processed garbage
  nutrition_profile: Option<NutritionProfile>,
}

/// DNA-derived nutritional profile for optimal food matching
/// This is optional, privacy-protected, and used only for the holder's benefit
pub type NutritionProfile {
  /// Genetic markers hash (ZK-provable without revealing data)
  markers_hash: ByteArray,
  /// Nutrient processing characteristics
  processing: List<NutrientProcessing>,
  /// Known sensitivities/intolerances
  sensitivities: List<FoodSensitivity>,
  /// Deficiency risks based on genetic markers
  deficiency_risks: List<ByteArray>,
  /// Last update slot
  updated_at: Int,
}

/// How efficiently this person processes specific nutrients
pub type NutrientProcessing {
  nutrient: ByteArray,           // e.g., "iron", "vitamin_d", "folate"
  efficiency: ProcessingLevel,
}

pub type ProcessingLevel {
  Normal
  Reduced          // Needs more of this nutrient
  Enhanced         // Processes efficiently, needs less
  Impaired         // Significant absorption issues
}

/// Food sensitivities that affect what survival food should match
pub type FoodSensitivity {
  category: SensitivityCategory,
  severity: SensitivityLevel,
}

pub type SensitivityCategory {
  Gluten
  Lactose
  Histamine
  Nightshades
  Lectins
  Oxalates
  FODMAP
  SeedOils          // Inflammatory response to industrial oils
  RefinedSugars     // Insulin sensitivity issues
  Other { code: ByteArray }
}

pub type SensitivityLevel {
  Mild              // Preference to avoid
  Moderate          // Should avoid for optimal health
  Severe            // Must avoid, causes harm
}

/// Consumer's accumulated impact from their consumption decisions
/// The consumer accrues impact because their demand drives the supply chain
pub type ConsumerImpactRecord {
  /// Lifetime compound balances by compound code
  lifetime_compounds: List<CompoundBalance>,
  /// Compounds already remediated
  remediated_compounds: List<CompoundBalance>,
  /// Currently unremediated (lifetime - remediated)
  unremediated_compounds: List<CompoundBalance>,
  /// Last update cycle
  last_updated: Int,
}

/// Balance of a specific compound
pub type CompoundBalance {
  compound: CompoundCode,
  quantity: Int,
  unit: MassUnit,
}

// =============================================================================
// GEOGRAPHIC TYPES
// =============================================================================

/// Bioregion Datum — stored at bioregion beacon
pub type BioregionDatum {
  /// Unique bioregion identifier
  bioregion_id: ByteArray,
  /// Human-readable name hash
  name_hash: ByteArray,
  /// Geographic bounds hash (GeoJSON on IPFS)
  bounds_hash: ByteArray,
  /// Current health index (0-10000 = 0-100.00%)
  health_index: Int,
  /// Number of registered residents
  resident_count: Int,
  /// Bioregion treasury address
  treasury: ByteArray,
  /// Creation slot
  created_at: Int,
  /// Last health update cycle
  last_health_update: Int,
}

// =============================================================================
// TRANSACTION TYPES — ALL ECONOMIC SECTORS
// =============================================================================

/// Types of economic transactions covering all sectors
/// Primary (extraction), Secondary (manufacturing), Tertiary (services),
/// Quaternary (knowledge), Quinary (care)
pub type TransactionType {
  // === PRIMARY SECTOR (Extraction) ===
  /// Payment for labor/work
  Labor { 
    /// Work code from registry (0x02xx)
    work_code: ByteArray,
    /// Hours worked (optional)
    hours: Option<Int>,
  }
  /// Agricultural products
  Agriculture {
    product_type: AgriculturalProduct,
    quantity: Int,
    unit_code: ByteArray,
  }
  /// Harvested resources
  Harvest {
    resource_type: HarvestResource,
    quantity: Int,
    unit_code: ByteArray,
  }
  
  // === SECONDARY SECTOR (Manufacturing) ===
  /// Payment for physical goods
  Goods { 
    /// Product code from registry (0x03xx)
    product_code: ByteArray,
    /// Quantity
    quantity: Int,
    /// Unit code from registry (0x06xx)
    unit_code: ByteArray,
  }
  /// Manufactured items
  Manufactured {
    item_code: ByteArray,
    quantity: Int,
    /// Production batch for traceability
    batch_id: Option<ByteArray>,
  }
  /// Construction payment
  Construction {
    phase: ByteArray,
    asset_id: AssetName,
  }
  /// Energy purchase
  Energy {
    energy_type: EnergyType,
    quantity_kwh: Int,
  }
  
  // === TERTIARY SECTOR (Services) ===
  /// Payment for services
  Services { 
    /// Service code from registry (0x04xx)
    service_code: ByteArray,
  }
  /// Healthcare payment
  Healthcare {
    service_type: ByteArray,
    /// Encrypted reference (privacy)
    reference_hash: ByteArray,
  }
  /// Education payment
  Education {
    program_type: ByteArray,
    provider: AssetName,
  }
  /// Transportation payment
  Transport {
    mode: ByteArray,
    distance: Option<Int>,
  }
  /// Hospitality (lodging, food service)
  Hospitality {
    service_type: ByteArray,
  }
  /// Rental/lease payment
  Rental {
    asset_id: AssetName,
    period: Int,
  }
  /// Insurance premium
  Insurance {
    pool_id: ByteArray,
    coverage_type: ByteArray,
  }
  
  // === QUATERNARY SECTOR (Knowledge) ===
  /// Research/consulting payment
  Research {
    field: ByteArray,
    deliverable_hash: ByteArray,
  }
  /// Data/information purchase
  Data {
    data_type: ByteArray,
    access_type: ByteArray,
  }
  /// Intellectual property license
  License {
    ip_id: ByteArray,
    terms_hash: ByteArray,
  }
  
  // === QUINARY SECTOR (Care) ===
  /// Care work payment/recognition
  Care {
    care_type: ByteArray,
    hours: Int,
  }
  /// Community service recognition
  CommunityService {
    service_type: ByteArray,
  }
  
  // === FINANCIAL ===
  /// Gift or donation
  Gift
  /// Investment or loan disbursement
  Investment { 
    /// Terms hash (IPFS)
    terms_hash: ByteArray,
  }
  /// Loan repayment
  LoanRepayment {
    loan_id: ByteArray,
    principal: Int,
    interest: Int,
  }
  /// Remediation payment
  Remediation { 
    /// Bond identifier
    bond_id: ByteArray,
  }
  /// UBI distribution (system only)
  UBI { 
    /// Distribution cycle
    cycle: Int,
  }
  /// Governance reward
  GovernanceReward {
    /// Proposal that triggered reward
    proposal_id: ByteArray,
  }
  /// Internal reorganization (same owner)
  Internal
  /// Stake pool reward distribution
  StakeReward {
    pool_id: ByteArray,
    epoch: Int,
  }
  /// Impact token trade
  ImpactTrade {
    impact_token_id: ByteArray,
    quantity: Int,
  }
}

// =============================================================================
// ECONOMIC SECTOR SUPPORTING TYPES
// =============================================================================

/// Agricultural product types
pub type AgriculturalProduct {
  Crop { crop_type: ByteArray }
  Livestock { animal_type: ByteArray, product: ByteArray }
  Dairy { product_type: ByteArray }
  Eggs
  Honey
  Fiber { fiber_type: ByteArray }
}

/// Harvested resources
pub type HarvestResource {
  Timber { species: ByteArray, grade: ByteArray }
  Fish { species: ByteArray, method: ByteArray }
  Shellfish { species: ByteArray }
  Foraged { item_type: ByteArray }
  Water { source_type: ByteArray }
  Minerals { mineral_type: ByteArray }
  Aggregates { material: ByteArray }
}

/// Energy types
pub type EnergyType {
  Solar
  Wind
  Hydro
  Geothermal
  Biomass
  Grid { mix_hash: ByteArray }
}

// =============================================================================
// COMPOUND-BASED IMPACT SYSTEM
// =============================================================================
// Impacts are actual chemical compounds, not abstract categories.
// Every activity produces/consumes real molecules: CO₂, H₂O, NOₓ, etc.
// Consumer accrues impact because their demand drives the chain.
// =============================================================================

/// Compound codes — actual chemical formulas
/// First byte: element group, remaining bytes: specific compound
pub type CompoundCode = ByteArray

// Compound code constants:
// Carbon (0x01xx): CO2=0101, CH4=0102, CO=0103, Cellulose=0105
// Nitrogen (0x02xx): NO=0202, NO2=0203, N2O=0204, NH3=0205
// Sulfur (0x03xx): SO2=0301, H2S=0303
// Water/O2 (0x04xx): H2O=0401, O2=0402, O3=0403
// Phosphorus (0x05xx): PO4=0501
// Particulates (0x06xx): PM10=0601, PM25=0602, BlackCarbon=0603
// Metals (0x07xx): Pb=0703, Hg=0704, Cd=0705

/// Unit of measurement for compounds
pub type MassUnit {
  Grams
  Kilograms
  Liters
  Moles
}

/// How the compound flow was measured
pub type MeasurementMethod {
  /// Direct sensor/lab measurement
  Direct { instrument: ByteArray }
  /// Calculated from activity data
  Calculated { formula: ByteArray }
  /// Estimated from reference data
  Estimated { reference: ByteArray, similarity: Int }
  /// Surveyed by certified pNFT
  Surveyed { surveyor: AssetName }
}

/// A single compound flow — actual chemistry
pub type CompoundFlow {
  /// Which compound (chemical formula code)
  compound: CompoundCode,
  /// SIGNED quantity: + = produced/released, - = consumed/sequestered
  quantity: Int,
  /// Unit of measurement
  unit: MassUnit,
  /// How was this measured
  measurement: MeasurementMethod,
  /// Confidence in measurement (0-100)
  confidence: Int,
}

/// Complete impact for an activity — multiple compound flows
pub type ActivityImpact {
  /// All compounds that flowed (REQUIRED: at least one)
  compound_flows: List<CompoundFlow>,
  /// Evidence hash (IPFS)
  evidence_hash: ByteArray,
  /// pNFTs who attested to this measurement
  attestors: List<AssetName>,
}

/// Legacy Impact classification (for backward compatibility)
/// DEPRECATED: Use ActivityImpact with CompoundFlow instead
pub type ImpactClass {
  /// Net positive environmental impact
  Positive { 
    /// Impact code from registry (0x05xx)
    impact_code: ByteArray,
    /// Magnitude (1-1000)
    magnitude: Int,
    /// Unit code from registry (0x06xx)
    unit_code: Option<ByteArray>,
  }
  /// NOTE: Neutral REMOVED — no physical activity is neutral
  /// Every activity produces or consumes compounds
  
  /// Net negative (requires remediation commitment)
  Negative { 
    /// Impact code from registry (0x05xx)
    impact_code: ByteArray,
    /// Magnitude (1-1000)
    magnitude: Int,
    /// Unit code from registry (0x06xx)
    unit_code: Option<ByteArray>,
    /// How remediation will occur
    remediation: RemediationType,
  }
}

/// Legacy impact categories (for backwards compatibility)
/// DEPRECATED: Use CompoundCode instead
pub type ImpactCategory {
  CarbonImpact       // 0x0500
  WaterImpact        // 0x0510
  BiodiversityImpact // 0x0520
  SoilImpact         // 0x0530
  AirImpact          // 0x0540
  WasteImpact        // 0x0550
  EnergyImpact       // 0x0560
  LandUseImpact      // 0x0570
  MultipleImpact     // Multiple codes
}

/// How negative impact will be remediated
pub type RemediationType {
  /// Immediate in this transaction
  Immediate { output_index: Int }
  /// Bond posted, remediation later
  Bonded { bond_id: ByteArray, deadline: Int }
  /// Offset via impact token
  Offset { amount: Int }
}

/// Transaction metadata — required on every token transfer
pub type TransactionMeta {
  /// Type of transaction
  tx_type: TransactionType,
  /// Compound-based impact (REQUIRED: at least one flow)
  activity_impact: ActivityImpact,
  /// Legacy impact (deprecated, for backward compatibility)
  legacy_impact: Option<ImpactClass>,
  /// Optional description hash
  description: Option<ByteArray>,
}

/// Who accrues the impact (the consumer whose demand drove this)
pub type ImpactAccrual {
  /// The end consumer who accrues these compounds
  consumer_pnft: AssetName,
  /// Compounds transferred to consumer
  compounds: List<CompoundFlow>,
  /// From which asset/product
  source_asset: Option<AssetName>,
}

// =============================================================================
// RECORD TYPES
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
  /// Amount transferred
  amount: Int,
  /// Transaction type code
  tx_type_code: Int,
  /// Compound flows from this activity
  compound_flows: List<CompoundFlow>,
  /// Who accrues the impact (consumer whose demand drove this)
  impact_accrued_to: AssetName,
  /// Slot
  slot: Int,
  /// Cycle number
  cycle: Int,
}

/// Aggregated avatar data per cycle
pub type AvatarCycleStats {
  /// pNFT identifier
  pnft: AssetName,
  /// Bioregion identifier
  bioregion: ByteArray,
  /// Cycle number
  cycle: Int,
  /// Transactions sent
  tx_sent: Int,
  /// Volume sent
  volume_sent: Int,
  /// Transactions received
  tx_received: Int,
  /// Volume received
  volume_received: Int,
  /// Unique counterparties transacted with
  unique_counterparties: Int,
  /// Net impact score
  net_impact: Int,
  /// Labor transaction count
  labor_count: Int,
  /// Remediation count
  remediation_count: Int,
}

/// Aggregated bioregion data per cycle
pub type BioregionCycleStats {
  /// Bioregion identifier
  bioregion: ByteArray,
  /// Cycle number
  cycle: Int,
  /// Total internal volume
  internal_volume: Int,
  /// Total export volume
  export_volume: Int,
  /// Total import volume
  import_volume: Int,
  /// Total transaction volume (all types)
  total_volume: Int,
  /// Unique participants this cycle
  unique_participants: Int,
  /// Labor transactions completed
  labor_transactions: Int,
  /// Net impact
  net_impact: Int,
  /// Active avatars
  active_count: Int,
}

// =============================================================================
// GOVERNANCE TYPES
// =============================================================================

/// Proposal types
pub type ProposalType {
  /// Budget allocation
  Budget { amount: Int, recipient: ByteArray }
  /// Policy change
  Policy { policy_hash: ByteArray }
  /// Emergency action
  Emergency { action_hash: ByteArray }
  /// Constitutional amendment
  Constitutional { amendment_hash: ByteArray }
}

/// Proposal status
pub type ProposalStatus {
  Active
  Passed
  Failed
  Executed
  Expired
}

/// Proposal datum
pub type ProposalDatum {
  /// Unique proposal ID
  proposal_id: ByteArray,
  /// Proposer pNFT
  proposer: AssetName,
  /// Bioregion scope
  bioregion: ByteArray,
  /// Proposal type
  proposal_type: ProposalType,
  /// Content hash (IPFS)
  content_hash: ByteArray,
  /// Voting start slot
  voting_start: Int,
  /// Voting end slot
  voting_end: Int,
  /// Votes for (weighted)
  votes_for: Int,
  /// Votes against (weighted)
  votes_against: Int,
  /// Status
  status: ProposalStatus,
}

/// Vote record
pub type VoteDatum {
  /// Proposal being voted on
  proposal_id: ByteArray,
  /// Voter pNFT
  voter: AssetName,
  /// Vote direction
  vote_for: Bool,
  /// Voting weight (from verification level)
  weight: Int,
  /// Vote slot
  slot: Int,
}

// =============================================================================
// TREASURY TYPES
// =============================================================================

/// Treasury state datum
pub type TreasuryDatum {
  /// Tokens distributed so far
  tokens_distributed: Int,
  /// ADA reserves (lovelace)
  ada_reserves: Int,
  /// BTC reserves (satoshis, wrapped)
  btc_reserves: Int,
  /// Last price update slot
  last_update: Int,
  /// Multi-sig configuration
  multisig: MultisigConfig,
}

/// Multi-sig configuration
pub type MultisigConfig {
  /// Required signers
  signers: List<VerificationKeyHash>,
  /// Threshold
  threshold: Int,
}

// =============================================================================
// ASSET IMPACT ACCUMULATION
// =============================================================================
// Assets (Land NFTs, Products) accumulate compound flows through their lifecycle.
// When a consumer purchases, ALL accumulated compounds transfer to their pNFT.
// This is how consumer demand drives accountability.
// =============================================================================

/// Record of an activity that affected an asset
pub type AssetActivityRecord {
  /// Activity type (construction, manufacturing, transport, etc.)
  activity_type: ByteArray,
  /// Worker who performed (for reputation, not impact sink)
  worker_pnft: AssetName,
  /// Compound flows from this activity
  compound_flows: List<CompoundFlow>,
  /// Evidence hash
  evidence: ByteArray,
  /// When this occurred
  timestamp: Int,
}

/// Accumulated impact on an asset through its lifecycle
pub type AssetImpactHistory {
  /// The asset this is attached to
  asset_id: AssetName,
  /// All activities that affected this asset
  activities: List<AssetActivityRecord>,
  /// Summed compound totals (ready to transfer to consumer)
  accumulated_totals: List<CompoundBalance>,
  /// Whether this asset has been purchased (impacts transferred)
  transferred_to_consumer: Bool,
  /// If transferred, which consumer pNFT
  consumer: Option<AssetName>,
}

/// When consumer purchases, this record is created
pub type ImpactTransferRecord {
  /// Source asset
  asset_id: AssetName,
  /// Consumer who purchased (accrues the impact)
  consumer_pnft: AssetName,
  /// All compounds transferred
  compounds: List<CompoundBalance>,
  /// Purchase transaction reference
  purchase_tx: ByteArray,
  /// Timestamp
  timestamp: Int,
}

/// Worker's efficiency record (reputation, not impact sink)
/// Workers are conduits — impact flows through to consumer
pub type WorkerEfficiencyRecord {
  pnft: AssetName,
  /// Efficiency by compound (1000 = average, <1000 = better)
  efficiency_ratings: List<EfficiencyRating>,
  /// Total activities performed
  activities_count: Int,
  /// Skills and certifications
  certifications: List<ByteArray>,
}

/// Efficiency rating for a specific compound
pub type EfficiencyRating {
  compound: CompoundCode,
  /// Rating: 1000 = average, 920 = 8% better than average
  rating: Int,
  /// How many samples this is based on
  sample_size: Int,
}

// =============================================================================
// UBI TYPES
// =============================================================================

/// UBI distribution pool datum
pub type UbiPoolDatum {
  /// Bioregion this pool serves
  bioregion: ByteArray,
  /// Current cycle (epoch)
  cycle: Int,
  /// Total fees collected this epoch (before UBI split)
  fees_collected: Int,
  /// UBI pool for this epoch (fees_collected * UBI_FEE_SHARE / 10000)
  ubi_pool: Int,
  /// Eligible claimants in bioregion (from previous cycle stats)
  eligible_count: Int,
  /// Total engagement weight (sum of all engagement multipliers)
  total_engagement_weight: Int,
  /// Claims processed this cycle
  claims_count: Int,
  /// Tokens distributed this cycle
  distributed: Int,
  /// Distribution start slot
  distribution_start: Int,
}

/// Individual UBI claim record
pub type UbiClaimDatum {
  /// Claimant pNFT
  pnft: AssetName,
  /// Cycle claimed
  cycle: Int,
  /// Base share before engagement
  base_share: Int,
  /// Engagement multiplier (in basis points)
  engagement_mult: Int,
  /// Final amount received
  amount: Int,
  /// Claim slot
  slot: Int,
}

/// Epoch fee summary (created at epoch end, used for UBI calculation)
pub type EpochFeeSummary {
  /// Epoch/cycle number
  cycle: Int,
  /// Total transaction fees collected
  total_fees: Int,
  /// UBI allocation (dynamic % of fees)
  ubi_allocation: Int,
  /// Validator allocation (30% of fees)
  validator_allocation: Int,
  /// Treasury allocation (remainder)
  treasury_allocation: Int,
  /// Current UBI fee share (basis points)
  ubi_fee_share_bps: Int,
  /// Transaction count
  tx_count: Int,
  /// Finalized slot
  finalized_at: Int,
}

/// Period statistics for monthly UBI fee adjustment
pub type UbiPeriodStats {
  /// Period number (increments every ~6 epochs / ~1 month)
  period: Int,
  /// Total UBI distributed over period
  total_distributed: Int,
  /// Total unique claimants over period
  total_claimants: Int,
  /// Average UBI per claimant
  avg_ubi_per_person: Int,
  /// Total fees collected over period
  total_fees: Int,
  /// Current UBI fee share (basis points, 3000-7000)
  current_fee_share_bps: Int,
  /// Next period's fee share (after adjustment)
  next_fee_share_bps: Int,
  /// Epochs counted in this period
  epochs_counted: Int,
  /// Period start slot
  start_slot: Int,
  /// Period end slot
  end_slot: Int,
}

// =============================================================================
// MEMORY TYPES
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
  /// Resonance score (upvotes from other interpreters)
  resonance: Int,
  /// Vitality (decreases over time without resonance)
  vitality: Int,
  /// Cycle created
  cycle: Int,
}

/// Types of interpreters
pub type InterpreterType {
  /// Individual pNFT holder
  Individual
  /// Community consensus
  Community
  /// Cross-community emergence
  Collective
}

// =============================================================================
// RECORDS TYPES
// =============================================================================

/// Datum variants for records contract
pub type RecordsDatum {
  /// Individual transaction record
  Record(TransactionRecord)
  /// Avatar stats aggregation
  AvatarStats(AvatarCycleStats)
  /// Bioregion stats aggregation  
  BioregionStats(BioregionCycleStats)
}

// =============================================================================
// IMPACT TOKEN TYPES (Compound-Based)
// =============================================================================

/// Impact token datum — represents actual compound flows
pub type ImpactDatum {
  /// Bioregion where impact occurred
  bioregion: ByteArray,
  /// Primary compound this token represents
  compound: CompoundCode,
  /// Quantity (positive = released, negative = sequestered)
  quantity: Int,
  /// Unit of measurement
  unit: MassUnit,
  /// Measurement method and confidence
  measurement: MeasurementMethod,
  confidence: Int,
  /// Evidence hash (IPFS)
  evidence_hash: ByteArray,
  /// Who issued/verified this impact (pNFT)
  issuer: AssetName,
  /// Current owner (for trading)
  owner: AssetName,
  /// Attestations from other Verified+ users
  attestations: List<AssetName>,
  /// Status: Unremediated, InProgress, Remediated
  remediation_status: RemediationStatus,
  /// If remediated, link to remediation record
  remediation_record: Option<ByteArray>,
  /// Creation slot
  created_at: Int,
  /// Optional expiration
  expires: Option<Int>,
}

/// Impact token status
pub type RemediationStatus {
  /// Not yet offset
  Unremediated
  /// Offset in progress
  InProgress { provider: AssetName, expected_completion: Int }
  /// Fully offset
  Remediated { provider: AssetName, completion_time: Int }
  /// Retired (cancelled against opposite impact)
  Retired { offset_token: ByteArray, retirement_time: Int }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/// Convert verification level to voting weight
pub fn voting_weight(level: VerificationLevel) -> Int {
  when level is {
    Basic -> 0
    Ward -> 0
    Standard -> 1
    Verified -> 2
    Steward -> 3
  }
}

/// Check if level allows token transactions
pub fn can_transact(level: VerificationLevel) -> Bool {
  level != Basic
}

/// Check if level allows governance proposals
pub fn can_propose(level: VerificationLevel) -> Bool {
  when level is {
    Verified -> True
    Steward -> True
    _ -> False
  }
}

/// Encode transaction type to integer
pub fn tx_type_code(tx_type: TransactionType) -> Int {
  when tx_type is {
    Labor { work_code, hours } -> 1
    Goods { product_code, quantity, unit_code } -> 2
    Services { service_code } -> 3
    Gift -> 4
    Investment { terms_hash } -> 5
    Remediation { bond_id } -> 6
    UBI { cycle } -> 7
    GovernanceReward { proposal_id } -> 8
    Internal -> 9
    _ -> 10
  }
}

/// DEPRECATED: Use net_compound_impact instead
/// Encode legacy impact to sign
pub fn impact_sign(impact: ImpactClass) -> Int {
  when impact is {
    Positive { .. } -> 1
    Negative { .. } -> -1
  }
}

/// DEPRECATED: Use total_compound_magnitude instead
/// Get legacy impact magnitude
pub fn impact_magnitude(impact: ImpactClass) -> Int {
  when impact is {
    Positive { magnitude, .. } -> magnitude
    Negative { magnitude, .. } -> magnitude
  }
}

// =============================================================================
// COMPOUND-BASED IMPACT FUNCTIONS
// =============================================================================

/// Calculate net impact across all compound flows
/// Positive = net release to environment, Negative = net sequestration
pub fn net_compound_impact(flows: List<CompoundFlow>) -> Int {
  list_fold(flows, 0, fn(flow, acc) { acc + flow.quantity })
}

/// Calculate total magnitude (absolute value of all flows)
pub fn total_compound_magnitude(flows: List<CompoundFlow>) -> Int {
  list_fold(flows, 0, fn(flow, acc) { acc + abs(flow.quantity) })
}

/// Validate that activity has at least one compound flow
/// (No "neutral" — every activity has physical consequence)
pub fn has_valid_impact(impact: ActivityImpact) -> Bool {
  list_length(impact.compound_flows) >= 1
}

/// Sum compound flows by compound code
pub fn sum_by_compound(flows: List<CompoundFlow>) -> List<CompoundBalance> {
  // Group and sum (simplified — real impl needs grouping logic)
  list_map(flows, fn(f) {
    CompoundBalance {
      compound: f.compound,
      quantity: f.quantity,
      unit: f.unit,
    }
  })
}

/// Add compound balances to consumer record
pub fn accrue_to_consumer(
  record: ConsumerImpactRecord,
  new_compounds: List<CompoundBalance>,
  cycle: Int,
) -> ConsumerImpactRecord {
  // Add new compounds to lifetime and unremediated
  ConsumerImpactRecord {
    lifetime_compounds: merge_compound_lists(record.lifetime_compounds, new_compounds),
    remediated_compounds: record.remediated_compounds,
    unremediated_compounds: merge_compound_lists(record.unremediated_compounds, new_compounds),
    last_updated: cycle,
  }
}

/// Merge two compound balance lists (sum quantities for same compound)
fn merge_compound_lists(
  a: List<CompoundBalance>,
  b: List<CompoundBalance>,
) -> List<CompoundBalance> {
  // Simplified: just concatenate (real impl would sum same compounds)
  list_concat(a, b)
}

// Helper functions (Aiken doesn't have these built-in)
fn list_fold(items: List<a>, initial: b, f: fn(a, b) -> b) -> b {
  when items is {
    [] -> initial
    [head, ..tail] -> list_fold(tail, f(head, initial), f)
  }
}

fn list_map(items: List<a>, f: fn(a) -> b) -> List<b> {
  when items is {
    [] -> []
    [head, ..tail] -> [f(head), ..list_map(tail, f)]
  }
}

fn list_length(items: List<a>) -> Int {
  when items is {
    [] -> 0
    [_, ..tail] -> 1 + list_length(tail)
  }
}

fn list_concat(a: List<t>, b: List<t>) -> List<t> {
  when a is {
    [] -> b
    [head, ..tail] -> [head, ..list_concat(tail, b)]
  }
}

fn abs(x: Int) -> Int {
  if x < 0 { -x } else { x }
}
