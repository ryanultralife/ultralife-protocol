// =============================================================================
// UltraLife Protocol — Commons
// =============================================================================
//
// PUBLIC GOODS AND SHARED RESOURCES
//
// Some things belong to everyone within a bioregion:
// - Roads, bridges, infrastructure
// - Fire departments, emergency services
// - Public spaces, parks, commons
// - Wildlife (migratory, cross-boundary)
// - Water systems (rivers, aquifers)
// - Air quality (shared atmosphere)
//
// These are funded by the bioregion treasury and operated by collectives
// of pNFT holders. There is no "government" separate from people -
// just humans organizing to provide shared services.
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId, AssetName, Value, quantity_of}
use cardano/transaction.{
  Transaction, Input, Output, OutputReference,
  InlineDatum,
}

// =============================================================================
// TYPES
// =============================================================================

/// Types of commons
pub type CommonsType {
  /// Physical infrastructure (roads, bridges, utilities)
  Infrastructure {
    infra_type: InfraType,
  }
  /// Emergency services (fire, medical, rescue)
  EmergencyService {
    service_type: EmergencyType,
  }
  /// Public spaces (parks, plazas, community centers)
  PublicSpace {
    space_type: SpaceType,
  }
  /// Shared natural resources (wildlife, water, air)
  NaturalCommons {
    resource_type: NaturalCommonsType,
  }
  /// Essential utilities (water, energy, communication)
  Utility {
    utility_type: UtilityType,
  }
  /// Healthcare facilities
  Healthcare {
    facility_type: HealthcareType,
  }
  /// Education facilities
  Education {
    facility_type: EducationType,
  }
}

/// Infrastructure types
pub type InfraType {
  Road
  Bridge
  PublicTransit
  WaterSystem
  SewerSystem
  StormDrain
  ElectricGrid
  CommunicationNetwork
  WasteProcessing
}

/// Emergency service types
pub type EmergencyType {
  FireService
  MedicalEmergency
  SearchRescue
  DisasterResponse
  CrisisIntervention
}

/// Public space types
pub type SpaceType {
  Park
  Plaza
  CommunityCenter
  Library
  PublicMarket
  Playground
  TrailSystem
  PublicBeach
  PublicForest
}

/// Natural commons types
pub type NaturalCommonsType {
  /// Wildlife that crosses boundaries
  WildlifeCorridors
  /// Migratory species
  MigratorySpecies {
    species_type: ByteArray,
  }
  /// Shared water bodies
  SharedWaterBody {
    water_type: WaterBodyType,
  }
  /// Air quality zone
  AirQualityZone
  /// Aquifer
  SharedAquifer
}

/// Water body types
pub type WaterBodyType {
  River
  Lake
  Estuary
  Wetland
  Coast
}

/// Utility types
pub type UtilityType {
  WaterSupply
  WastewaterTreatment
  ElectricDistribution
  NaturalGas
  SolidWasteCollection
  Recycling
  Composting
  Internet
}

/// Healthcare facility types
pub type HealthcareType {
  Hospital
  Clinic
  EmergencyRoom
  MentalHealth
  RehabilitationCenter
  BirthCenter
  Hospice
}

/// Education facility types
pub type EducationType {
  PrimarySchool
  SecondarySchool
  TradeSchool
  CommunityCollege
  University
  Library
  ResearchCenter
  FieldSchool
}

/// Commons Datum — tracks a shared resource
pub type CommonsDatum {
  /// Unique identifier
  commons_id: ByteArray,
  /// Bioregion this commons serves
  bioregion: ByteArray,
  /// Sub-regions also served (for larger commons)
  sub_regions: List<ByteArray>,
  /// Type of commons
  commons_type: CommonsType,
  /// Human-readable name
  name: ByteArray,
  /// Description
  description: ByteArray,
  /// Physical location (Land NFT reference if applicable)
  location: Option<ByteArray>,
  /// Operating collective (who runs this)
  operating_collective: Option<ByteArray>,
  /// Workers (pNFTs employed in this commons)
  workers: List<CommonsWorker>,
  /// Funding source allocation (from treasury)
  annual_allocation: Int,
  /// Current cycle funding received
  current_funding: Int,
  /// Expenses this cycle
  current_expenses: Int,
  /// Service metrics
  metrics: CommonsMetrics,
  /// Established timestamp
  established_at: Int,
  /// Last activity
  last_activity: Int,
  /// Is active
  is_active: Bool,
}

/// Worker in a commons
pub type CommonsWorker {
  /// Worker pNFT
  pnft: AssetName,
  /// Role
  role: ByteArray,
  /// Hours per cycle (expected)
  hours_per_cycle: Int,
  /// Wage per hour
  hourly_wage: Int,
  /// When started
  started_at: Int,
}

/// Service metrics for commons
pub type CommonsMetrics {
  /// People served this cycle
  people_served: Int,
  /// Service events this cycle
  service_events: Int,
  /// Response time (if applicable, in minutes)
  avg_response_time: Option<Int>,
  /// Satisfaction score (0-100)
  satisfaction_score: Int,
  /// Capacity utilization (0-100)
  capacity_utilization: Int,
  /// Environmental impact (net)
  environmental_impact: Int,
}

/// Extraction permit for natural commons
pub type ExtractionPermit {
  /// Permit ID
  permit_id: ByteArray,
  /// Holder pNFT
  holder: AssetName,
  /// Commons this permits extraction from
  commons_id: ByteArray,
  /// What can be extracted
  extraction_type: ExtractionType,
  /// Quantity limit
  quantity_limit: Int,
  /// Unit
  unit: ByteArray,
  /// Valid from
  valid_from: Int,
  /// Valid until
  valid_until: Int,
  /// Quantity extracted so far
  quantity_extracted: Int,
  /// Fee paid
  fee_paid: Int,
  /// Is active
  is_active: Bool,
}

/// Types of extraction from natural commons
pub type ExtractionType {
  /// Hunting specific species
  Hunting {
    species: ByteArray,
    method: ByteArray,
  }
  /// Fishing
  Fishing {
    species: ByteArray,
    method: ByteArray,
  }
  /// Water withdrawal
  WaterWithdrawal {
    use_type: ByteArray,
  }
  /// Foraging
  Foraging {
    item_type: ByteArray,
  }
  /// Timber harvest (from commons forest)
  TimberHarvest {
    species: ByteArray,
    method: ByteArray,
  }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type CommonsConfig {
  /// pNFT policy
  pnft_policy: PolicyId,
  /// Token policy
  token_policy: PolicyId,
  /// Treasury contract (funding source)
  treasury_script: ByteArray,
  /// Bioregion registry
  bioregion_registry: ByteArray,
  /// Minimum workers for operating collective
  min_workers: Int,
  /// Governance contract
  governance_script: ByteArray,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type CommonsRedeemer {
  /// Establish a new commons
  EstablishCommons {
    commons_type: CommonsType,
    name: ByteArray,
    description: ByteArray,
    location: Option<ByteArray>,
  }
  
  /// Assign operating collective
  AssignOperator {
    collective_id: ByteArray,
  }
  
  /// Add worker
  AddWorker {
    worker: CommonsWorker,
  }
  
  /// Remove worker
  RemoveWorker {
    worker_pnft: AssetName,
  }
  
  /// Receive funding from treasury
  ReceiveFunding {
    amount: Int,
    cycle: Int,
  }
  
  /// Pay worker wages
  PayWages {
    worker_pnft: AssetName,
    hours_worked: Int,
  }
  
  /// Pay expense
  PayExpense {
    to: AssetName,
    amount: Int,
    purpose: ByteArray,
  }
  
  /// Record service event
  RecordService {
    service_type: ByteArray,
    people_served: Int,
    response_time: Option<Int>,
  }
  
  /// Update metrics
  UpdateMetrics {
    new_metrics: CommonsMetrics,
  }
  
  /// Issue extraction permit
  IssuePermit {
    holder: AssetName,
    extraction_type: ExtractionType,
    quantity_limit: Int,
    duration_cycles: Int,
    fee: Int,
  }
  
  /// Record extraction
  RecordExtraction {
    permit_id: ByteArray,
    quantity: Int,
    location: ByteArray,
  }
  
  /// Revoke permit (for violation)
  RevokePermit {
    permit_id: ByteArray,
    reason: ByteArray,
  }
  
  /// Decommission commons
  Decommission {
    reason: ByteArray,
  }
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator commons(config: CommonsConfig) {
  spend(
    datum: CommonsDatum,
    redeemer: CommonsRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      // =========================================================================
      // ESTABLISH COMMONS (governance must approve)
      // =========================================================================
      EstablishCommons { commons_type, name, description, location } -> {
        // 1. Must be authorized by bioregion governance
        let governance_approved = verify_governance_approval(tx, config)
        
        // 2. Valid commons type
        let valid_type = verify_valid_commons_type(commons_type)
        
        // 3. Creates proper datum
        let creates_datum = verify_commons_created(
          tx, own_ref, commons_type, name, description, location
        )
        
        governance_approved && valid_type && creates_datum
      }
      
      // =========================================================================
      // RECEIVE FUNDING (from treasury)
      // =========================================================================
      ReceiveFunding { amount, cycle } -> {
        // 1. Funding comes from treasury
        let from_treasury = verify_from_treasury(tx, config, amount)
        
        // 2. Within allocation
        let within_allocation = amount <= datum.annual_allocation
        
        // 3. Updates datum correctly
        let updates_correctly = verify_funding_received(tx, own_ref, datum, amount)
        
        from_treasury && within_allocation && updates_correctly
      }
      
      // =========================================================================
      // PAY WAGES (workers get paid)
      // =========================================================================
      PayWages { worker_pnft, hours_worked } -> {
        // 1. Worker is registered
        expect Some(worker) = list.find(datum.workers, fn(w) { w.pnft == worker_pnft })
        
        // 2. Operating collective approves (or worker self-reports with limit)
        let authorized = verify_wage_authorized(tx, datum, worker_pnft, hours_worked, config)
        
        // 3. Calculate pay
        let pay_amount = hours_worked * worker.hourly_wage
        
        // 4. Sufficient funds
        let sufficient_funds = pay_amount <= datum.current_funding - datum.current_expenses
        
        // 5. Payment made correctly
        let payment_made = verify_payment_to_pnft(tx, worker_pnft, pay_amount, config)
        
        // 6. Updates expenses
        let updates_expenses = verify_expense_recorded(tx, own_ref, datum, pay_amount)
        
        authorized && sufficient_funds && payment_made && updates_expenses
      }
      
      // =========================================================================
      // ISSUE EXTRACTION PERMIT
      // =========================================================================
      IssuePermit { holder, extraction_type, quantity_limit, duration_cycles, fee } -> {
        // 1. This is a natural commons
        let is_natural = is_natural_commons(datum.commons_type)
        
        // 2. Extraction type is allowed for this commons
        let extraction_allowed = verify_extraction_allowed(datum, extraction_type)
        
        // 3. Within sustainable limits
        let within_limits = verify_sustainable_limit(datum, extraction_type, quantity_limit)
        
        // 4. Fee paid
        let fee_paid = verify_fee_paid(tx, fee, config)
        
        // 5. Holder has valid pNFT
        let holder_valid = verify_pnft_exists(tx.reference_inputs, holder, config.pnft_policy)
        
        // 6. Creates permit datum
        let creates_permit = verify_permit_created(
          tx, holder, extraction_type, quantity_limit, duration_cycles, fee
        )
        
        is_natural && extraction_allowed && within_limits && 
        fee_paid && holder_valid && creates_permit
      }
      
      // =========================================================================
      // RECORD EXTRACTION (permit holder reports)
      // =========================================================================
      RecordExtraction { permit_id, quantity, location } -> {
        // Would find and validate permit, check limits, record extraction
        // Impact recorded for the extraction
        True // Simplified
      }
      
      // =========================================================================
      // RECORD SERVICE (for metrics)
      // =========================================================================
      RecordService { service_type, people_served, response_time } -> {
        // Authorized by operating collective
        let authorized = verify_collective_authorized(tx, datum, config)
        
        // Updates metrics
        let updates_metrics = verify_service_recorded(
          tx, own_ref, datum, service_type, people_served, response_time
        )
        
        authorized && updates_metrics
      }
      
      _ -> {
        // Other redeemers follow similar patterns
        verify_collective_authorized(tx, datum, config)
      }
    }
  }
}

// =============================================================================
// HELPER FUNCTIONS (stubs)
// =============================================================================

fn verify_governance_approval(tx: Transaction, config: CommonsConfig) -> Bool { True }
fn verify_valid_commons_type(commons_type: CommonsType) -> Bool { True }
fn verify_commons_created(tx: Transaction, own_ref: OutputReference, commons_type: CommonsType, name: ByteArray, desc: ByteArray, loc: Option<ByteArray>) -> Bool { True }
fn verify_from_treasury(tx: Transaction, config: CommonsConfig, amount: Int) -> Bool { True }
fn verify_funding_received(tx: Transaction, own_ref: OutputReference, datum: CommonsDatum, amount: Int) -> Bool { True }
fn verify_wage_authorized(tx: Transaction, datum: CommonsDatum, worker: AssetName, hours: Int, config: CommonsConfig) -> Bool { True }
fn verify_payment_to_pnft(tx: Transaction, pnft: AssetName, amount: Int, config: CommonsConfig) -> Bool { True }
fn verify_expense_recorded(tx: Transaction, own_ref: OutputReference, datum: CommonsDatum, amount: Int) -> Bool { True }
fn is_natural_commons(commons_type: CommonsType) -> Bool {
  when commons_type is {
    NaturalCommons { .. } -> True
    _ -> False
  }
}
fn verify_extraction_allowed(datum: CommonsDatum, extraction_type: ExtractionType) -> Bool { True }
fn verify_sustainable_limit(datum: CommonsDatum, extraction_type: ExtractionType, limit: Int) -> Bool { True }
fn verify_fee_paid(tx: Transaction, fee: Int, config: CommonsConfig) -> Bool { True }
fn verify_pnft_exists(refs: List<Input>, pnft: AssetName, policy: PolicyId) -> Bool { True }
fn verify_permit_created(tx: Transaction, holder: AssetName, et: ExtractionType, limit: Int, dur: Int, fee: Int) -> Bool { True }
fn verify_collective_authorized(tx: Transaction, datum: CommonsDatum, config: CommonsConfig) -> Bool { True }
fn verify_service_recorded(tx: Transaction, own_ref: OutputReference, datum: CommonsDatum, st: ByteArray, ps: Int, rt: Option<Int>) -> Bool { True }
