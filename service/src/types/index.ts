/**
 * UltraLife Protocol TypeScript Types
 * 
 * These mirror the Aiken types in contracts/lib/ultralife/types_universal.ak
 */

// =============================================================================
// BASIC TYPES
// =============================================================================

export type ByteArray = string; // Hex-encoded
export type AssetName = string; // pNFT asset name
export type PolicyId = string;
export type TxHash = string;
export type Address = string;

// =============================================================================
// VERIFICATION LEVELS
// =============================================================================

export type VerificationLevel = 'Basic' | 'Ward' | 'Standard' | 'Verified' | 'Steward';

// =============================================================================
// pNFT (Personal NFT / Identity)
// =============================================================================

export interface PnftDatum {
  pnft_id: ByteArray;
  owner: string; // VerificationKeyHash
  level: VerificationLevel;
  dna_hash: ByteArray | null;
  bioregion: ByteArray | null;
  guardian: AssetName | null;  // Only for Ward level
  ward_since: number | null;   // When guardianship began
  created_at: number;
  upgraded_at: number | null;
  consumer_impacts: CompoundBalance[] | null;
  care_credits: bigint;
}

export type WitnessType = 
  // For children
  | 'BiologicalParent'
  | 'Parent'
  | 'Grandparent'
  | 'Midwife'
  | 'MedicalProfessional'
  | 'MedicalFacility'
  // For elderly/infirm
  | 'AdultChild'
  | 'Sibling'
  | 'CareFacility'
  | 'CourtAppointed'
  | 'PowerOfAttorney'
  | 'PhysicianCertification';

export interface WardAttestation {
  witness_type: WitnessType;
  witness_pnft: AssetName;
  ward_since: number;
  location_hash: ByteArray;
  signature: ByteArray;
}

export type PnftRedeemer =
  | { MintBasic: { owner: string } }
  | { MintWard: { ward_owner: string; guardian_pnft: AssetName; ward_attestation: WardAttestation } }
  | { UpgradeStandard: { dna_hash: ByteArray; attestations: ByteArray[] } }
  | { UpgradeWardToStandard: { ward_pnft: AssetName; dna_hash: ByteArray; attestations: ByteArray[]; ward_signature: ByteArray } }
  | { UpgradeVerified: { residency_proof: string } }
  | { UpgradeSteward: { endorsements: ByteArray[]; required: number } }
  | { TransferGuardianship: { ward_pnft: AssetName; new_guardian: AssetName } }
  | { Burn: { proof_hash: ByteArray; attestation: ByteArray } };

// =============================================================================
// OFFERINGS
// =============================================================================

export interface CategoryRef {
  type: 'Registry' | 'Custom';
  code?: ByteArray;
  description_hash?: ByteArray;
}

export type WhatOffered =
  | { type: 'Thing'; description_hash: ByteArray; quantity?: number; unit?: ByteArray }
  | { type: 'Work'; description_hash: ByteArray; duration?: number }
  | { type: 'Access'; asset_id: AssetName; access_type: ByteArray; duration?: number }
  | { type: 'Knowledge'; description_hash: ByteArray }
  | { type: 'Care'; description_hash: ByteArray; duration?: number };

export type LocationScope =
  | { type: 'Specific'; bioregion: ByteArray; location_hash: ByteArray }
  | { type: 'Bioregional'; bioregion: ByteArray }
  | { type: 'Mobile'; range: ByteArray[] }
  | { type: 'Remote' }
  | { type: 'Anywhere' };

export type TimeScope =
  | { type: 'Now' }
  | { type: 'Scheduled'; start: number; end?: number }
  | { type: 'Recurring'; pattern_hash: ByteArray }
  | { type: 'OnDemand' };

export type Terms =
  | { type: 'Priced'; amount: bigint; negotiable: boolean }
  | { type: 'Range'; min: bigint; max: bigint }
  | { type: 'Auction'; starting: bigint; reserve?: bigint }
  | { type: 'Trade'; accepts_hash: ByteArray }
  | { type: 'Gift'; conditions?: ByteArray }
  | { type: 'CommunityService' };

export type OfferingStatus = 'Active' | 'Paused' | 'Fulfilled' | 'Expired' | 'Cancelled';

export interface Offering {
  offering_id: ByteArray;
  offerer: AssetName;
  category: CategoryRef;
  what: WhatOffered;
  location: LocationScope;
  availability: TimeScope;
  terms: Terms;
  expected_compounds: CompoundFlow[];
  evidence: ByteArray[];
  status: OfferingStatus;
  created_at: number;
}

// =============================================================================
// MACHINERY & VEHICLES
// =============================================================================

export type FuelType = 
  | 'Gasoline' | 'Diesel' | 'NaturalGas' | 'LPG'
  | 'Electric' | 'Hydrogen' | 'Biodiesel' | 'Ethanol'
  | { Hybrid: { primary: string } }
  | { Other: { fuel_code: string } };

export type VehicleClass =
  | { PassengerCar: { seats: number; fuel_type: FuelType } }
  | { LightTruck: { payload_kg: number; fuel_type: FuelType } }
  | { HeavyTruck: { payload_kg: number; axles: number; fuel_type: FuelType } }
  | { Bus: { capacity: number; fuel_type: FuelType } }
  | { Motorcycle: { engine_cc: number; fuel_type: FuelType } }
  | { Watercraft: { displacement_tons: number; fuel_type: FuelType } }
  | { Aircraft: { aircraft_type: string; fuel_type: FuelType } }
  | { Rail: { rail_type: string } };

export type MachineryClass =
  | { Excavator: { bucket_m3: number; operating_weight_kg: number } }
  | { Bulldozer: { blade_width_m: number; operating_weight_kg: number } }
  | { Crane: { lift_capacity_kg: number; boom_length_m: number } }
  | { Tractor: { horsepower: number; pto_type: string } }
  | { Harvester: { harvest_type: string; capacity: number } }
  | { Generator: { output_kw: number; fuel_type: FuelType } }
  | { Compressor: { cfm: number; pressure_psi: number } }
  | { Mining: { equipment_type: string; capacity: number } }
  | { Industrial: { category: string } };

export type AmortizationUnit = 'PerHour' | 'PerKilometer' | 'PerMile' | 'PerCycle' | 'PerUnit';

export interface EmbodiedImpact {
  manufacturing_compounds: CompoundBalance[];
  extraction_compounds: CompoundBalance[];
  transport_compounds: CompoundBalance[];
  total_embodied: CompoundBalance[];
  expected_lifespan: number;
  amortization_unit: AmortizationUnit;
  manufactured_at: number;
  manufacturing_bioregion: ByteArray;
  manufacturer_attestation: ByteArray;
}

export interface OperationalImpact {
  usage_amount: number;
  usage_unit: AmortizationUnit;
  fuel_consumed: number;
  fuel_unit: string;
  fuel_type: FuelType;
  operational_compounds: CompoundFlow[];
  amortized_embodied: CompoundFlow[];
  operator: AssetName;
  operation_slot: number;
  operation_bioregion: ByteArray;
}

export interface LifetimeStats {
  total_usage: number;
  total_fuel: number;
  total_operational: CompoundBalance[];
  amortized_to_date: CompoundBalance[];
  remaining_embodied: CompoundBalance[];
  maintenance_count: number;
  repair_count: number;
}

export interface MachinerySpec {
  asset_id: AssetName;
  asset_type: 'Vehicle' | 'Machinery' | 'Equipment';
  embodied: EmbodiedImpact;
  lifetime_stats: LifetimeStats;
  condition_bps: number;  // 0-10000 = 0-100%
  remaining_life: number;
  replacement_cost: bigint;
}

export type RecommendedAction =
  | { type: 'Continue' }
  | { type: 'Maintain'; maintenance_type: string }
  | { type: 'Replace'; new_model: string; efficiency_gain_bps: number }
  | { type: 'Repair'; component: string; extends_life: number }
  | { type: 'Retire'; scrap_value: bigint };

export interface ReplacementRecommendation {
  machine_id: AssetName;
  action: RecommendedAction;
  impact_savings: CompoundBalance[];
  cost: bigint;
  payback_epochs: number;
  wasted_embodied: CompoundBalance[];
}

// =============================================================================
// MACHINERY NFT (Supply Chain Impact)
// =============================================================================

export interface MaterialImpact {
  material_code: ByteArray;
  quantity: number;
  quantity_unit: string;
  extraction_bioregion: ByteArray;
  extractor: AssetName;
  compounds: CompoundFlow[];
  extracted_at: number;
}

export interface ProcessingImpact {
  process_code: ByteArray;
  input_materials: ByteArray[];
  output_material: ByteArray;
  output_quantity: number;
  processor: AssetName;
  processing_bioregion: ByteArray;
  compounds: CompoundFlow[];
  processed_at: number;
}

export interface ComponentImpact {
  component_id: ByteArray;
  component_type: ByteArray;
  inputs: ByteArray[];
  manufacturer: AssetName;
  manufacturing_bioregion: ByteArray;
  compounds: CompoundFlow[];
  manufactured_at: number;
}

export interface AssemblyImpact {
  assembly_line: ByteArray;
  components_used: ByteArray[];
  assembler: AssetName;
  assembly_bioregion: ByteArray;
  compounds: CompoundFlow[];
  assembled_at: number;
}

export type TransportMode =
  | { Road: { vehicle_type: string } }
  | { Rail: { rail_type: string } }
  | { Sea: { vessel_type: string } }
  | { Air: { aircraft_type: string } }
  | { Pipeline: { pipe_type: string } };

export interface TransportImpact {
  leg_id: ByteArray;
  from_bioregion: ByteArray;
  to_bioregion: ByteArray;
  distance_km: number;
  transport_mode: TransportMode;
  carrier: AssetName;
  compounds: CompoundFlow[];
  transported_at: number;
}

export interface SupplyChainImpact {
  extraction: MaterialImpact[];
  processing: ProcessingImpact[];
  components: ComponentImpact[];
  assembly: AssemblyImpact;
  transport: TransportImpact[];
  total_embodied: CompoundBalance[];
  data_completeness_bps: number;  // 0-10000 = 0-100%
}

export interface MachineryNftDatum {
  machine_id: ByteArray;
  machine_type: 'Vehicle' | 'Machinery' | 'Equipment';
  manufacturer: AssetName;
  manufactured_at: number;
  manufacturing_bioregion: ByteArray;
  supply_chain_impact: SupplyChainImpact;
  current_owner: AssetName;
  ownership_transfers: number;
  lifetime_stats: LifetimeStats;
  condition_bps: number;
}

// =============================================================================
// DIGITAL ASSET TWIN & AUTOMATION CONTROL
// =============================================================================
//
// Every physical asset can have a digital record with:
// 1. All attributes stored innately on-chain
// 2. Complete service history queryable from ledger
// 3. Automation control endpoints
//
// No scanning required - query the ledger to see past services.
// Same interface can control IoT/automations on the asset.
//
// =============================================================================

export type AssetCategory =
  | 'Land'
  | 'Building'
  | 'Vehicle'
  | 'Machinery'
  | 'Equipment'
  | 'Infrastructure'
  | 'Appliance';

export interface DigitalAssetTwin {
  // Identity
  asset_id: AssetName;
  category: AssetCategory;
  owner_pnft: AssetName;

  // Physical attributes (stored innately, no scanning needed)
  attributes: AssetAttributes;

  // Service history (readable directly from ledger)
  service_history_ref: ByteArray;  // Contract address for service records

  // Automation control (IoT endpoints)
  automations: AutomationEndpoint[];

  // Access control for automations
  automation_permissions: AutomationPermission[];
}

export interface AssetAttributes {
  // Common attributes
  name: string;
  description_hash: ByteArray;  // IPFS hash for detailed specs
  location: LocationScope;
  acquired_at: number;

  // Category-specific attributes
  specs: AssetSpecs;

  // Current state (updated by sensors/IoT)
  current_state: AssetState | null;
}

export type AssetSpecs =
  | { type: 'Land'; parcel_id: ByteArray; area_sqm: number; zoning: string; coordinates: GeoCoordinates }
  | { type: 'Building'; structure_type: string; floors: number; area_sqm: number; year_built: number; land_parcel: AssetName }
  | { type: 'Vehicle'; vin_hash: ByteArray; make: string; model: string; year: number; fuel_type: string }
  | { type: 'Machinery'; serial_hash: ByteArray; machinery_class: string; capacity: number; power_kw: number }
  | { type: 'Equipment'; serial_hash: ByteArray; equipment_type: string; specs_hash: ByteArray }
  | { type: 'Infrastructure'; infra_type: string; capacity: number; connected_assets: AssetName[] }
  | { type: 'Appliance'; model: string; power_w: number; smart_enabled: boolean };

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  altitude_m?: number;
}

export interface AssetState {
  // Updated by IoT sensors or manual input
  last_updated: number;
  status: 'Active' | 'Idle' | 'Maintenance' | 'Offline';
  sensor_readings: SensorReading[];
  alerts: AssetAlert[];
}

export interface SensorReading {
  sensor_id: ByteArray;
  sensor_type: SensorType;
  value: number;
  unit: string;
  timestamp: number;
}

export type SensorType =
  | 'Temperature'
  | 'Humidity'
  | 'Pressure'
  | 'Power'
  | 'Fuel'
  | 'Speed'
  | 'Location'
  | 'Occupancy'
  | 'Flow'
  | 'Level'
  | 'Vibration'
  | 'Custom';

export interface AssetAlert {
  alert_id: ByteArray;
  severity: 'Info' | 'Warning' | 'Critical';
  message_hash: ByteArray;
  triggered_at: number;
  acknowledged: boolean;
}

// =============================================================================
// AUTOMATION CONTROL
// =============================================================================
//
// Control IoT devices and automations from the same LLM interface.
// "Turn off the lights in the barn" → LLM → MCP → Blockchain → IoT endpoint
//
// =============================================================================

export interface AutomationEndpoint {
  endpoint_id: ByteArray;
  name: string;
  device_type: DeviceType;

  // Connection details (encrypted, only owner can decrypt)
  connection_hash: ByteArray;  // Encrypted endpoint URL/protocol

  // Available commands
  commands: AutomationCommand[];

  // Current state (if readable)
  readable: boolean;
  current_value?: string;
}

export type DeviceType =
  | 'Light'
  | 'HVAC'
  | 'Lock'
  | 'Gate'
  | 'Irrigation'
  | 'Generator'
  | 'Pump'
  | 'Sensor'
  | 'Camera'
  | 'Alarm'
  | 'Thermostat'
  | 'Switch'
  | 'Motor'
  | 'Valve'
  | 'Custom';

export interface AutomationCommand {
  command_id: ByteArray;
  name: string;
  description: string;

  // Parameters for the command
  parameters: CommandParameter[];

  // Impact estimation (if command has environmental impact)
  estimated_impact?: CompoundFlow[];
}

export interface CommandParameter {
  name: string;
  param_type: 'Boolean' | 'Number' | 'String' | 'Enum';
  required: boolean;
  default_value?: string;
  enum_values?: string[];  // For Enum type
  min?: number;  // For Number type
  max?: number;  // For Number type
}

export interface AutomationPermission {
  // Who can control this automation
  permitted_pnft: AssetName;

  // What commands they can execute
  allowed_commands: ByteArray[];  // Empty = all commands

  // Time restrictions
  time_restrictions?: TimeRestriction;

  // Granted by owner
  granted_by: AssetName;
  granted_at: number;
  expires_at?: number;
}

export interface TimeRestriction {
  // Only allow control during these hours (0-23)
  allowed_hours?: { start: number; end: number };

  // Only on these days (0=Sunday, 6=Saturday)
  allowed_days?: number[];
}

// =============================================================================
// AUTOMATION EXECUTION RECORD
// =============================================================================

export interface AutomationExecution {
  execution_id: ByteArray;
  asset_id: AssetName;
  endpoint_id: ByteArray;
  command_id: ByteArray;

  // Who executed
  executed_by: AssetName;
  executed_at: number;

  // Parameters used
  parameters: Record<string, string>;

  // Result
  success: boolean;
  result_hash?: ByteArray;  // Result details on IPFS

  // Impact if any
  actual_impact?: CompoundFlow[];
}

// =============================================================================
// ASSET SERVICE HISTORY QUERY
// =============================================================================
//
// Query past services directly from ledger - no scanning needed.
// The ledger IS the record of all services performed on the asset.
//
// =============================================================================

export interface AssetServiceQuery {
  asset_id: AssetName;

  // Filter options
  service_types?: string[];
  performer_pnft?: AssetName;
  date_range?: { from: number; to: number };

  // Pagination
  limit?: number;
  offset?: number;
}

export interface AssetServiceHistory {
  asset_id: AssetName;
  owner: AssetName;

  // Complete service record from ledger
  services: ServiceRecord[];

  // Aggregated stats
  total_services: number;
  total_spend: bigint;
  total_impact: CompoundBalance[];

  // Last service
  last_service_at: number;
}

export interface ServiceRecord {
  service_id: ByteArray;
  service_type: string;
  performer: AssetName;
  performed_at: number;

  // What was done
  description_hash: ByteArray;

  // Payment
  amount_paid: bigint;

  // Verification
  verification_method: string;
  verified_by?: AssetName[];

  // Impact
  impact: CompoundFlow[];

  // Evidence
  evidence_hash?: ByteArray;
}

// =============================================================================
// NEEDS
// =============================================================================

export type WhatNeeded =
  | { type: 'Thing'; description_hash: ByteArray; quantity?: number }
  | { type: 'Work'; description_hash: ByteArray; scope_hash: ByteArray }
  | { type: 'Access'; asset_type_hash: ByteArray; duration?: number }
  | { type: 'Knowledge'; topic_hash: ByteArray }
  | { type: 'Care'; description_hash: ByteArray; duration?: number };

export type Budget =
  | { type: 'Fixed'; amount: bigint }
  | { type: 'Range'; min: bigint; max: bigint }
  | { type: 'Negotiable' }
  | { type: 'Trade'; offering_hash: ByteArray };

export type Requirement =
  | { type: 'MinVerification'; level: number }
  | { type: 'Credential'; credential_hash: ByteArray }
  | { type: 'Residency'; bioregion: ByteArray }
  | { type: 'MinEfficiency'; compound: ByteArray; max_rating: number }
  | { type: 'Custom'; requirement_hash: ByteArray };

export interface CompoundLimit {
  compound: ByteArray;
  max_quantity: bigint;
  unit: ByteArray;
}

export type NeedStatus = 'Open' | 'InProgress' | 'Fulfilled' | 'Cancelled' | 'Expired';

export interface Need {
  need_id: ByteArray;
  needer: AssetName;
  category: CategoryRef;
  what: WhatNeeded;
  location: LocationScope;
  when_needed: TimeScope;
  budget: Budget;
  requirements: Requirement[];
  impact_limits: CompoundLimit[] | null;
  status: NeedStatus;
  created_at: number;
  deadline: number | null;
}

// =============================================================================
// AGREEMENTS
// =============================================================================

export type VerificationMethod =
  | { type: 'SelfReported' }
  | { type: 'CounterpartyConfirm' }
  | { type: 'CommunityAttestation'; min_attestors: number }
  | { type: 'DesignatedVerifier'; verifier: AssetName }
  | { type: 'Automatic'; oracle_hash: ByteArray };

export interface Escrow {
  escrow_id: ByteArray;
  amount: bigint;
  release_conditions_hash: ByteArray;
}

export type AgreementStatus =
  | 'Pending'
  | 'Active'
  | { WorkSubmitted: { evidence_hash: ByteArray } }
  | 'Verified'
  | 'Complete'
  | { Disputed: { reason_hash: ByteArray } }
  | 'Cancelled';

export interface Agreement {
  agreement_id: ByteArray;
  party_a: AssetName;
  party_b: AssetName;
  deliverable_hash: ByteArray;
  payment: bigint;
  start_by: number | null;
  complete_by: number;
  expected_compounds: CompoundFlow[];
  verification: VerificationMethod;
  escrow: Escrow | null;
  status: AgreementStatus;
  created_at: number;
}

// =============================================================================
// COMPOUNDS / IMPACTS
// =============================================================================

export interface CompoundFlow {
  compound: ByteArray;
  quantity: bigint; // Signed: + = produced, - = sequestered
  unit: ByteArray;
  measurement: ByteArray;
  confidence: number; // 0-100
}

export interface CompoundBalance {
  compound: ByteArray;
  quantity: bigint;
  unit: ByteArray;
}

export type ImpactDestination =
  | { type: 'Asset'; asset_id: AssetName }
  | { type: 'Consumer'; consumer_pnft: AssetName }
  | { type: 'Commons'; bioregion: ByteArray };

export interface ActivityRecord {
  record_id: ByteArray;
  agreement_id: ByteArray;
  performer: AssetName;
  compound_flows: CompoundFlow[];
  evidence_hash: ByteArray;
  timestamp: number;
  verified_by: AssetName[];
  impacts_to: ImpactDestination;
}

// =============================================================================
// STAKES
// =============================================================================

export type StakeTarget =
  | { type: 'Offering'; offering_id: ByteArray }
  | { type: 'Collective'; collective_id: ByteArray }
  | { type: 'BioregionFund'; bioregion: ByteArray; category: ByteArray }
  | { type: 'Asset'; asset_id: AssetName }
  | { type: 'Research'; research_id: ByteArray }
  | { type: 'Pool'; pool_id: ByteArray };

export type StakeReturns =
  | { type: 'Yield'; rate_bps: number }
  | { type: 'Access'; access_hash: ByteArray }
  | { type: 'ProductRights'; allocation_hash: ByteArray }
  | { type: 'Governance'; weight: number }
  | { type: 'ImpactCredits'; compound: ByteArray; multiplier: number };

export type StakeStatus = 'Active' | 'Withdrawn' | 'Matured';

export interface Stake {
  stake_id: ByteArray;
  staker: AssetName;
  target: StakeTarget;
  amount: bigint;
  start: number;
  end: number | null;
  returns: StakeReturns;
  status: StakeStatus;
}

// =============================================================================
// BIOREGION
// =============================================================================

export interface IndexValue {
  value: number; // 0-10000 (0-100.00%)
  trend: number; // Change from last cycle
  confidence: number; // 0-100
}

export interface BioregionIndex {
  bioregion: ByteArray;
  cycle: number;
  
  // Resource health
  water_index: IndexValue;
  land_index: IndexValue;
  air_index: IndexValue;
  energy_index: IndexValue;
  
  // Human wellbeing
  health_index: IndexValue;
  education_index: IndexValue;
  housing_index: IndexValue;
  food_security_index: IndexValue;
  care_availability_index: IndexValue;
  
  // Economic activity
  offerings_active: number;
  needs_active: number;
  agreements_completed: number;
  value_transacted: bigint;
  care_hours: number;
  
  // Compound balances
  compound_balances: CompoundBalance[];
  
  // Overall health
  health_score: number;
  
  // Timestamp
  updated_at: number;
}

// =============================================================================
// TREASURY & BONDING CURVE
// =============================================================================

export interface TreasuryDatum {
  tokens_remaining: bigint;        // From 400B development pool
  tokens_distributed: bigint;      // Cumulative distributed
  ada_reserves: bigint;            // ADA collected
  btc_reserves: bigint;            // wBTC collected (if any)
  ada_usd_rate: bigint;            // Oracle rate (micro-USD)
  last_epoch: number;              // Last settlement epoch
  founder_accrued: bigint;         // Founder tokens accrued
  founder_claimed: bigint;         // Founder tokens claimed
}

export interface EpochQueue {
  epoch: number;
  purchases: PurchaseClaim[];
  founder_claim: bigint;           // ~$1,667 worth at epoch price
  bounties: BountyClaim[];
}

export interface PurchaseClaim {
  buyer_pnft: AssetName;
  ada_amount: bigint;
  queued_at: number;
}

export interface BountyClaim {
  recipient_pnft: AssetName;
  usd_value: bigint;               // Micro-USD
  work_id: ByteArray;
}

export type TreasuryRedeemer =
  | { BuyWithADA: { buyer_pnft: AssetName; ada_amount: bigint } }
  | { SellForADA: { seller_pnft: AssetName; token_amount: bigint } }
  | { SettleEpoch: {} }
  | { ClaimFounder: { amount: bigint } }
  | { UpdateOracle: { ada_usd_price: bigint } };

// Bonding curve: price(n) = n / 400,000,000,000
export function getBondingPrice(distributed: bigint): number {
  // Returns price in USD
  return Number(distributed) / 400_000_000_000;
}

export function getTokensForUSD(usd: number, distributed: bigint): bigint {
  const price = getBondingPrice(distributed);
  if (price < 0.000001) return BigInt(Math.floor(usd * 1_000_000_000)); // Near-zero price
  return BigInt(Math.floor(usd / price));
}

// =============================================================================
// COLLECTIVES
// =============================================================================

export interface Collective {
  collective_id: ByteArray;
  name_hash: ByteArray;
  members: AssetName[];
  resources: AssetName[];
  governance_hash: ByteArray;
  treasury: ByteArray;
  bioregion: ByteArray;
}

// =============================================================================
// SPENDING BUCKETS (Hydra)
// =============================================================================

export type BucketPeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | { Custom: { seconds: number } };

export interface BucketConfig {
  bucket_id: ByteArray;
  name_hash: ByteArray;
  allocation: bigint;
  period: BucketPeriod;
  rollover: boolean;
  max_balance: bigint;
  min_balance: bigint;
  allowed_categories: ByteArray[];
  locked_until: number;
}

export interface BucketState {
  config: BucketConfig;
  balance: bigint;
  period_start: number;
  spent_this_period: bigint;
  total_spent: bigint;
  last_activity: number;
}

export interface SpendingBucketDatum {
  owner_pnft: AssetName;
  buckets: BucketState[];
  total_funds: bigint;
  hydra_head: ByteArray | null;
  last_settlement: number;
  created_at: number;
}

export type BucketTemplate = 
  | 'daily_spending'
  | 'weekly_groceries'
  | 'monthly_bills'
  | 'emergency_fund'
  | 'savings_goal'
  | 'allowance'
  | 'business_expense'
  | 'custom';

// =============================================================================
// CYCLE STATS (For UBI Calculation)
// =============================================================================

export interface AvatarCycleStats {
  pnft: AssetName;
  cycle: number;
  tx_sent: number;
  volume_sent: bigint;
  tx_received: number;
  volume_received: bigint;
  unique_counterparties: number;
  net_impact: number;
  labor_count: number;
  remediation_count: number;
}

export interface BioregionCycleStats {
  bioregion: ByteArray;
  cycle: number;
  internal_volume: bigint;
  export_volume: bigint;
  import_volume: bigint;
  total_volume: bigint;
  unique_participants: number;
  labor_transactions: number;
  net_impact: number;
  active_count: number;
}

// UBI Constants (from contract)
export const UBI_CONSTANTS = {
  BASE_UBI_FEE_SHARE_BPS: 5000,     // 50% starting point
  MIN_UBI_FEE_SHARE_BPS: 3000,      // 30% floor
  MAX_UBI_FEE_SHARE_BPS: 7000,      // 70% ceiling
  TARGET_UBI_PER_PERSON: 100,       // Target per epoch
  ADJUSTMENT_PERIOD_EPOCHS: 6,      // ~1 month
  MIN_ENGAGEMENT_TX: 5,
  MIN_ENGAGEMENT_COUNTERPARTIES: 2,
  SURVIVAL_FLOOR: 20,               // Everyone gets this (1-2 food tx)
  MIN_UBI_PER_PERSON: 10,
  MAX_UBI_PER_PERSON: 500,
  // Engagement ramp percentages
  RAMP_1_TX: 2500,   // 25%
  RAMP_2_TX: 5000,   // 50%
  RAMP_3_TX: 7000,   // 70%
  RAMP_4_TX: 8500,   // 85%
  RAMP_FULL: 10000,  // 100%
} as const;

// Fee allocation (dynamic UBI share, fixed validator/treasury split of remainder)
export const FEE_ALLOCATION = {
  UBI_SHARE_START: 5000,    // 50% initial
  UBI_SHARE_MIN: 3000,      // 30% floor
  UBI_SHARE_MAX: 7000,      // 70% ceiling
  VALIDATOR_SHARE: 3000,    // 30% of remainder
  // Treasury gets what's left
} as const;

export interface UbiPeriodStats {
  period: number;
  total_distributed: bigint;
  total_claimants: number;
  avg_ubi_per_person: number;
  total_fees: bigint;
  current_fee_share_bps: number;
  next_fee_share_bps: number;
  epochs_counted: number;
  start_slot: number;
  end_slot: number;
}

// =============================================================================
// ULTRALIFE VALIDATOR NETWORK (UVN)
// =============================================================================

export type ValidatorStatus = 
  | 'Active'
  | { Jailed: { reason: ByteArray; until_epoch: number } }
  | { Deregistering: { effective_epoch: number } };

export interface UltraLifeValidatorDatum {
  validator_pnft: AssetName;
  ultra_staked: bigint;
  bioregion: ByteArray;
  transactions_validated: number;
  uptime_score: number;  // 0-10000
  fees_earned_epoch: bigint;
  fees_earned_total: bigint;
  registered_epoch: number;
  status: ValidatorStatus;
}

export interface FeePoolDatum {
  ada_balance: bigint;
  ultra_fees_collected: bigint;
  epoch: number;
  ultra_fee_rate: bigint;
  min_ada_reserve: bigint;
  admin: ByteArray;
}

// =============================================================================
// REGISTRY
// =============================================================================

export type RegistryAuthority =
  | { type: 'Global'; standard: ByteArray }
  | { type: 'Bioregional'; bioregion: ByteArray }
  | { type: 'Collective'; collective_id: ByteArray }
  | { type: 'Individual'; pnft: AssetName };

export type RegistryStatus =
  | { type: 'Active' }
  | { type: 'Deprecated'; replacement?: ByteArray };

export interface RegistryEntry {
  code: ByteArray;
  parent: ByteArray | null;
  name_hash: ByteArray;
  description_hash: ByteArray;
  defined_by: RegistryAuthority;
  typical_compounds: ByteArray[];
  status: RegistryStatus;
}

// =============================================================================
// TRANSACTION TYPES (for records)
// =============================================================================

export type TransactionType =
  // Primary sector
  | { type: 'Labor'; work_code: ByteArray; hours: number }
  | { type: 'Agriculture'; product_type: string; quantity: bigint; unit_code: ByteArray }
  | { type: 'Harvest'; resource_type: string; quantity: bigint; unit_code: ByteArray }
  // Secondary sector
  | { type: 'Goods'; product_code: ByteArray; quantity: bigint; unit_code: ByteArray }
  | { type: 'Manufactured'; item_code: ByteArray; quantity: bigint; batch_id: ByteArray }
  | { type: 'Construction'; phase: string; asset_id: AssetName }
  | { type: 'Energy'; energy_type: string; quantity_kwh: bigint }
  // Tertiary sector
  | { type: 'Services'; service_code: ByteArray }
  | { type: 'Healthcare'; service_type: string; reference_hash: ByteArray }
  | { type: 'Education'; program_type: string; provider: AssetName }
  | { type: 'Transport'; mode: string; distance: bigint }
  | { type: 'Rental'; asset_id: AssetName; period: number }
  // Quaternary sector
  | { type: 'Research'; field: ByteArray; deliverable_hash: ByteArray }
  | { type: 'Data'; data_type: ByteArray; access_type: string }
  | { type: 'License'; ip_id: ByteArray; terms_hash: ByteArray }
  // Quinary sector
  | { type: 'Care'; care_type: string; hours: number }
  | { type: 'CommunityService'; service_type: string }
  // Financial
  | { type: 'Gift' }
  | { type: 'UBI'; cycle: number }
  | { type: 'Internal' };

// =============================================================================
// CONFIG / CONTRACT REFERENCES
// =============================================================================

// All 27 validators mapped to addresses
export interface ContractAddresses {
  // Identity
  pnft_policy: PolicyId;
  pnft_spend: Address;
  recovery: Address;
  
  // Token
  token_policy: PolicyId;
  token_spend: Address;
  treasury: Address;
  
  // Marketplace
  marketplace: Address;
  work_auction: Address;
  
  // Records & Registry
  records: Address;
  registry: Address;
  memory: Address;
  
  // Bioregion & Land
  bioregion: Address;
  land_rights: Address;
  commons: Address;
  
  // Staking & Governance
  stake_pool: Address;
  governance: Address;
  ubi: Address;
  
  // Impact
  impact: Address;
  impact_market: Address;
  asset_impact: Address;
  remediation: Address;
  preservation: Address;
  
  // Collectives & Care
  collective: Address;
  care: Address;
  
  // Infrastructure
  energy: Address;
  grants: Address;
  genesis: Address;
  
  // Hydra
  spending_bucket: Address;
  ultralife_validator: Address;
  fee_pool: Address;
}

// Reference scripts for all validators
export interface ReferenceScripts {
  // Identity
  pnft_mint: { txHash: TxHash; outputIndex: number };
  pnft_spend: { txHash: TxHash; outputIndex: number };
  recovery: { txHash: TxHash; outputIndex: number };
  
  // Token
  token: { txHash: TxHash; outputIndex: number };
  treasury: { txHash: TxHash; outputIndex: number };
  
  // Marketplace
  marketplace: { txHash: TxHash; outputIndex: number };
  work_auction: { txHash: TxHash; outputIndex: number };
  
  // Records & Registry
  records: { txHash: TxHash; outputIndex: number };
  registry: { txHash: TxHash; outputIndex: number };
  memory: { txHash: TxHash; outputIndex: number };
  
  // Bioregion & Land
  bioregion: { txHash: TxHash; outputIndex: number };
  land_rights: { txHash: TxHash; outputIndex: number };
  commons: { txHash: TxHash; outputIndex: number };
  
  // Staking & Governance
  stake_pool: { txHash: TxHash; outputIndex: number };
  governance: { txHash: TxHash; outputIndex: number };
  ubi: { txHash: TxHash; outputIndex: number };
  
  // Impact
  impact: { txHash: TxHash; outputIndex: number };
  impact_market: { txHash: TxHash; outputIndex: number };
  asset_impact: { txHash: TxHash; outputIndex: number };
  remediation: { txHash: TxHash; outputIndex: number };
  preservation: { txHash: TxHash; outputIndex: number };
  
  // Collectives & Care
  collective: { txHash: TxHash; outputIndex: number };
  care: { txHash: TxHash; outputIndex: number };
  
  // Infrastructure
  energy: { txHash: TxHash; outputIndex: number };
  grants: { txHash: TxHash; outputIndex: number };
  genesis: { txHash: TxHash; outputIndex: number };
  
  // Hydra
  spending_bucket: { txHash: TxHash; outputIndex: number };
  ultralife_validator: { txHash: TxHash; outputIndex: number };
  fee_pool: { txHash: TxHash; outputIndex: number };
}

export interface UltraLifeConfig {
  network: 'mainnet' | 'preprod' | 'preview';
  blockfrostApiKey: string;
  contracts: ContractAddresses;
  referenceScripts: ReferenceScripts;
}

// =============================================================================
// HASH-BASED ACCESS CONTROL & CONTENT REGISTRY
// =============================================================================
//
// Stores only hashes on-chain (tiny transactions).
// Actual content stored off-chain (IPFS/Arweave).
// Owner grants time-limited access to view actual files.
// LLM interface can generate viewable formats (JPEG, JSON, etc.) on demand.
//
// =============================================================================

/**
 * Content types that can be stored off-chain and referenced by hash
 */
export type ContentType =
  | 'Document'      // PDF, contracts, agreements
  | 'Image'         // JPEG, PNG, photos
  | 'Video'         // MP4, recordings
  | 'Audio'         // MP3, voice memos
  | 'Data'          // JSON, CSV, structured data
  | 'Model3D'       // CAD, 3D scans of assets
  | 'Certificate'   // Credentials, certifications
  | 'Evidence'      // Work completion proofs
  | 'Medical'       // Health records (extra privacy)
  | 'Financial'     // Bank statements, invoices
  | 'Legal'         // Legal documents
  | 'Identity'      // ID documents
  | 'Custom';

/**
 * Content stored off-chain, referenced by hash on-chain
 * Only the hash goes in transactions - keeps them tiny
 */
export interface ContentReference {
  // The hash that goes on-chain (32 bytes)
  content_hash: ByteArray;

  // What type of content this is
  content_type: ContentType;

  // Size in bytes (for network optimization)
  size_bytes: number;

  // Storage location hint (not the actual URL, just the network)
  storage_network: 'IPFS' | 'Arweave' | 'Filecoin' | 'Private';

  // Encryption info
  encrypted: boolean;
  encryption_type?: 'AES256' | 'ChaCha20' | 'RSA' | 'Threshold';

  // Who owns this content
  owner_pnft: AssetName;

  // When it was registered
  registered_at: number;

  // Optional: linked asset or agreement
  linked_asset?: AssetName;
  linked_agreement?: ByteArray;

  // Human-readable description hash (also stored off-chain)
  description_hash?: ByteArray;
}

/**
 * Grant duration presets
 */
export type GrantDuration =
  | { type: 'Hours'; hours: 1 | 2 | 4 | 8 | 12 | 24 }
  | { type: 'Days'; days: 1 | 3 | 7 | 14 | 30 }
  | { type: 'WorkContract'; agreement_id: ByteArray }  // Tied to work contract duration
  | { type: 'Permanent' }                              // Never expires
  | { type: 'SingleView' }                             // One-time access
  | { type: 'Custom'; expires_at: number };            // Custom expiry timestamp

/**
 * Access grant - permission to view content behind a hash
 * This is what goes on-chain (small datum)
 */
export interface AccessGrant {
  grant_id: ByteArray;

  // What content is being accessed
  content_hash: ByteArray;

  // Who is granted access
  grantee_pnft: AssetName;

  // Who granted access
  grantor_pnft: AssetName;

  // Duration/expiry
  duration: GrantDuration;
  granted_at: number;
  expires_at: number | null;  // null = permanent

  // Access level
  access_level: AccessLevel;

  // Revocation
  revoked: boolean;
  revoked_at?: number;
  revoke_reason_hash?: ByteArray;

  // Usage tracking
  view_count: number;
  last_viewed_at?: number;
  max_views?: number;  // Optional view limit

  // Linked to work contract?
  work_agreement_id?: ByteArray;
}

export type AccessLevel =
  | 'ViewOnly'           // Can view but not download
  | 'Download'           // Can download a copy
  | 'Share'              // Can share with others (limited)
  | 'Full';              // Full access including resharing

/**
 * Batch grant - grant access to multiple contents at once
 * Useful when work contract gives access to many files
 */
export interface BatchAccessGrant {
  batch_id: ByteArray;

  // Multiple content hashes
  content_hashes: ByteArray[];

  // Single grantee
  grantee_pnft: AssetName;
  grantor_pnft: AssetName;

  // Shared settings for all
  duration: GrantDuration;
  access_level: AccessLevel;
  granted_at: number;
  expires_at: number | null;

  // Link to agreement
  work_agreement_id?: ByteArray;
}

/**
 * Work contract access grant integration
 * When a work contract is created, these accesses are auto-granted
 */
export interface WorkContractAccessGrants {
  agreement_id: ByteArray;

  // Grants from party_a to party_b (e.g., client shares specs with worker)
  grants_a_to_b: ContentReference[];

  // Grants from party_b to party_a (e.g., worker will share deliverables)
  grants_b_to_a: ContentReference[];

  // When work is verified, these additional grants unlock
  on_verification_grants: ContentReference[];

  // Grant duration tied to agreement
  grant_duration: GrantDuration;
}

// =============================================================================
// LLM-ACCESSIBLE VIEW GENERATION
// =============================================================================
//
// The LLM interface generates viewable files on demand when access is valid.
// This keeps on-chain data minimal while allowing rich content viewing.
//
// =============================================================================

/**
 * Request format for LLM to generate a viewable file
 */
export interface ViewRequest {
  // What to view
  content_hash: ByteArray;

  // Who is requesting
  requester_pnft: AssetName;

  // Preferred output format
  output_format: OutputFormat;

  // For paginated content
  page?: number;
  page_size?: number;

  // For images - resize options
  max_width?: number;
  max_height?: number;

  // For data - query/filter
  query?: string;
  fields?: string[];
}

export type OutputFormat =
  | 'JSON'              // Structured data
  | 'JPEG'              // Compressed image
  | 'PNG'               // Lossless image
  | 'PDF'               // Document
  | 'Markdown'          // Text with formatting
  | 'PlainText'         // Simple text
  | 'HTML'              // Rich text
  | 'CSV'               // Tabular data
  | 'Summary'           // LLM-generated summary
  | 'Thumbnail';        // Small preview image

/**
 * Response from LLM view generation
 */
export interface ViewResponse {
  // Request info
  content_hash: ByteArray;
  requester_pnft: AssetName;

  // Access validation
  access_valid: boolean;
  access_expires_at?: number;
  remaining_views?: number;

  // Generated content (if access valid)
  output_format: OutputFormat;
  generated_content?: string;  // Base64 for binary, raw for text

  // Metadata
  generated_at: number;
  content_type: ContentType;
  original_size_bytes: number;

  // Error info (if access denied)
  error?: ViewError;
}

export type ViewError =
  | { type: 'NoAccess' }
  | { type: 'Expired'; expired_at: number }
  | { type: 'Revoked'; revoked_at: number }
  | { type: 'ViewLimitReached'; max_views: number }
  | { type: 'ContentNotFound' }
  | { type: 'DecryptionFailed' }
  | { type: 'FormatNotSupported'; requested: OutputFormat; available: OutputFormat[] };

/**
 * Content preview - LLM can generate these for quick browsing
 */
export interface ContentPreview {
  content_hash: ByteArray;
  content_type: ContentType;

  // Auto-generated preview
  thumbnail?: string;           // Base64 small image
  summary?: string;             // Text summary (LLM generated)
  key_fields?: Record<string, string>;  // Important metadata

  // Access info
  has_access: boolean;
  access_expires_at?: number;

  // Preview generated at
  generated_at: number;
}

// =============================================================================
// ACCESS CONTROL VALIDATOR ACTIONS
// =============================================================================

export type AccessGrantRedeemer =
  | { GrantAccess: { content_hash: ByteArray; grantee: AssetName; duration: GrantDuration; access_level: AccessLevel } }
  | { RevokeAccess: { grant_id: ByteArray; reason_hash?: ByteArray } }
  | { ExtendAccess: { grant_id: ByteArray; new_expiry: number } }
  | { TransferOwnership: { content_hash: ByteArray; new_owner: AssetName } }
  | { BatchGrant: { content_hashes: ByteArray[]; grantee: AssetName; duration: GrantDuration } }
  | { WorkContractGrant: { agreement_id: ByteArray; grants: WorkContractAccessGrants } };

/**
 * Access log entry - tracks who viewed what when
 * Used for audit trail and usage analytics
 */
export interface AccessLogEntry {
  log_id: ByteArray;
  content_hash: ByteArray;
  accessor_pnft: AssetName;
  access_type: 'View' | 'Download' | 'Share';
  accessed_at: number;
  output_format: OutputFormat;
  success: boolean;
  error?: ViewError;
}

/**
 * Content registry - owner's view of all their content
 */
export interface ContentRegistry {
  owner_pnft: AssetName;

  // All registered content
  contents: ContentReference[];

  // All active grants (given by this owner)
  active_grants: AccessGrant[];

  // All received grants (given to this owner)
  received_grants: AccessGrant[];

  // Stats
  total_contents: number;
  total_active_grants: number;
  total_views: number;
}

// =============================================================================
// HELPER FUNCTIONS FOR ACCESS GRANTS
// =============================================================================

/**
 * Calculate expiry timestamp from grant duration
 */
export function calculateExpiry(duration: GrantDuration, startTime: number): number | null {
  switch (duration.type) {
    case 'Hours':
      return startTime + (duration.hours * 60 * 60 * 1000);
    case 'Days':
      return startTime + (duration.days * 24 * 60 * 60 * 1000);
    case 'Permanent':
      return null;
    case 'SingleView':
      return startTime + (24 * 60 * 60 * 1000);  // 24hr max for single view
    case 'Custom':
      return duration.expires_at;
    case 'WorkContract':
      // Expiry tied to agreement - caller must resolve
      return null;
    default:
      return null;
  }
}

/**
 * Check if an access grant is currently valid
 */
export function isGrantValid(grant: AccessGrant, currentTime: number): boolean {
  if (grant.revoked) return false;
  if (grant.expires_at && currentTime > grant.expires_at) return false;
  if (grant.max_views && grant.view_count >= grant.max_views) return false;
  return true;
}

/**
 * Common grant duration presets
 */
export const GRANT_DURATIONS = {
  QUICK_VIEW: { type: 'Hours', hours: 1 } as GrantDuration,
  SHORT_ACCESS: { type: 'Hours', hours: 8 } as GrantDuration,
  DAY_PASS: { type: 'Hours', hours: 24 } as GrantDuration,
  WEEK_ACCESS: { type: 'Days', days: 7 } as GrantDuration,
  MONTH_ACCESS: { type: 'Days', days: 30 } as GrantDuration,
  PERMANENT: { type: 'Permanent' } as GrantDuration,
  SINGLE_VIEW: { type: 'SingleView' } as GrantDuration,
} as const;
