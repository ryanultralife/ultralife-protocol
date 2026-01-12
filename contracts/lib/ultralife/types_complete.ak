// =============================================================================
// UltraLife Protocol — Complete Integrated Types V3
// =============================================================================
//
// A COMPLETE PARALLEL ECONOMY FOR CARBON-BASED LIFE
//
// This type system defines:
// 1. LAND RIGHTS — Surface, subsurface, water, air, cellulose
// 2. LABOR RIGHTS — Human work as dignified contribution
// 3. RESOURCE FLOWS — Every material tracked from source to sink
// 4. IMPACT ACCOUNTING — Universal, mandatory, physical
// 5. UBI CALCULATION — Based on real bioregional data
// 6. ECONOMIC SECTORS — Remapped for bidirectional information flow
//
// The goal: Carbon-based life living in abundance on Earth
// and any terrestrial body we choose to inhabit.
//
// =============================================================================

use aiken/crypto.{VerificationKeyHash, Blake2b_256, Hash}
use cardano/assets.{PolicyId, AssetName}

// =============================================================================
// PART 1: LAND & RESOURCE RIGHTS
// =============================================================================
//
// Land is not "owned" — it is STEWARDED. Rights are separated:
// - Surface: What happens on top (agriculture, housing, movement)
// - Subsurface: What's below (minerals, aquifers, geology)
// - Water: What flows through (streams, rain capture, irrigation)
// - Air: What circulates above (emissions, capture, quality)
// - Cellulose: Living biomass (trees, crops, organisms)
//
// Each right carries RESPONSIBILITIES and generates IMPACTS.
//
// =============================================================================

/// Land NFT — represents stewardship of a geographic parcel
pub type LandNFT {
  /// Unique land identifier
  land_id: ByteArray,
  /// Bioregion this land belongs to
  bioregion: ByteArray,
  /// Geographic bounds (GeoJSON hash on IPFS)
  bounds_hash: ByteArray,
  /// Total area in square meters
  area_m2: Int,
  /// Elevation range (meters above sea level)
  elevation_min: Int,
  elevation_max: Int,
  /// Land classification
  classification: LandClassification,
  /// Current primary steward (pNFT)
  primary_steward: AssetName,
  /// Rights allocation
  rights: LandRights,
  /// Current health metrics
  health: LandHealth,
  /// Creation/registration slot
  registered_at: Int,
  /// Last survey slot
  last_surveyed: Int,
  /// Applicable traditional territory (if any)
  traditional_territory: Option<ByteArray>,
  /// Cultural protocols required
  cultural_protocols: Option<ByteArray>,
}

/// Land classification for base characteristics
pub type LandClassification {
  /// Primary terrain type
  terrain: TerrainType,
  /// Climate zone
  climate: ClimateZone,
  /// Watershed membership
  watershed: ByteArray,
  /// Soil type classification
  soil_type: ByteArray,
  /// Ecosystem type
  ecosystem: EcosystemType,
}

/// Terrain types
pub type TerrainType {
  Mountain
  Highland
  Valley
  Plain
  Coastal
  Riparian
  Wetland
  Desert
  Tundra
  Island
}

/// Climate zones (Köppen simplified)
pub type ClimateZone {
  Tropical
  Arid
  Temperate
  Continental
  Polar
  Mediterranean
  Oceanic
  Subarctic
}

/// Ecosystem types
pub type EcosystemType {
  OldGrowthForest
  SecondaryForest
  Grassland
  Savanna
  Shrubland
  Wetland
  Aquatic
  Agricultural
  Urban
  Degraded
  Restoration
}

/// Separated rights bundle for land
pub type LandRights {
  /// Surface rights holder
  surface: RightHolder,
  /// Subsurface rights holder
  subsurface: RightHolder,
  /// Water rights holder
  water: RightHolder,
  /// Air rights holder
  air: RightHolder,
  /// Cellulose/biomass rights holder
  cellulose: RightHolder,
  /// Development rights (can build structures)
  development: RightHolder,
  /// Access rights (who can traverse)
  access: AccessRights,
  /// Carbon rights (who gets carbon credits)
  carbon: RightHolder,
}

/// Who holds a specific right
pub type RightHolder {
  /// The pNFT that holds this right
  holder: AssetName,
  /// How the right was acquired
  acquisition: AcquisitionType,
  /// When the right was acquired
  acquired_at: Int,
  /// Is this right transferable?
  transferable: Bool,
  /// Expiration (if leased/temporary)
  expires: Option<Int>,
  /// Conditions/restrictions hash
  conditions: Option<ByteArray>,
  /// Revenue share to land steward (basis points)
  steward_share: Int,
  /// Revenue share to bioregion treasury (basis points)
  bioregion_share: Int,
}

/// How a right was acquired
pub type AcquisitionType {
  /// Original steward assignment
  Original
  /// Transferred from previous holder
  Transfer
  /// Leased for a period
  Lease
  /// Inherited
  Inheritance
  /// Community/collective holding
  Collective
  /// Traditional/indigenous right
  Traditional
  /// Granted by governance
  Grant
}

/// Access right configuration
pub type AccessRights {
  /// Public access allowed?
  public_access: Bool,
  /// Access for which verification levels?
  min_level_required: VerificationLevel,
  /// Specific allowed pNFTs (if restricted)
  allowed_pnfts: Option<List<AssetName>>,
  /// Access fee (if any)
  access_fee: Option<Int>,
}

/// Current health metrics for land
pub type LandHealth {
  /// Overall health index (0-10000)
  overall_index: Int,
  /// Soil health (0-10000)
  soil_health: Int,
  /// Water health (0-10000)
  water_health: Int,
  /// Biodiversity index (0-10000)
  biodiversity_index: Int,
  /// Carbon stock (tonnes)
  carbon_stock: Int,
  /// Carbon flux (annual net, positive = sequestering)
  carbon_flux: Int,
  /// Biomass (tonnes)
  biomass_total: Int,
  /// Species count (documented)
  species_count: Int,
  /// Invasive percentage (0-10000)
  invasive_ratio: Int,
  /// Health trend
  trend: HealthTrend,
}

// =============================================================================
// PART 2: LABOR AS DIGNIFIED CONTRIBUTION
// =============================================================================
//
// Labor is not a commodity to be minimized. It is the contribution
// of human skill, time, and care to the collective endeavor.
//
// Every labor transaction tracks:
// - WHO did the work (DNA-verified)
// - WHAT kind of work (skill category)
// - WHERE it happened (land/bioregion)
// - WHAT IMPACT it created (physical consequences)
//
// =============================================================================

/// Labor contribution record
pub type LaborRecord {
  /// Worker pNFT
  worker: AssetName,
  /// Employer/payer pNFT
  employer: AssetName,
  /// Land where work occurred (if applicable)
  land_id: Option<ByteArray>,
  /// Labor category
  labor_type: LaborType,
  /// Specific skill code
  skill_code: ByteArray,
  /// Hours contributed
  hours: Int,
  /// Payment amount (tokens)
  payment: Int,
  /// Effective hourly rate
  hourly_rate: Int,
  /// Impacts created by this labor
  impacts: List<Impact>,
  /// Transaction slot
  slot: Int,
  /// Cycle
  cycle: Int,
  /// Evidence hash (photos, verification)
  evidence_hash: ByteArray,
}

/// Categories of labor
pub type LaborType {
  // === LAND-BASED LABOR ===
  /// Working with soil, plants, animals
  Agriculture {
    subtype: AgricultureType,
  }
  /// Forest management, timber, restoration
  Forestry {
    subtype: ForestryType,
  }
  /// Water system management
  WaterManagement {
    subtype: WaterWorkType,
  }
  /// Wildlife and habitat management
  Conservation {
    subtype: ConservationType,
  }
  
  // === CONSTRUCTION & INFRASTRUCTURE ===
  /// Building structures
  Construction {
    subtype: ConstructionType,
  }
  /// Maintaining infrastructure
  Maintenance {
    subtype: MaintenanceType,
  }
  
  // === KNOWLEDGE & SERVICE ===
  /// Teaching, training, mentoring
  Education {
    subtype: EducationType,
  }
  /// Health and wellness services
  Healthcare {
    subtype: HealthcareType,
  }
  /// Administrative and organizational
  Administration {
    subtype: AdminType,
  }
  /// Research and development
  Research {
    subtype: ResearchType,
  }
  
  // === CARE WORK ===
  /// Childcare, eldercare, community care
  CareWork {
    subtype: CareType,
  }
  /// Food preparation and service
  FoodService {
    subtype: FoodServiceType,
  }
  
  // === CREATIVE & CULTURAL ===
  /// Art, music, cultural production
  Cultural {
    subtype: CulturalType,
  }
  /// Traditional knowledge keeping
  TraditionalKnowledge {
    subtype: TEKType,
  }
}

/// Agriculture subtypes
pub type AgricultureType {
  Planting
  Harvesting
  AnimalHusbandry
  SoilPreparation
  Irrigation
  PestManagement
  Composting
  SeedSaving
}

/// Forestry subtypes
pub type ForestryType {
  TreePlanting
  SelectiveHarvest
  Coppicing
  FireManagement
  InvasiveRemoval
  NurseryWork
  ForestRestoration
}

/// Water work subtypes
pub type WaterWorkType {
  WatershedRestoration
  IrrigationMaintenance
  WaterQualityMonitoring
  AquiferRecharge
  RainwaterHarvesting
  StreamRestoration
}

/// Conservation subtypes
pub type ConservationType {
  HabitatRestoration
  SpeciesMonitoring
  WildlifeManagement
  ErosionControl
  PollutorRemediation
  NativePlanting
}

/// Construction subtypes
pub type ConstructionType {
  NaturalBuilding
  ConventionalBuilding
  Infrastructure
  Demolition
  Renovation
  SolarInstallation
}

/// Maintenance subtypes
pub type MaintenanceType {
  BuildingMaintenance
  EquipmentRepair
  InfrastructureMaintenance
  LandscapeMaintenance
}

/// Education subtypes
pub type EducationType {
  FormalTeaching
  SkillsTraining
  Mentoring
  CommunityEducation
  EnvironmentalEducation
}

/// Healthcare subtypes
pub type HealthcareType {
  DirectCare
  PreventiveCare
  MentalHealth
  TraditionalMedicine
  EmergencyResponse
}

/// Administrative subtypes
pub type AdminType {
  Governance
  RecordKeeping
  Coordination
  PlanningDesign
}

/// Research subtypes
pub type ResearchType {
  FieldResearch
  DataAnalysis
  Documentation
  Innovation
}

/// Care work subtypes
pub type CareType {
  Childcare
  Eldercare
  DisabilityCare
  CommunityCare
  AnimalCare
}

/// Food service subtypes
pub type FoodServiceType {
  FoodPreparation
  Preservation
  Distribution
  CommunalMeals
}

/// Cultural subtypes
pub type CulturalType {
  PerformingArts
  VisualArts
  Crafts
  Storytelling
  Ceremony
}

/// Traditional Ecological Knowledge subtypes
pub type TEKType {
  KnowledgeTransmission
  CulturalPractice
  SacredSiteCare
  TraditionalHarvesting
  CeremonialLeadership
}

// =============================================================================
// PART 3: RESOURCE FLOWS — COMPLETE MATERIAL TRACKING
// =============================================================================
//
// Every material in the economy is tracked from source to sink:
// - EXTRACTION: Where it came from
// - TRANSFORMATION: How it was processed
// - DISTRIBUTION: How it moved
// - CONSUMPTION: How it was used
// - RETURN: Where it went (waste, recycle, compost)
//
// Bidirectional flow: Forward supply chain + backward return chain
//
// =============================================================================

/// Resource tracking record
pub type ResourceRecord {
  /// Unique resource batch ID
  resource_id: ByteArray,
  /// Resource type
  resource_type: ResourceType,
  /// Specific material code
  material_code: ByteArray,
  /// Quantity
  quantity: Int,
  /// Unit
  unit: ByteArray,
  /// Current lifecycle stage
  stage: LifecycleStage,
  /// Origin (where extracted/grown)
  origin: ResourceOrigin,
  /// Chain of custody
  custody_chain: List<CustodyRecord>,
  /// Cumulative impacts through lifecycle
  cumulative_impacts: List<Impact>,
  /// Quality/grade
  quality_grade: Int,
  /// Certifications
  certifications: List<ByteArray>,
}

/// Categories of resources
pub type ResourceType {
  // === BIOLOGICAL ===
  /// Food crops
  FoodCrop {
    crop_type: ByteArray,
    organic: Bool,
  }
  /// Fiber crops (cotton, hemp, flax)
  FiberCrop {
    fiber_type: ByteArray,
  }
  /// Timber and wood products
  Timber {
    species: ByteArray,
    certification: Option<ByteArray>,
  }
  /// Animal products
  AnimalProduct {
    product_type: ByteArray,
    animal_welfare: Int,
  }
  /// Wild harvested
  WildHarvested {
    species: ByteArray,
    sustainable: Bool,
  }
  
  // === GEOLOGICAL ===
  /// Mined minerals
  Mineral {
    mineral_type: ByteArray,
  }
  /// Extracted water
  Water {
    source_type: WaterSource,
  }
  /// Soil/earth materials
  SoilMaterial {
    soil_type: ByteArray,
  }
  
  // === ENERGY ===
  /// Renewable energy
  RenewableEnergy {
    source: RenewableSource,
  }
  /// Stored energy
  StoredEnergy {
    storage_type: ByteArray,
  }
  
  // === MANUFACTURED ===
  /// Processed goods
  ManufacturedGood {
    product_code: ByteArray,
    recyclable: Bool,
  }
  /// Recycled material
  RecycledMaterial {
    original_type: ByteArray,
    cycles: Int,
  }
  /// Composted material
  CompostedMaterial {
    source_type: ByteArray,
  }
}

/// Water source types
pub type WaterSource {
  Rainfall
  Aquifer
  River
  Lake
  Desalinated
  Recycled
  Atmospheric
}

/// Renewable energy sources
pub type RenewableSource {
  Solar
  Wind
  Hydro
  Geothermal
  Biomass
  Tidal
  Human  // Yes, human power counts
}

/// Resource lifecycle stages
pub type LifecycleStage {
  /// Initial extraction/growth
  Extraction
  /// Processing/transformation
  Processing
  /// In transit/distribution
  Distribution
  /// In use
  InUse
  /// End of primary use
  PostConsumer
  /// Being recycled/composted
  Return
  /// Final disposal (ideally rare)
  Disposal
}

/// Where a resource originated
pub type ResourceOrigin {
  /// Land it came from
  land_id: ByteArray,
  /// Bioregion
  bioregion: ByteArray,
  /// Extractor/grower pNFT
  extractor: AssetName,
  /// Extraction method
  method: ByteArray,
  /// Extraction impacts
  extraction_impacts: List<Impact>,
  /// Timestamp
  extracted_at: Int,
}

/// Chain of custody record
pub type CustodyRecord {
  /// Who held it
  holder: AssetName,
  /// What they did to it
  action: CustodyAction,
  /// Where it was
  location_bioregion: ByteArray,
  /// Impacts during this custody
  impacts: List<Impact>,
  /// Start of custody
  started_at: Int,
  /// End of custody
  ended_at: Int,
}

/// Actions that can happen during custody
pub type CustodyAction {
  /// Storage
  Storage
  /// Transportation
  Transport {
    method: TransportMethod,
    distance_km: Int,
  }
  /// Processing/transformation
  Processing {
    process_type: ByteArray,
  }
  /// Retail/distribution
  Distribution
  /// Consumer use
  Consumption
  /// Repair/refurbishment
  Repair
  /// Recycling
  Recycling
  /// Composting
  Composting
  /// Disposal
  Disposal
}

/// Transport methods
pub type TransportMethod {
  Walking
  Bicycle
  ElectricVehicle
  FossilVehicle
  Rail
  Ship
  Aircraft
  Pipeline
  Drone
}

// =============================================================================
// PART 4: ECONOMIC SECTORS — REMAPPED FOR REALITY
// =============================================================================
//
// Traditional economic sectors hide true costs and externalities.
// UltraLife remaps sectors to show:
// - REAL resource flows
// - ACTUAL impacts
// - TRUE costs and benefits
// - BIDIRECTIONAL information
//
// =============================================================================

/// Economic sector classification
pub type EconomicSector {
  // === PRIMARY (Extraction/Growth) ===
  /// Food production
  FoodProduction {
    subsector: FoodSubsector,
  }
  /// Material extraction
  MaterialExtraction {
    subsector: ExtractionSubsector,
  }
  /// Energy generation
  EnergyGeneration {
    subsector: EnergySubsector,
  }
  
  // === SECONDARY (Transformation) ===
  /// Food processing
  FoodProcessing
  /// Material processing
  MaterialProcessing
  /// Manufacturing
  Manufacturing
  /// Construction
  ConstructionSector
  
  // === TERTIARY (Distribution & Service) ===
  /// Distribution and logistics
  Distribution
  /// Retail
  Retail
  /// Services
  Services {
    subsector: ServiceSubsector,
  }
  
  // === QUATERNARY (Knowledge & Care) ===
  /// Education
  EducationSector
  /// Healthcare
  HealthcareSector
  /// Research
  ResearchSector
  /// Governance
  GovernanceSector
  
  // === QUINARY (Regeneration & Return) ===
  /// Waste processing
  WasteProcessing
  /// Ecosystem restoration
  EcosystemRestoration
  /// Remediation
  Remediation
  /// Circular return
  CircularReturn
}

/// Food production subsectors
pub type FoodSubsector {
  RegenerativeAgriculture
  OrganicAgriculture
  ConventionalAgriculture
  Agroforestry
  Aquaculture
  WildHarvest
  AnimalHusbandry
  UrbanFarming
}

/// Extraction subsectors
pub type ExtractionSubsector {
  SustainableForestry
  ConventionalForestry
  Mining
  Quarrying
  WaterExtraction
}

/// Energy subsectors
pub type EnergySubsector {
  SolarGeneration
  WindGeneration
  HydroGeneration
  GeothermalGeneration
  BiomassGeneration
  FossilExtraction  // Tracked, heavily impacted
  NuclearGeneration
}

/// Service subsectors
pub type ServiceSubsector {
  FoodService
  TransportService
  FinancialService
  ProfessionalService
  PersonalService
  CommunityService
}

/// Sector statistics for a bioregion
pub type SectorStats {
  /// Sector
  sector: EconomicSector,
  /// Bioregion
  bioregion: ByteArray,
  /// Cycle
  cycle: Int,
  /// Total transaction volume (tokens)
  volume: Int,
  /// Number of transactions
  tx_count: Int,
  /// Number of active participants
  participants: Int,
  /// Net impact (sum of all transaction impacts)
  net_impact: Int,
  /// Impact by category
  impact_by_category: List<(ImpactCategory, Int)>,
  /// Average hourly wage (for labor sectors)
  avg_hourly_wage: Option<Int>,
  /// Resource flows in
  resources_in: Int,
  /// Resource flows out
  resources_out: Int,
}

// =============================================================================
// PART 5: UBI CALCULATION — BASED ON REAL DATA
// =============================================================================
//
// UBI is not arbitrary. It is calculated from:
// 1. Bioregion's natural carrying capacity
// 2. Actual cost of living (food, housing, energy)
// 3. Individual participation and impact
// 4. Available treasury funds
//
// The goal: Every person can meet basic needs through UBI alone.
// Additional economic activity builds abundance.
//
// =============================================================================

/// UBI calculation parameters for a bioregion
pub type UBIParameters {
  /// Bioregion
  bioregion: ByteArray,
  /// Current cycle
  cycle: Int,
  
  // === COST OF LIVING BASKET ===
  /// Average food cost per person per cycle
  food_cost: Int,
  /// Average housing cost per person per cycle
  housing_cost: Int,
  /// Average energy cost per person per cycle
  energy_cost: Int,
  /// Average transport cost per person per cycle
  transport_cost: Int,
  /// Average healthcare cost per person per cycle
  healthcare_cost: Int,
  /// Other essential costs
  other_essential: Int,
  /// Total basic needs cost
  total_basic_needs: Int,
  
  // === BIOREGION CAPACITY ===
  /// Natural carrying capacity (sustainable population)
  carrying_capacity: Int,
  /// Current population
  current_population: Int,
  /// Population ratio (current/capacity, basis points)
  population_ratio: Int,
  /// Resource abundance index (0-10000)
  abundance_index: Int,
  
  // === UBI FORMULA ===
  /// Base UBI amount (tokens per person per cycle)
  base_ubi: Int,
  /// Health modifier (bioregion health affects UBI)
  health_modifier: Int,
  /// Participation modifier (activity affects UBI)
  participation_modifier: Int,
  /// Impact modifier (positive impact earns bonus)
  impact_modifier: Int,
  /// Level bonus (verification level adds bonus)
  level_bonus: Int,
  
  // === TREASURY CONSTRAINTS ===
  /// Available UBI pool this cycle
  available_pool: Int,
  /// Maximum payout per person (treasury constraint)
  max_payout: Int,
  /// Minimum guaranteed (floor)
  min_guaranteed: Int,
}

/// Individual UBI calculation
pub type UBICalculation {
  /// Recipient pNFT
  recipient: AssetName,
  /// Bioregion
  bioregion: ByteArray,
  /// Cycle
  cycle: Int,
  
  // === BASE CALCULATION ===
  /// Base amount from parameters
  base_amount: Int,
  
  // === MODIFIERS APPLIED ===
  /// Health modifier effect (+/-)
  health_effect: Int,
  /// Participation score (0-100)
  participation_score: Int,
  /// Participation effect (+/-)
  participation_effect: Int,
  /// Impact score (net impact this cycle)
  impact_score: Int,
  /// Impact effect (+/-)
  impact_effect: Int,
  /// Level bonus applied
  level_bonus: Int,
  
  // === FINAL AMOUNT ===
  /// Calculated amount before constraints
  calculated_amount: Int,
  /// Final amount after treasury constraints
  final_amount: Int,
  
  // === BREAKDOWN ===
  /// This covers estimated % of basic needs
  basic_needs_coverage: Int,
}

/// Cost of living data source (from actual transactions)
pub type CostOfLivingData {
  /// Bioregion
  bioregion: ByteArray,
  /// Cycle
  cycle: Int,
  /// Data source count (transactions analyzed)
  sample_size: Int,
  
  // === FOOD ===
  /// Median food transaction
  food_median: Int,
  /// Food transaction count
  food_tx_count: Int,
  /// Food sector volume
  food_volume: Int,
  
  // === HOUSING ===
  /// Median housing transaction
  housing_median: Int,
  /// Housing transaction count
  housing_tx_count: Int,
  /// Housing sector volume
  housing_volume: Int,
  
  // === ENERGY ===
  /// Median energy transaction
  energy_median: Int,
  /// Energy transaction count
  energy_tx_count: Int,
  /// Energy sector volume
  energy_volume: Int,
  
  // === DERIVED METRICS ===
  /// Estimated monthly cost of living
  estimated_monthly_cost: Int,
  /// Cost trend (vs previous cycle)
  cost_trend: Int,
  /// Affordability index (UBI / cost)
  affordability_index: Int,
}

// =============================================================================
// PART 6: IMPACT CATEGORIES — COMPLETE PHYSICAL REALITY
// =============================================================================

/// Impact Category — physical systems affecting planetary vitality
pub type ImpactCategory {
  Carbon
  Water
  Biodiversity
  Soil
  Air
  Waste
  Energy
  LandUse
}

/// Single impact measurement
pub type Impact {
  category: ImpactCategory,
  compound_code: ByteArray,
  magnitude: Int,
  unit: ByteArray,
  confidence: Int,
  locality: ImpactLocality,
}

/// Impact locality
pub type ImpactLocality {
  Site
  Local
  Regional
  Global
}

/// Health trend
pub type HealthTrend {
  Improving
  Stable
  Declining
  Unknown
}

// =============================================================================
// PART 7: IDENTITY & VERIFICATION
// =============================================================================

/// Verification levels
pub type VerificationLevel {
  Basic
  Standard
  Verified
  Steward
}

/// pNFT Datum — complete identity
pub type PnftDatum {
  pnft_id: ByteArray,
  owner: VerificationKeyHash,
  level: VerificationLevel,
  bioregion: Option<ByteArray>,
  dna_hash: Option<ByteArray>,
  created_at: Int,
  upgraded_at: Option<Int>,
  
  // Stake portfolio
  stake_portfolio: StakePortfolio,
  
  // Impact tracking
  lifetime_impact: Int,
  cycle_impact: Int,
  impact_by_category: List<(ImpactCategory, Int)>,
  
  // Surveyor credentials
  surveyor_certification: Option<SurveyorCert>,
  survey_regions: List<ByteArray>,
  
  // Land stewardship
  lands_stewarded: List<ByteArray>,
  
  // Labor history summary
  labor_hours_lifetime: Int,
  labor_sectors: List<EconomicSector>,
  
  // Resource custody active
  resources_in_custody: List<ByteArray>,
}

/// Stake portfolio
pub type StakePortfolio {
  total_staked: Int,
  home_bioregion_stake: Int,
  external_stakes: List<ExternalStake>,
  home_percentage: Int,
  pending_rewards: Int,
  last_claim_epoch: Int,
}

/// External stake
pub type ExternalStake {
  bioregion: ByteArray,
  pool_id: ByteArray,
  amount: Int,
  locked_until_epoch: Option<Int>,
}

/// Surveyor certification
pub type SurveyorCert {
  cert_type: SurveyorType,
  issued_by: ByteArray,
  issued_at: Int,
  expires_at: Int,
  specializations: List<ImpactCategory>,
  surveys_completed: Int,
  accuracy_score: Int,
}

/// Surveyor types
pub type SurveyorType {
  BiodiversitySurveyor
  SoilSurveyor
  WaterSurveyor
  CarbonSurveyor
  EcosystemSurveyor
  TEKHolder
}

// =============================================================================
// PART 8: TRANSACTION TYPES — COMPLETE COVERAGE
// =============================================================================

/// Transaction metadata — IMPACT IS MANDATORY
pub type TransactionMeta {
  tx_type: TransactionType,
  impacts: List<Impact>,
  evidence_hash: ByteArray,
  attestors: List<AssetName>,
  measured_at: Int,
  // New: sector classification
  sector: EconomicSector,
  // New: resource references (if applicable)
  resources: Option<List<ByteArray>>,
  // New: land reference (if applicable)
  land_id: Option<ByteArray>,
}

/// Transaction types
pub type TransactionType {
  // === LABOR ===
  Labor {
    labor_type: LaborType,
    hours: Int,
    land_id: Option<ByteArray>,
  }
  
  // === GOODS ===
  Goods {
    resource_id: ByteArray,
    quantity: Int,
    unit: ByteArray,
  }
  
  // === SERVICES ===
  Services {
    service_code: ByteArray,
  }
  
  // === LAND RIGHTS ===
  LandRightTransfer {
    land_id: ByteArray,
    right_type: RightType,
    duration: Option<Int>,
  }
  
  // === RESOURCE ===
  ResourceTransfer {
    resource_id: ByteArray,
    quantity: Int,
    custody_action: CustodyAction,
  }
  
  // === FINANCIAL ===
  Gift
  Investment {
    terms_hash: ByteArray,
  }
  Loan {
    terms_hash: ByteArray,
    interest_rate: Int,
  }
  
  // === REMEDIATION ===
  Remediation {
    bond_id: ByteArray,
    impact_tokens: List<AssetName>,
  }
  
  // === SYSTEM ===
  UBI {
    cycle: Int,
  }
  GovernanceReward {
    proposal_id: ByteArray,
  }
  StakeReward {
    pool_id: ByteArray,
    epoch: Int,
  }
  ImpactTrade {
    impact_token_id: ByteArray,
    direction: TradeDirection,
  }
  
  Internal
}

/// Right types for transfer
pub type RightType {
  SurfaceRight
  SubsurfaceRight
  WaterRight
  AirRight
  CelluloseRight
  DevelopmentRight
  CarbonRight
  AccessRight
}

/// Trade direction
pub type TradeDirection {
  Buy
  Sell
}

// =============================================================================
// PART 9: BIOREGION — COMPLETE STATE
// =============================================================================

/// Bioregion Datum — complete bioregional state
pub type BioregionDatum {
  bioregion_id: ByteArray,
  name_hash: ByteArray,
  bounds_hash: ByteArray,
  health_index: Int,
  resident_count: Int,
  treasury: ByteArray,
  created_at: Int,
  last_health_update: Int,
  
  // Stake pool economics
  stake_pools: List<BioregionPool>,
  total_staked: Int,
  resident_stake: Int,
  external_stake: Int,
  current_epoch: Int,
  cumulative_impact: Int,
  tx_velocity: Int,
  
  // Preservation metrics
  preserved_area: Int,
  active_grants: Int,
  preservation_distributed: Int,
  surveyor_count: Int,
  surveys_this_cycle: Int,
  average_ecosystem_health: Int,
  health_trend: HealthTrend,
  
  // Biodiversity indicators
  documented_species: Int,
  connectivity_score: Int,
  native_ratio: Int,
  restoration_projects: Int,
  
  // Land registry
  total_land_area: Int,
  lands_registered: Int,
  stewarded_percentage: Int,
  
  // Economic sectors
  sector_stats: List<SectorStats>,
  
  // UBI parameters
  ubi_params: UBIParameters,
  
  // Cost of living
  cost_of_living: CostOfLivingData,
  
  // Carrying capacity
  carrying_capacity: Int,
  resource_abundance: Int,
  
  // Traditional territories
  traditional_territories: List<ByteArray>,
  cultural_protocols_required: Bool,
}

/// Bioregion stake pool
pub type BioregionPool {
  pool_id: ByteArray,
  operator_pnft: AssetName,
  ultralife_stake: Int,
  impact_commitment: PoolImpactCommitment,
  registered_at: Int,
  active: Bool,
  margin: Int,
  min_delegation: Int,
}

/// Pool impact commitment
pub type PoolImpactCommitment {
  renewable_energy: Bool,
  carbon_footprint: Int,
  treasury_contribution: Int,
  local_reinvestment: Int,
  evidence_hash: ByteArray,
}

// =============================================================================
// PART 10: TREASURY — ECONOMIC HUB
// =============================================================================

/// Treasury datum — complete economic hub
pub type TreasuryDatum {
  bioregion: ByteArray,
  
  // Token reserves
  token_reserves: Int,
  ada_reserves: Int,
  
  // Distributed totals
  tokens_distributed: Int,
  ubi_distributed: Int,
  grants_distributed: Int,
  preservation_distributed: Int,
  
  // Exchange and rates
  exchange_rate: Int,
  pool_reward_share: Int,
  
  // Governance
  multisig: MultisigConfig,
  
  // Fund allocations
  ubi_fund: Int,
  impact_fund: Int,
  preservation_fund: Int,
  survey_fund: Int,
  emergency_fund: Int,
  development_fund: Int,
  
  // Incoming flows tracking
  incoming_from_transactions: Int,
  incoming_from_remediation: Int,
  incoming_from_land_fees: Int,
  incoming_from_pools: Int,
}

/// Multisig configuration
pub type MultisigConfig {
  threshold: Int,
  signers: List<AssetName>,
}

// =============================================================================
// PART 11: HELPER FUNCTIONS
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

/// Check if level can steward land
pub fn can_steward_land(level: VerificationLevel) -> Bool {
  level == Verified || level == Steward
}

/// Calculate net impact
pub fn calculate_net_impact(impacts: List<Impact>) -> Int {
  list.foldl(impacts, 0, fn(impact, acc) {
    let weighted = impact.magnitude * impact.confidence / 100
    acc + weighted
  })
}

/// Check if impacts require remediation
pub fn requires_remediation(impacts: List<Impact>) -> Bool {
  calculate_net_impact(impacts) < 0
}

/// Calculate UBI for a person
pub fn calculate_ubi(
  params: UBIParameters,
  participation: Int,
  impact: Int,
  level: VerificationLevel,
) -> Int {
  let base = params.base_ubi
  let health_effect = base * params.health_modifier / 10000
  let participation_effect = base * participation * params.participation_modifier / 1000000
  let impact_effect = impact * params.impact_modifier / 100
  let level_bonus = when level is {
    Basic -> 0
    Standard -> params.level_bonus
    Verified -> params.level_bonus * 2
    Steward -> params.level_bonus * 3
  }
  
  let calculated = base + health_effect + participation_effect + impact_effect + level_bonus
  
  // Apply constraints
  let constrained = if calculated > params.max_payout {
    params.max_payout
  } else if calculated < params.min_guaranteed {
    params.min_guaranteed
  } else {
    calculated
  }
  
  constrained
}

/// Calculate basic needs coverage percentage
pub fn basic_needs_coverage(ubi_amount: Int, basic_needs: Int) -> Int {
  if basic_needs > 0 {
    ubi_amount * 10000 / basic_needs
  } else {
    10000  // 100% if no needs calculated
  }
}

// Import list
use aiken/collection/list

// =============================================================================
// END OF COMPLETE INTEGRATED TYPE SYSTEM
// =============================================================================
//
// This type system enables:
//
// 1. LAND RIGHTS: Surface, subsurface, water, air, cellulose all separate
//    and transferable, each carrying impact responsibilities
//
// 2. LABOR DIGNITY: Every type of work recognized and tracked, from
//    agriculture to care work to traditional knowledge keeping
//
// 3. RESOURCE TRACKING: Complete lifecycle from extraction through
//    consumption to return (recycle/compost/dispose)
//
// 4. IMPACT ACCOUNTING: Universal, mandatory, physical — no neutral
//
// 5. UBI CALCULATION: Based on real transaction data for food and
//    housing costs, bioregion health, and individual participation
//
// 6. ECONOMIC SECTORS: Remapped to show true flows and impacts,
//    including the crucial "return" sector (waste, recycling, restoration)
//
// 7. BIDIRECTIONAL FLOW: Information flows forward through supply chain
//    AND backward through return chain, enabling true circular economy
//
// 8. EXTRATERRESTRIAL READY: Same principles apply on any terrestrial
//    body — bioregions, carrying capacity, resource stewardship
//
// The result: A complete parallel economy where carbon-based life
// can live in abundance, with full accountability for consequences.
//
// =============================================================================
