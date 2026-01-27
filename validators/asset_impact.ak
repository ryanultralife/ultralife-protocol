// =============================================================================
// UltraLife Protocol — Asset Impact
// =============================================================================
//
// IMPACT ACCUMULATION: Compounds flow to assets, then to consumers
//
// The flow:
// 1. Work is performed on asset → compound flows recorded
// 2. Asset accumulates all compound flows through its lifecycle
// 3. Consumer purchases asset → ALL accumulated compounds transfer to consumer
// 4. Consumer is now accountable for production impacts
//
// This is the mechanism that makes consumer demand drive accountability.
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId, AssetName, Value, quantity_of}
use cardano/transaction.{Transaction, Input, Output, OutputReference, InlineDatum}
use ultralife/types.{
  PnftDatum, VerificationLevel, Steward,
  CompoundFlow, CompoundCode, MassUnit, CompoundBalance,
  AssetActivityRecord, AssetImpactHistory, ImpactTransferRecord,
  ConsumerImpactRecord,
}

// =============================================================================
// DATUM TYPES
// =============================================================================

/// Asset impact datum — tracks accumulated compounds
pub type AssetImpactDatum {
  /// Single asset history
  AssetHistory(AssetImpactHistory)
  /// Transfer record (for audit trail)
  TransferRecord(ImpactTransferRecord)
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type AssetImpactRedeemer {
  // === Recording ===
  /// Initialize impact tracking for an asset
  InitializeAsset {
    asset_id: AssetName,
    asset_type: AssetType,
    initial_owner: AssetName,
  }
  
  /// Record activity impacts to asset (called by work_auction)
  RecordActivity {
    asset_id: AssetName,
    activity: AssetActivityRecord,
  }
  
  /// Batch record multiple activities
  RecordActivities {
    asset_id: AssetName,
    activities: List<AssetActivityRecord>,
  }
  
  // === Transfer ===
  /// Transfer accumulated impacts to consumer on purchase
  TransferToConsumer {
    asset_id: AssetName,
    consumer_pnft: AssetName,
    purchase_tx_hash: ByteArray,
  }
  
  // === Query (spending for proof) ===
  /// Prove accumulated impacts for an asset
  ProveImpacts {
    asset_id: AssetName,
  }
  
  // === Corrections ===
  /// Correct recorded impacts (requires governance approval)
  CorrectImpacts {
    asset_id: AssetName,
    correction: ImpactCorrection,
    governance_approval: ByteArray,
  }
}

/// Type of asset being tracked
pub type AssetType {
  /// Land parcel
  Land { land_nft: AssetName }
  /// Building/structure on land
  Structure { land_nft: AssetName, structure_id: ByteArray }
  /// Manufactured product
  Product { product_code: ByteArray, batch_id: ByteArray }
  /// Agricultural output
  Harvest { land_nft: AssetName, crop_type: ByteArray, harvest_id: ByteArray }
  /// Generic tracked asset
  Generic { category: ByteArray }
  
  // === MACHINERY & VEHICLES ===
  /// Vehicle (car, truck, boat, plane, etc.)
  Vehicle { 
    vin_hash: ByteArray,          // Vehicle ID hash
    vehicle_class: VehicleClass,
    manufacturer: AssetName,      // Manufacturer's pNFT
    model_spec: ByteArray,        // Model specification hash
  }
  /// Heavy machinery (construction, mining, agriculture)
  Machinery {
    serial_hash: ByteArray,       // Serial number hash
    machinery_class: MachineryClass,
    manufacturer: AssetName,
    model_spec: ByteArray,
  }
  /// Equipment (generators, tools, industrial)
  Equipment {
    serial_hash: ByteArray,
    equipment_type: ByteArray,
    manufacturer: AssetName,
  }
}

/// Vehicle classification
pub type VehicleClass {
  /// Passenger car
  PassengerCar { seats: Int, fuel_type: FuelType }
  /// Light truck/SUV
  LightTruck { payload_kg: Int, fuel_type: FuelType }
  /// Heavy truck
  HeavyTruck { payload_kg: Int, axles: Int, fuel_type: FuelType }
  /// Bus
  Bus { capacity: Int, fuel_type: FuelType }
  /// Motorcycle
  Motorcycle { engine_cc: Int, fuel_type: FuelType }
  /// Boat/ship
  Watercraft { displacement_tons: Int, fuel_type: FuelType }
  /// Aircraft
  Aircraft { aircraft_type: ByteArray, fuel_type: FuelType }
  /// Rail
  Rail { rail_type: ByteArray }
}

/// Machinery classification  
pub type MachineryClass {
  /// Excavator
  Excavator { bucket_m3: Int, operating_weight_kg: Int }
  /// Bulldozer
  Bulldozer { blade_width_m: Int, operating_weight_kg: Int }
  /// Crane
  Crane { lift_capacity_kg: Int, boom_length_m: Int }
  /// Tractor (agricultural)
  Tractor { horsepower: Int, pto_type: ByteArray }
  /// Harvester
  Harvester { harvest_type: ByteArray, capacity: Int }
  /// Generator
  Generator { output_kw: Int, fuel_type: FuelType }
  /// Compressor
  Compressor { cfm: Int, pressure_psi: Int }
  /// Mining equipment
  Mining { equipment_type: ByteArray, capacity: Int }
  /// Generic industrial
  Industrial { category: ByteArray }
}

/// Fuel/energy type
pub type FuelType {
  Gasoline
  Diesel
  NaturalGas
  LPG
  Electric
  Hybrid { primary: ByteArray }
  Hydrogen
  Biodiesel
  Ethanol
  Other { fuel_code: ByteArray }
}

// =============================================================================
// EMBODIED IMPACT (Manufacturing)
// =============================================================================

/// Embodied impact from manufacturing - recorded at asset creation
pub type EmbodiedImpact {
  /// Total manufacturing impact (all compounds)
  manufacturing_compounds: List<CompoundBalance>,
  /// Material extraction impacts
  extraction_compounds: List<CompoundBalance>,
  /// Transport to point of sale
  transport_compounds: List<CompoundBalance>,
  /// Total embodied impact (sum of above)
  total_embodied: List<CompoundBalance>,
  /// Estimated lifespan (hours for machinery, km for vehicles)
  expected_lifespan: Int,
  /// Amortization unit (per_hour, per_km, per_cycle)
  amortization_unit: AmortizationUnit,
  /// Manufacturing date slot
  manufactured_at: Int,
  /// Manufacturing location bioregion
  manufacturing_bioregion: ByteArray,
  /// Manufacturer certification/attestation
  manufacturer_attestation: ByteArray,
}

pub type AmortizationUnit {
  PerHour
  PerKilometer
  PerMile
  PerCycle
  PerUnit
}

/// Operational impact record (per use)
pub type OperationalImpact {
  /// Usage amount (hours, km, cycles)
  usage_amount: Int,
  usage_unit: AmortizationUnit,
  /// Fuel/energy consumed
  fuel_consumed: Int,
  fuel_unit: ByteArray,
  fuel_type: FuelType,
  /// Direct emissions from this operation
  operational_compounds: List<CompoundFlow>,
  /// Amortized embodied impact for this usage
  amortized_embodied: List<CompoundFlow>,
  /// Operator pNFT
  operator: AssetName,
  /// Operation timestamp
  operation_slot: Int,
  /// Operation location (bioregion)
  operation_bioregion: ByteArray,
}

// =============================================================================
// MACHINERY COMPARISON & FLEET ANALYSIS
// =============================================================================

/// Machinery specification for comparison
pub type MachinerySpec {
  /// Asset ID
  asset_id: AssetName,
  /// Asset type
  asset_type: AssetType,
  /// Embodied impact
  embodied: EmbodiedImpact,
  /// Lifetime operational stats
  lifetime_stats: LifetimeStats,
  /// Current condition (0-10000 basis points = 0-100%)
  condition_bps: Int,
  /// Remaining useful life estimate
  remaining_life: Int,
  /// Replacement cost (ULTRA)
  replacement_cost: Int,
}

/// Lifetime statistics for machinery
pub type LifetimeStats {
  /// Total usage (hours/km)
  total_usage: Int,
  /// Total fuel consumed
  total_fuel: Int,
  /// Total operational emissions
  total_operational: List<CompoundBalance>,
  /// Total amortized embodied
  amortized_to_date: List<CompoundBalance>,
  /// Remaining embodied to amortize
  remaining_embodied: List<CompoundBalance>,
  /// Maintenance events
  maintenance_count: Int,
  /// Major repairs
  repair_count: Int,
}

/// Fleet comparison result
pub type FleetComparison {
  /// Fleet identifier
  fleet_id: ByteArray,
  /// Total machines
  machine_count: Int,
  /// By category
  by_category: List<(ByteArray, Int)>,
  /// Total embodied impact (all machines)
  total_embodied: List<CompoundBalance>,
  /// Total operational impact (lifetime)
  total_operational: List<CompoundBalance>,
  /// Average impact per machine
  avg_per_machine: List<CompoundBalance>,
  /// Impact per usage unit (efficiency)
  impact_per_unit: List<CompoundBalance>,
  /// Replacement recommendations
  recommendations: List<ReplacementRecommendation>,
}

/// Replacement vs repair recommendation
pub type ReplacementRecommendation {
  /// Machine asset ID
  machine_id: AssetName,
  /// Action recommended
  action: RecommendedAction,
  /// Impact savings if replaced
  impact_savings: List<CompoundBalance>,
  /// Cost (ULTRA)
  cost: Int,
  /// Payback period (epochs)
  payback_epochs: Int,
  /// Remaining embodied that would be "wasted"
  wasted_embodied: List<CompoundBalance>,
}

pub type RecommendedAction {
  /// Keep operating
  Continue
  /// Schedule maintenance
  Maintain { maintenance_type: ByteArray }
  /// Replace with newer model
  Replace { new_model: ByteArray, efficiency_gain_bps: Int }
  /// Repair specific component
  Repair { component: ByteArray, extends_life: Int }
  /// Retire and scrap
  ActionRetire { scrap_value: Int }
}

/// Impact correction (requires governance)
pub type ImpactCorrection {
  /// Adjust specific compound
  AdjustCompound {
    compound: CompoundCode,
    adjustment: Int,
    reason: ByteArray,
  }
  /// Remove erroneous activity
  RemoveActivity {
    activity_index: Int,
    reason: ByteArray,
  }
  /// Add missing activity
  AddActivity {
    activity: AssetActivityRecord,
    reason: ByteArray,
  }
}

// =============================================================================
// MACHINERY-SPECIFIC REDEEMERS
// =============================================================================

pub type MachineryRedeemer {
  /// Register new machinery with embodied impact
  RegisterMachinery {
    asset_type: AssetType,
    embodied: EmbodiedImpact,
    owner: AssetName,
    purchase_price: Int,
  }
  
  /// Record operational use (fuel, hours, emissions)
  RecordOperation {
    machine_id: AssetName,
    operation: OperationalImpact,
  }
  
  /// Record maintenance event
  RecordMaintenance {
    machine_id: AssetName,
    maintenance_type: ByteArray,
    parts_replaced: List<ByteArray>,
    impact: List<CompoundFlow>,
    extends_life: Int,
  }
  
  /// Transfer machinery ownership
  TransferMachinery {
    machine_id: AssetName,
    from_owner: AssetName,
    to_owner: AssetName,
    sale_price: Int,
    // Remaining embodied transfers to new owner
  }
  
  /// Retire/scrap machinery
  RetireMachinery {
    machine_id: AssetName,
    scrap_compounds: List<CompoundFlow>,  // Recycling impact
    remaining_embodied: List<CompoundBalance>,  // "Wasted" embodied
    scrap_value: Int,
  }
  
  /// Compare fleet efficiency
  CompareFleet {
    fleet_id: ByteArray,
    machine_ids: List<AssetName>,
  }
  
  /// Generate replacement recommendation
  GetRecommendation {
    machine_id: AssetName,
    available_replacements: List<MachinerySpec>,
  }
}

// =============================================================================
// MACHINERY NFT SYSTEM
// =============================================================================
//
// Machinery gets its OWN NFT when manufacturing is complete.
// The NFT carries ALL accumulated impact from the supply chain:
// - Raw material extraction (mining, harvesting)
// - Processing (refining, smelting)
// - Component manufacturing (parts, subassemblies)
// - Final assembly
// - Transport to point of sale
//
// This NFT is separate from pNFTs - it's an ASSET NFT.
//
// =============================================================================

/// Machinery NFT datum - minted when machine is complete
pub type MachineryNftDatum {
  /// Unique machine identifier (derived from serial + manufacturer)
  machine_id: ByteArray,
  /// Machine classification
  machine_type: AssetType,
  /// Manufacturer's pNFT
  manufacturer: AssetName,
  /// Manufacturing completion slot
  manufactured_at: Int,
  /// Manufacturing location bioregion
  manufacturing_bioregion: ByteArray,
  
  // === ACCUMULATED SUPPLY CHAIN IMPACT ===
  /// All impact from extraction through completion
  supply_chain_impact: SupplyChainImpact,
  
  // === OWNERSHIP & LIFECYCLE ===
  /// Current owner pNFT
  current_owner: AssetName,
  /// Ownership history
  ownership_transfers: Int,
  /// Operational stats
  lifetime_stats: LifetimeStats,
  /// Current condition (0-10000 = 0-100%)
  condition_bps: Int,
}

/// Complete supply chain impact - accumulated before NFT minting
pub type SupplyChainImpact {
  // === EXTRACTION PHASE ===
  /// Raw material extraction (ore, oil, timber, etc.)
  extraction: List<MaterialImpact>,
  
  // === PROCESSING PHASE ===
  /// Material processing (refining, smelting, milling)
  processing: List<ProcessingImpact>,
  
  // === COMPONENT PHASE ===
  /// Component manufacturing
  components: List<ComponentImpact>,
  
  // === ASSEMBLY PHASE ===
  /// Final assembly
  assembly: AssemblyImpact,
  
  // === TRANSPORT ===
  /// Transport between phases + to point of sale
  transport: List<TransportImpact>,
  
  // === TOTALS ===
  /// Total embodied impact (sum of all phases)
  total_embodied: List<CompoundBalance>,
  /// Data completeness score (0-10000 = 0-100%)
  data_completeness_bps: Int,
}

/// Impact from material extraction
pub type MaterialImpact {
  /// Material type (iron_ore, copper_ore, bauxite, crude_oil, etc.)
  material_code: ByteArray,
  /// Quantity extracted
  quantity: Int,
  quantity_unit: ByteArray,
  /// Extraction location
  extraction_bioregion: ByteArray,
  /// Extractor pNFT (mining company, etc.)
  extractor: AssetName,
  /// Compound impacts from extraction
  compounds: List<CompoundFlow>,
  /// Extraction timestamp
  extracted_at: Int,
}

/// Impact from material processing
pub type ProcessingImpact {
  /// Process type (smelting, refining, milling, etc.)
  process_code: ByteArray,
  /// Input materials (references MaterialImpact)
  input_materials: List<ByteArray>,
  /// Output material
  output_material: ByteArray,
  output_quantity: Int,
  /// Processor pNFT
  processor: AssetName,
  /// Processing location
  processing_bioregion: ByteArray,
  /// Compound impacts from processing
  compounds: List<CompoundFlow>,
  /// Processing timestamp
  processed_at: Int,
}

/// Impact from component manufacturing
pub type ComponentImpact {
  /// Component identifier
  component_id: ByteArray,
  /// Component type (engine, transmission, chassis, etc.)
  component_type: ByteArray,
  /// Input materials/subcomponents
  inputs: List<ByteArray>,
  /// Component manufacturer pNFT
  manufacturer: AssetName,
  /// Manufacturing location
  manufacturing_bioregion: ByteArray,
  /// Compound impacts
  compounds: List<CompoundFlow>,
  /// Manufacturing timestamp
  manufactured_at: Int,
}

/// Impact from final assembly
pub type AssemblyImpact {
  /// Assembly line identifier
  assembly_line: ByteArray,
  /// All components used
  components_used: List<ByteArray>,
  /// Assembler pNFT (factory)
  assembler: AssetName,
  /// Assembly location
  assembly_bioregion: ByteArray,
  /// Compound impacts from assembly
  compounds: List<CompoundFlow>,
  /// Assembly completion timestamp
  assembled_at: Int,
}

/// Impact from transport between phases
pub type TransportImpact {
  /// Transport leg identifier
  leg_id: ByteArray,
  /// From location
  from_bioregion: ByteArray,
  /// To location
  to_bioregion: ByteArray,
  /// Distance
  distance_km: Int,
  /// Transport mode
  transport_mode: TransportMode,
  /// Carrier pNFT
  carrier: AssetName,
  /// Compound impacts
  compounds: List<CompoundFlow>,
  /// Transport timestamp
  transported_at: Int,
}

pub type TransportMode {
  RoadMode { vehicle_type: ByteArray }
  RailMode { rail_type: ByteArray }
  SeaMode { vessel_type: ByteArray }
  AirMode { aircraft_type: ByteArray }
  PipelineMode { pipe_type: ByteArray }
}

// =============================================================================
// MACHINERY NFT MINTING
// =============================================================================

pub type MachineryNftRedeemer {
  /// Mint new machinery NFT when manufacturing complete
  /// Requires all supply chain data to be recorded
  MintMachineryNft {
    /// Serial number hash
    serial_hash: ByteArray,
    /// Machine type
    machine_type: AssetType,
    /// Accumulated supply chain impact
    supply_chain: SupplyChainImpact,
    /// Initial owner (usually manufacturer or first buyer)
    initial_owner: AssetName,
    /// Manufacturing attestation
    manufacturer_attestation: ByteArray,
  }
  
  /// Update operational stats (called after operations)
  UpdateStats {
    machine_id: AssetName,
    new_stats: LifetimeStats,
    new_condition: Int,
  }
  
  /// Transfer ownership
  Transfer {
    machine_id: AssetName,
    from_owner: AssetName,
    to_owner: AssetName,
    transfer_price: Int,
  }
  
  /// Burn NFT on retirement/scrapping
  NftRetire {
    machine_id: AssetName,
    scrap_impact: List<CompoundFlow>,
    final_owner: AssetName,
  }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type AssetImpactConfig {
  /// pNFT policy
  pnft_policy: PolicyId,
  /// Land NFT policy
  land_policy: PolicyId,
  /// Token policy (for purchase verification)
  token_policy: PolicyId,
  /// Work auction contract (authorized to record)
  work_auction_contract: ByteArray,
  /// Records contract
  records_contract: ByteArray,
  /// Governance contract (for corrections)
  governance_contract: ByteArray,
  /// Minimum verification level to record
  min_recorder_level: VerificationLevel,
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator asset_impact(config: AssetImpactConfig) {
  spend(
    datum: Option<AssetImpactDatum>,
    redeemer: AssetImpactRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      InitializeAsset { asset_id, asset_type, initial_owner } -> {
        validate_initialize(tx, asset_id, asset_type, initial_owner, config)
      }
      
      RecordActivity { asset_id, activity } -> {
        validate_record_activity(tx, datum, asset_id, activity, config)
      }
      
      RecordActivities { asset_id, activities } -> {
        validate_record_activities(tx, datum, asset_id, activities, config)
      }
      
      TransferToConsumer { asset_id, consumer_pnft, purchase_tx_hash } -> {
        validate_transfer_to_consumer(tx, datum, asset_id, consumer_pnft, purchase_tx_hash, config)
      }
      
      ProveImpacts { asset_id } -> {
        validate_prove_impacts(tx, datum, asset_id, config)
      }
      
      CorrectImpacts { asset_id, correction, governance_approval } -> {
        validate_correct_impacts(tx, datum, asset_id, correction, governance_approval, config)
      }
    }
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

fn validate_initialize(
  tx: Transaction,
  asset_id: AssetName,
  asset_type: AssetType,
  initial_owner: AssetName,
  config: AssetImpactConfig,
) -> Bool {
  // 1. Asset must exist and be owned by initial_owner
  expect verify_asset_ownership(tx, asset_id, asset_type, initial_owner, config)
  
  // 2. Owner must sign
  let owner_pnft = find_pnft_in_tx(tx, initial_owner, config.pnft_policy)
  expect Some(owner) = owner_pnft
  expect list.has(tx.extra_signatories, owner.owner)
  
  // 3. No existing impact history for this asset
  expect !has_existing_history(tx, asset_id)
  
  // 4. Create initial empty history
  let output = find_asset_impact_output(tx.outputs)
  expect Some(out) = output
  expect InlineDatum(data) = out.datum
  expect AssetHistory(history): AssetImpactDatum = data
  
  history.asset_id == asset_id &&
  list.length(history.activities) == 0 &&
  list.length(history.accumulated_totals) == 0 &&
  history.transferred_to_consumer == False &&
  history.consumer == None
}

// =============================================================================
// RECORDING ACTIVITIES
// =============================================================================

fn validate_record_activity(
  tx: Transaction,
  datum: Option<AssetImpactDatum>,
  asset_id: AssetName,
  activity: AssetActivityRecord,
  config: AssetImpactConfig,
) -> Bool {
  // 1. Must have existing asset history
  expect Some(AssetHistory(history)) = datum
  expect history.asset_id == asset_id
  
  // 2. Asset must not be transferred yet
  expect history.transferred_to_consumer == False
  
  // 3. Caller must be authorized (work_auction contract or Steward)
  expect verify_authorized_recorder(tx, config)
  
  // 4. Activity must have valid compound flows
  expect list.length(activity.compound_flows) >= 1
  expect list.all(activity.compound_flows, is_valid_compound_flow)
  
  // 5. Worker must be valid pNFT
  let worker_pnft = find_pnft_in_tx(tx, activity.worker_pnft, config.pnft_policy)
  expect Some(_) = worker_pnft
  
  // 6. Verify output has updated history
  let output = find_asset_impact_output(tx.outputs)
  expect Some(out) = output
  expect InlineDatum(data) = out.datum
  expect AssetHistory(updated): AssetImpactDatum = data
  
  // 7. Activity should be appended
  let expected_activities = list.concat(history.activities, [activity])
  expect updated.activities == expected_activities
  
  // 8. Accumulated totals should be updated
  let new_totals = merge_compound_totals(history.accumulated_totals, activity.compound_flows)
  updated.accumulated_totals == new_totals
}

fn validate_record_activities(
  tx: Transaction,
  datum: Option<AssetImpactDatum>,
  asset_id: AssetName,
  activities: List<AssetActivityRecord>,
  config: AssetImpactConfig,
) -> Bool {
  // Same as single, but batch
  expect Some(AssetHistory(history)) = datum
  expect history.asset_id == asset_id
  expect history.transferred_to_consumer == False
  expect verify_authorized_recorder(tx, config)
  
  // All activities must be valid
  expect list.all(activities, fn(a) { 
    list.length(a.compound_flows) >= 1 &&
    list.all(a.compound_flows, is_valid_compound_flow)
  })
  
  // Verify output has all activities appended and totals updated
  let output = find_asset_impact_output(tx.outputs)
  expect Some(out) = output
  expect InlineDatum(data) = out.datum
  expect AssetHistory(updated): AssetImpactDatum = data
  
  let expected_activities = list.concat(history.activities, activities)
  let all_new_flows = list.flat_map(activities, fn(a) { a.compound_flows })
  let new_totals = merge_compound_totals(history.accumulated_totals, all_new_flows)
  
  updated.activities == expected_activities &&
  updated.accumulated_totals == new_totals
}

// =============================================================================
// TRANSFER TO CONSUMER
// =============================================================================

fn validate_transfer_to_consumer(
  tx: Transaction,
  datum: Option<AssetImpactDatum>,
  asset_id: AssetName,
  consumer_pnft: AssetName,
  purchase_tx_hash: ByteArray,
  config: AssetImpactConfig,
) -> Bool {
  // 1. Must have existing asset history
  expect Some(AssetHistory(history)) = datum
  expect history.asset_id == asset_id
  
  // 2. Must not already be transferred
  expect history.transferred_to_consumer == False
  
  // 3. Purchase must be occurring in this transaction
  // (Verify token transfer from seller to consumer for this asset)
  expect verify_purchase_transaction(tx, asset_id, consumer_pnft, config)
  
  // 4. Consumer must be valid pNFT
  let consumer = find_pnft_in_tx(tx, consumer_pnft, config.pnft_policy)
  expect Some(consumer_data) = consumer
  
  // 5. Consumer must sign (accepting the impacts)
  expect list.has(tx.extra_signatories, consumer_data.owner)
  
  // 6. Asset history must be marked as transferred
  let history_output = find_asset_impact_output(tx.outputs)
  expect Some(h_out) = history_output
  expect InlineDatum(h_data) = h_out.datum
  expect AssetHistory(updated_history): AssetImpactDatum = h_data
  
  expect updated_history.transferred_to_consumer == True
  expect updated_history.consumer == Some(consumer_pnft)
  
  // 7. Consumer's pNFT must be updated with accrued impacts
  // (The accumulated_totals transfer to consumer's consumer_impact)
  let consumer_pnft_output = find_pnft_output(tx.outputs, consumer_pnft, config.pnft_policy)
  expect Some(c_out) = consumer_pnft_output
  expect InlineDatum(c_data) = c_out.datum
  expect updated_consumer: PnftDatum = c_data
  
  // Verify consumer's impact record includes these compounds
  expect Some(impact_record) = updated_consumer.consumer_impact
  expect True = verify_compounds_accrued(impact_record, history.accumulated_totals)
  
  // 8. Create transfer record for audit trail
  let transfer_output = find_transfer_record_output(tx.outputs)
  expect Some(t_out) = transfer_output
  expect InlineDatum(t_data) = t_out.datum
  expect TransferRecord(record): AssetImpactDatum = t_data
  
  record.asset_id == asset_id &&
  record.consumer_pnft == consumer_pnft &&
  record.compounds == convert_to_balances(history.accumulated_totals) &&
  record.purchase_tx == purchase_tx_hash
}

// =============================================================================
// PROOF AND CORRECTION
// =============================================================================

fn validate_prove_impacts(
  tx: Transaction,
  datum: Option<AssetImpactDatum>,
  asset_id: AssetName,
  config: AssetImpactConfig,
) -> Bool {
  // Simply proves the impacts exist — datum is spent and recreated unchanged
  expect Some(AssetHistory(history)) = datum
  expect history.asset_id == asset_id
  
  // Must recreate identical
  let output = find_asset_impact_output(tx.outputs)
  expect Some(out) = output
  expect InlineDatum(data) = out.datum
  expect AssetHistory(recreated): AssetImpactDatum = data
  
  recreated == history
}

fn validate_correct_impacts(
  tx: Transaction,
  datum: Option<AssetImpactDatum>,
  asset_id: AssetName,
  correction: ImpactCorrection,
  governance_approval: ByteArray,
  config: AssetImpactConfig,
) -> Bool {
  // 1. Must have existing history
  expect Some(AssetHistory(history)) = datum
  expect history.asset_id == asset_id
  
  // 2. Must have valid governance approval
  expect verify_governance_approval(tx, governance_approval, config.governance_contract)
  
  // 3. Apply correction
  let corrected = apply_correction(history, correction)
  
  // 4. Verify output has corrected history
  let output = find_asset_impact_output(tx.outputs)
  expect Some(out) = output
  expect InlineDatum(data) = out.datum
  expect AssetHistory(updated): AssetImpactDatum = data
  
  updated == corrected
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

fn verify_authorized_recorder(tx: Transaction, config: AssetImpactConfig) -> Bool {
  // Either from work_auction contract or Steward-level pNFT
  let from_work_auction = verify_from_contract(tx, config.work_auction_contract)
  
  let steward_signing = list.any(tx.reference_inputs, fn(input) {
    is_steward_pnft(input.output, config.pnft_policy, tx.extra_signatories)
  })
  
  from_work_auction || steward_signing
}

fn verify_from_contract(tx: Transaction, contract_hash: ByteArray) -> Bool {
  // Check if transaction is from specified contract
  list.any(tx.inputs, fn(input) {
    get_script_hash(input.output) == Some(contract_hash)
  })
}

fn is_steward_pnft(output: Output, policy: PolicyId, signers: List<VerificationKeyHash>) -> Bool {
  when output.datum is {
    InlineDatum(data) -> {
      expect datum: PnftDatum = data
      datum.level == Steward && list.has(signers, datum.owner)
    }
    _ -> False
  }
}

fn is_valid_compound_flow(flow: CompoundFlow) -> Bool {
  // Compound code must be valid
  flow.compound != #"" &&
  // Confidence must be 0-100
  flow.confidence >= 0 && flow.confidence <= 100
}

fn merge_compound_totals(
  existing: List<CompoundBalance>,
  new_flows: List<CompoundFlow>,
) -> List<CompoundBalance> {
  // Convert flows to balances and merge
  let new_balances = list.map(new_flows, fn(f) {
    CompoundBalance {
      compound: f.compound,
      quantity: f.quantity,
      unit: f.unit,
    }
  })
  
  // Merge same compounds by summing quantities
  merge_balance_lists(existing, new_balances)
}

fn merge_balance_lists(
  a: List<CompoundBalance>,
  b: List<CompoundBalance>,
) -> List<CompoundBalance> {
  // Simplified: concatenate (real impl would sum same compounds)
  list.concat(a, b)
}

fn convert_to_balances(flows: List<CompoundBalance>) -> List<CompoundBalance> {
  flows
}

fn verify_compounds_accrued(
  record: ConsumerImpactRecord,
  compounds: List<CompoundBalance>,
) -> Bool {
  // Verify all compounds are in the record
  list.all(compounds, fn(c) {
    list.any(record.lifetime_compounds, fn(lc) {
      lc.compound == c.compound
    })
  })
}

fn verify_purchase_transaction(
  tx: Transaction,
  asset_id: AssetName,
  consumer: AssetName,
  config: AssetImpactConfig,
) -> Bool {
  // Verify token transfer occurring for this asset
  // Consumer receiving asset ownership
  True // Simplified
}

fn verify_asset_ownership(
  tx: Transaction,
  asset_id: AssetName,
  asset_type: AssetType,
  owner: AssetName,
  config: AssetImpactConfig,
) -> Bool {
  True // Simplified
}

fn has_existing_history(tx: Transaction, asset_id: AssetName) -> Bool {
  False // Simplified
}

fn verify_governance_approval(
  tx: Transaction,
  approval: ByteArray,
  governance: ByteArray,
) -> Bool {
  True // Simplified
}

fn apply_correction(
  history: AssetImpactHistory,
  correction: ImpactCorrection,
) -> AssetImpactHistory {
  history // Simplified
}

fn find_asset_impact_output(outputs: List<Output>) -> Option<Output> {
  None // Simplified
}

fn find_transfer_record_output(outputs: List<Output>) -> Option<Output> {
  None // Simplified
}

fn find_pnft_in_tx(
  tx: Transaction,
  pnft_id: AssetName,
  policy: PolicyId,
) -> Option<PnftDatum> {
  None // Simplified
}

fn find_pnft_output(
  outputs: List<Output>,
  pnft_id: AssetName,
  policy: PolicyId,
) -> Option<Output> {
  None // Simplified
}

fn get_script_hash(output: Output) -> Option<ByteArray> {
  None // Simplified
}
