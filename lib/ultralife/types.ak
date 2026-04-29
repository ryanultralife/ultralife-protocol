// =============================================================================
// UltraLife Protocol — Shared Types
// =============================================================================
//
// Core type definitions used across all contracts.
// These types define the data structures that make the transparent economy work.
//
// =============================================================================

use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{AssetName}

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
  nutrient: ByteArray,
  // e.g., "iron", "vitamin_d", "folate"
  efficiency: ProcessingLevel,
}

pub type ProcessingLevel {
  Normal
  Reduced
  // Needs more of this nutrient
  Enhanced
  // Processes efficiently, needs less
  Impaired
}

// Significant absorption issues

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
  SeedOils
  // Inflammatory response to industrial oils
  RefinedSugars
  // Insulin sensitivity issues
  Other { code: ByteArray }
}

pub type SensitivityLevel {
  Mild
  // Preference to avoid
  Moderate
  // Should avoid for optimal health
  Severe
}

// Must avoid, causes harm

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
  Construction { phase: ByteArray, asset_id: AssetName }
  /// Energy purchase
  Energy { energy_type: EnergyType, quantity_kwh: Int }
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
  Education { program_type: ByteArray, provider: AssetName }
  /// Transportation payment
  Transport { mode: ByteArray, distance: Option<Int> }
  /// Hospitality (lodging, food service)
  Hospitality { service_type: ByteArray }
  /// Rental/lease payment
  Rental { asset_id: AssetName, period: Int }
  /// Insurance premium
  Insurance { pool_id: ByteArray, coverage_type: ByteArray }
  // === QUATERNARY SECTOR (Knowledge) ===
  /// Research/consulting payment
  Research { field: ByteArray, deliverable_hash: ByteArray }
  /// Data/information purchase
  Data { data_type: ByteArray, access_type: ByteArray }
  /// Intellectual property license
  License { ip_id: ByteArray, terms_hash: ByteArray }
  // === QUINARY SECTOR (Care) ===
  /// Care work payment/recognition
  Care { care_type: ByteArray, hours: Int }
  /// Community service recognition
  CommunityService { service_type: ByteArray }
  // === FINANCIAL ===
  /// Gift or donation
  Gift
  /// Investment or loan disbursement
  Investment {
    /// Terms hash (IPFS)
    terms_hash: ByteArray,
  }
  /// Loan repayment
  LoanRepayment { loan_id: ByteArray, principal: Int, interest: Int }
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
  StakeReward { pool_id: ByteArray, epoch: Int }
  /// Impact token trade
  ImpactTrade { impact_token_id: ByteArray, quantity: Int }
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
pub type CompoundCode =
  ByteArray

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
  CarbonImpact
  // 0x0500
  WaterImpact
  // 0x0510
  BiodiversityImpact
  // 0x0520
  SoilImpact
  // 0x0530
  AirImpact
  // 0x0540
  WasteImpact
  // 0x0550
  EnergyImpact
  // 0x0560
  LandUseImpact
  // 0x0570
  MultipleImpact
}

// Multiple codes

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
    Labor { .. } -> 1
    Goods { .. } -> 2
    Services { .. } -> 3
    Gift -> 4
    Investment { .. } -> 5
    Remediation { .. } -> 6
    UBI { .. } -> 7
    GovernanceReward { .. } -> 8
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
  list_map(
    flows,
    fn(f) {
      CompoundBalance {
        compound: f.compound,
        quantity: f.quantity,
        unit: f.unit,
      }
    },
  )
}

/// Add compound balances to consumer record
pub fn accrue_to_consumer(
  record: ConsumerImpactRecord,
  new_compounds: List<CompoundBalance>,
  cycle: Int,
) -> ConsumerImpactRecord {
  // Add new compounds to lifetime and unremediated
  ConsumerImpactRecord {
    lifetime_compounds: merge_compound_lists(
      record.lifetime_compounds,
      new_compounds,
    ),
    remediated_compounds: record.remediated_compounds,
    unremediated_compounds: merge_compound_lists(
      record.unremediated_compounds,
      new_compounds,
    ),
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
  if x < 0 {
    -x
  } else {
    x
  }
}

// =============================================================================
// TESTS
// =============================================================================

test voting_weight_basic_is_0() {
  voting_weight(Basic) == 0
}

test voting_weight_standard_is_1() {
  voting_weight(Standard) == 1
}

test voting_weight_verified_is_2() {
  voting_weight(Verified) == 2
}

test voting_weight_steward_is_3() {
  voting_weight(Steward) == 3
}

test basic_cannot_transact() {
  !can_transact(Basic)
}

test standard_can_transact() {
  can_transact(Standard)
}

test verified_can_transact() {
  can_transact(Verified)
}

test steward_can_transact() {
  can_transact(Steward)
}

test basic_cannot_propose() {
  !can_propose(Basic)
}

test standard_cannot_propose() {
  !can_propose(Standard)
}

test verified_can_propose() {
  can_propose(Verified)
}

test steward_can_propose() {
  can_propose(Steward)
}

test tx_type_code_labor_is_1() {
  tx_type_code(Labor { work_code: "", hours: None }) == 1
}

test tx_type_code_goods_is_2() {
  tx_type_code(Goods { product_code: "", quantity: 1, unit_code: "" }) == 2
}

test tx_type_code_services_is_3() {
  tx_type_code(Services { service_code: "" }) == 3
}

test tx_type_code_gift_is_4() {
  tx_type_code(Gift) == 4
}

test tx_type_code_ubi_is_7() {
  tx_type_code(UBI { cycle: 0 }) == 7
}

test tx_type_code_internal_is_9() {
  tx_type_code(Internal) == 9
}

test impact_sign_positive_is_1() {
  impact_sign(Positive { impact_code: "", magnitude: 100, unit_code: None }) == 1
}

test impact_sign_negative_is_minus_1() {
  impact_sign(
    Negative {
      impact_code: "",
      magnitude: 100,
      unit_code: None,
      remediation: Immediate { output_index: 0 },
    },
  ) == -1
}

test impact_magnitude_positive() {
  impact_magnitude(
    Positive { impact_code: "", magnitude: 500, unit_code: None },
  ) == 500
}

test impact_magnitude_negative() {
  impact_magnitude(
    Negative {
      impact_code: "",
      magnitude: 750,
      unit_code: None,
      remediation: Immediate { output_index: 0 },
    },
  ) == 750
}

test verification_levels_ordered() {
  voting_weight(Basic) < voting_weight(Standard) && voting_weight(Standard) < voting_weight(
    Verified,
  ) && voting_weight(Verified) < voting_weight(Steward)
}

// =============================================================================
// HASH-BASED ACCESS CONTROL
// =============================================================================
//
// Stores only hashes on-chain (tiny transactions).
// Actual content stored off-chain (IPFS/Arweave).
// Owner grants time-limited access to view actual files.
// LLM interface generates viewable formats (JPEG, JSON, etc.) on demand.
//
// =============================================================================

/// Types of content that can be stored off-chain
pub type ContentType {
  Document
  // PDF, contracts, agreements
  Image
  // JPEG, PNG, photos
  Video
  // MP4, recordings
  Audio
  // MP3, voice memos
  DataFile
  // JSON, CSV, structured data
  Model3D
  // CAD, 3D scans
  Certificate
  // Credentials, certifications
  Evidence
  // Work completion proofs
  Medical
  // Health records (extra privacy)
  Financial
  // Bank statements, invoices
  Legal
  // Legal documents
  Identity
  // ID documents
  CustomContentType { type_code: ByteArray }
}

/// Storage networks for off-chain content
pub type StorageNetwork {
  IPFS
  Arweave
  Filecoin
  PrivateStorage
}

/// Content reference — only the hash goes on-chain
pub type ContentReference {
  /// The hash that goes on-chain (32 bytes)
  content_hash: ByteArray,
  /// What type of content
  content_type: ContentType,
  /// Size in bytes (for optimization)
  size_bytes: Int,
  /// Where it's stored
  storage_network: StorageNetwork,
  /// Is it encrypted?
  encrypted: Bool,
  /// Who owns this content
  owner_pnft: AssetName,
  /// When registered
  registered_at: Int,
  /// Linked asset (optional)
  linked_asset: Option<AssetName>,
  /// Linked agreement (optional)
  linked_agreement: Option<ByteArray>,
}

/// Grant duration presets
pub type GrantDuration {
  /// Fixed hours: 1, 2, 4, 8, 12, or 24
  Hours { hours: Int }
  /// Fixed days: 1, 3, 7, 14, or 30
  Days { days: Int }
  /// Tied to work contract duration
  WorkContract { agreement_id: ByteArray }
  /// Never expires
  Permanent
  /// One-time view only
  SingleView
  /// Custom expiry timestamp
  CustomExpiry { expires_at: Int }
}

/// Access level for granted content
pub type AccessLevel {
  ViewOnly
  // Can view but not download
  Download
  // Can download a copy
  Share
  // Can share with others (limited)
  Full
}

// Full access including resharing

/// Access grant — permission to view content behind a hash
/// This is what goes on-chain (small datum)
pub type AccessGrant {
  /// Unique grant ID
  grant_id: ByteArray,
  /// Content hash being granted access to
  content_hash: ByteArray,
  /// Who is granted access
  grantee_pnft: AssetName,
  /// Who granted access
  grantor_pnft: AssetName,
  /// Duration type
  duration: GrantDuration,
  /// When granted
  granted_at: Int,
  /// When expires (None = permanent)
  expires_at: Option<Int>,
  /// Access level
  access_level: AccessLevel,
  /// Whether revoked
  revoked: Bool,
  /// View count
  view_count: Int,
  /// Max views allowed (None = unlimited)
  max_views: Option<Int>,
  /// Linked work agreement (if auto-granted)
  work_agreement_id: Option<ByteArray>,
}

/// Batch grant for multiple contents at once
pub type BatchAccessGrant {
  batch_id: ByteArray,
  content_hashes: List<ByteArray>,
  grantee_pnft: AssetName,
  grantor_pnft: AssetName,
  duration: GrantDuration,
  access_level: AccessLevel,
  granted_at: Int,
  expires_at: Option<Int>,
  work_agreement_id: Option<ByteArray>,
}

/// Work contract access integration
/// Auto-grants when work contract is created
pub type WorkContractAccessGrants {
  /// The work agreement this is attached to
  agreement_id: ByteArray,
  /// Grants from client to worker (e.g., specs, requirements)
  grants_client_to_worker: List<ContentReference>,
  /// Grants from worker to client (e.g., deliverables)
  grants_worker_to_client: List<ContentReference>,
  /// Additional grants on verification (unlocked on completion)
  on_verification_grants: List<ContentReference>,
}

/// Access grant redeemer actions
pub type AccessGrantRedeemer {
  /// Grant access to content
  GrantAccess {
    content_hash: ByteArray,
    grantee: AssetName,
    duration: GrantDuration,
    access_level: AccessLevel,
  }
  /// Revoke existing access
  RevokeAccess { grant_id: ByteArray, reason_hash: Option<ByteArray> }
  /// Extend access duration
  ExtendAccess { grant_id: ByteArray, new_expiry: Int }
  /// Transfer content ownership
  TransferOwnership { content_hash: ByteArray, new_owner: AssetName }
  /// Batch grant to multiple contents
  BatchGrant {
    content_hashes: List<ByteArray>,
    grantee: AssetName,
    duration: GrantDuration,
  }
  /// Auto-grant from work contract
  WorkContractGrant { agreement_id: ByteArray }
  /// Record a view (increments view_count)
  RecordView { grant_id: ByteArray }
}

/// Output format for LLM view generation
pub type OutputFormat {
  JSON
  JPEG
  PNG
  PDF
  Markdown
  PlainText
  HTML
  CSV
  Summary
  // LLM-generated summary
  Thumbnail
}

// Small preview

/// View request for LLM to generate viewable content
pub type ViewRequest {
  content_hash: ByteArray,
  requester_pnft: AssetName,
  output_format: OutputFormat,
  /// For paginated content
  page: Option<Int>,
  page_size: Option<Int>,
}

/// Access log entry for audit trail
pub type AccessLogEntry {
  log_id: ByteArray,
  content_hash: ByteArray,
  accessor_pnft: AssetName,
  access_type: AccessType,
  accessed_at: Int,
  output_format: OutputFormat,
  success: Bool,
}

pub type AccessType {
  ViewAction
  DownloadAction
  ShareAction
}

// =============================================================================
// ACCESS CONTROL HELPER FUNCTIONS
// =============================================================================

/// Calculate expiry slot from grant duration
pub fn calculate_expiry(
  duration: GrantDuration,
  start_slot: Int,
  slots_per_hour: Int,
) -> Option<Int> {
  when duration is {
    Hours { hours } -> Some(start_slot + hours * slots_per_hour)
    Days { days } -> Some(start_slot + days * 24 * slots_per_hour)
    Permanent -> None
    SingleView -> Some(start_slot + 24 * slots_per_hour)
    // 24hr max for single view
    CustomExpiry { expires_at } -> Some(expires_at)
    WorkContract { .. } -> None
  }
  // Resolved by work contract
}

/// Check if an access grant is currently valid
pub fn is_grant_valid(grant: AccessGrant, current_slot: Int) -> Bool {
  // Not revoked
  !grant.revoked && // Not expired (if has expiry)
  when grant.expires_at is {
    None -> True
    Some(exp) -> current_slot <= exp
  } && // Not over view limit (if has limit)
  when grant.max_views is {
    None -> True
    Some(max) -> grant.view_count < max
  }
}

/// Check if grantor owns the content
pub fn can_grant_access(content: ContentReference, grantor: AssetName) -> Bool {
  content.owner_pnft == grantor
}

/// Increment view count on grant
pub fn record_view(grant: AccessGrant, slot: Int) -> AccessGrant {
  AccessGrant { ..grant, view_count: grant.view_count + 1 }
}

// =============================================================================
// ACCESS CONTROL TESTS
// =============================================================================

test grant_duration_hours_expiry() {
  let start = 1000
  let slots_per_hour = 3600
  calculate_expiry(Hours { hours: 8 }, start, slots_per_hour) == Some(
    1000 + 8 * 3600,
  )
}

test grant_duration_days_expiry() {
  let start = 1000
  let slots_per_hour = 3600
  calculate_expiry(Days { days: 7 }, start, slots_per_hour) == Some(
    1000 + 7 * 24 * 3600,
  )
}

test grant_duration_permanent_no_expiry() {
  calculate_expiry(Permanent, 1000, 3600) == None
}

test valid_grant_not_revoked() {
  let grant =
    AccessGrant {
      grant_id: "test",
      content_hash: "hash",
      grantee_pnft: "grantee",
      grantor_pnft: "grantor",
      duration: Permanent,
      granted_at: 1000,
      expires_at: None,
      access_level: ViewOnly,
      revoked: False,
      view_count: 0,
      max_views: None,
      work_agreement_id: None,
    }
  is_grant_valid(grant, 2000)
}

test invalid_grant_revoked() {
  let grant =
    AccessGrant {
      grant_id: "test",
      content_hash: "hash",
      grantee_pnft: "grantee",
      grantor_pnft: "grantor",
      duration: Permanent,
      granted_at: 1000,
      expires_at: None,
      access_level: ViewOnly,
      revoked: True,
      view_count: 0,
      max_views: None,
      work_agreement_id: None,
    }
  !is_grant_valid(grant, 2000)
}

test invalid_grant_expired() {
  let grant =
    AccessGrant {
      grant_id: "test",
      content_hash: "hash",
      grantee_pnft: "grantee",
      grantor_pnft: "grantor",
      duration: Hours { hours: 8 },
      granted_at: 1000,
      expires_at: Some(1500),
      access_level: ViewOnly,
      revoked: False,
      view_count: 0,
      max_views: None,
      work_agreement_id: None,
    }
  !is_grant_valid(grant, 2000)
}

test invalid_grant_max_views_reached() {
  let grant =
    AccessGrant {
      grant_id: "test",
      content_hash: "hash",
      grantee_pnft: "grantee",
      grantor_pnft: "grantor",
      duration: Permanent,
      granted_at: 1000,
      expires_at: None,
      access_level: ViewOnly,
      revoked: False,
      view_count: 5,
      max_views: Some(5),
      work_agreement_id: None,
    }
  !is_grant_valid(grant, 2000)
}
