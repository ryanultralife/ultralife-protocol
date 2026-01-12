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
