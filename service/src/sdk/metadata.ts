/**
 * Transaction Metadata Builders
 *
 * Helpers for creating complex metadata structures like ActivityImpact,
 * CompoundFlow, and TransactionMeta for UltraLife transactions.
 */

import type {
  CompoundFlow,
  CompoundBalance,
  CategoryRef,
  WhatOffered,
  WhatNeeded,
  LocationScope,
  TimeScope,
  Terms,
  Budget,
  Requirement,
  VerificationMethod,
  TransactionType,
  ByteArray,
  AssetName,
} from '../types/index.js';

// =============================================================================
// COMPOUND CODES (Chemical Formulas)
// =============================================================================

/**
 * Standard compound codes used across the protocol
 * These represent actual chemical compounds, not abstract categories
 */
export const COMPOUNDS = {
  // Carbon group (0x01xx)
  CO2: '0101',      // Carbon dioxide
  CH4: '0102',      // Methane
  CO: '0103',       // Carbon monoxide
  CELLULOSE: '0105', // Organic carbon storage

  // Nitrogen group (0x02xx)
  N2O: '0204',      // Nitrous oxide
  NO: '0202',       // Nitric oxide
  NO2: '0203',      // Nitrogen dioxide
  NH3: '0205',      // Ammonia

  // Sulfur group (0x03xx)
  SO2: '0301',      // Sulfur dioxide
  H2S: '0303',      // Hydrogen sulfide

  // Water/Oxygen group (0x04xx)
  H2O: '0401',      // Water
  O2: '0402',       // Oxygen
  O3: '0403',       // Ozone

  // Phosphorus group (0x05xx)
  PO4: '0501',      // Phosphate

  // Particulates (0x06xx)
  PM10: '0601',     // Particulate matter 10um
  PM25: '0602',     // Particulate matter 2.5um
  BLACK_CARBON: '0603',

  // Metals (0x07xx)
  PB: '0703',       // Lead
  HG: '0704',       // Mercury
  CD: '0705',       // Cadmium
} as const;

/**
 * Unit codes for measurements
 */
export const UNITS = {
  GRAMS: '01',
  KILOGRAMS: '02',
  LITERS: '03',
  MOLES: '04',
  METRIC_TONS: '05',
} as const;

/**
 * Measurement method codes
 */
export const MEASUREMENT_METHODS = {
  DIRECT: '01',      // Direct sensor/lab measurement
  CALCULATED: '02',  // Calculated from activity data
  ESTIMATED: '03',   // Estimated from reference data
  SURVEYED: '04',    // Surveyed by certified pNFT
} as const;

// =============================================================================
// METADATA BUILDER CLASS
// =============================================================================

export class MetadataBuilder {
  /**
   * Create a compound flow representing chemical movement
   *
   * @param compound - Compound code (use COMPOUNDS constants)
   * @param quantity - Amount (positive = produced/released, negative = consumed/sequestered)
   * @param unit - Unit of measurement
   * @param method - How measurement was obtained
   * @param confidence - Confidence level 0-100
   */
  createCompoundFlow(
    compound: string,
    quantity: number | bigint,
    unit: string = UNITS.GRAMS,
    method: string = MEASUREMENT_METHODS.ESTIMATED,
    confidence: number = 80
  ): CompoundFlow {
    return {
      compound,
      quantity: BigInt(quantity),
      unit,
      measurement: method,
      confidence: Math.min(100, Math.max(0, confidence)),
    };
  }

  /**
   * Create CO2 emission flow (convenience method)
   */
  createCO2Emission(gramsEmitted: number, method?: string, confidence?: number): CompoundFlow {
    return this.createCompoundFlow(
      COMPOUNDS.CO2,
      gramsEmitted,
      UNITS.GRAMS,
      method,
      confidence
    );
  }

  /**
   * Create CO2 sequestration flow (convenience method)
   */
  createCO2Sequestration(gramsSequestered: number, method?: string, confidence?: number): CompoundFlow {
    return this.createCompoundFlow(
      COMPOUNDS.CO2,
      -gramsSequestered, // Negative = sequestered
      UNITS.GRAMS,
      method,
      confidence
    );
  }

  /**
   * Create methane emission flow
   */
  createMethaneEmission(gramsEmitted: number, method?: string, confidence?: number): CompoundFlow {
    return this.createCompoundFlow(
      COMPOUNDS.CH4,
      gramsEmitted,
      UNITS.GRAMS,
      method,
      confidence
    );
  }

  /**
   * Create water usage flow
   */
  createWaterUsage(litersUsed: number, method?: string, confidence?: number): CompoundFlow {
    return this.createCompoundFlow(
      COMPOUNDS.H2O,
      litersUsed,
      UNITS.LITERS,
      method,
      confidence
    );
  }

  /**
   * Create an activity impact from multiple compound flows
   */
  createActivityImpact(
    flows: CompoundFlow[],
    evidenceHash?: string,
    attestors?: string[]
  ): {
    compound_flows: CompoundFlow[];
    evidence_hash: string;
    attestors: string[];
  } {
    if (flows.length === 0) {
      throw new Error('Activity impact must have at least one compound flow');
    }

    return {
      compound_flows: flows,
      evidence_hash: evidenceHash || this.generateHash('no-evidence'),
      attestors: attestors || [],
    };
  }

  /**
   * Create a compound balance (accumulated total)
   */
  createCompoundBalance(
    compound: string,
    quantity: number | bigint,
    unit: string = UNITS.GRAMS
  ): CompoundBalance {
    return {
      compound,
      quantity: BigInt(quantity),
      unit,
    };
  }

  // ===========================================================================
  // CATEGORY BUILDERS
  // ===========================================================================

  /**
   * Create a registry category reference (from global registry)
   */
  createRegistryCategory(code: string): CategoryRef {
    return {
      type: 'Registry',
      code,
    };
  }

  /**
   * Create a custom category reference
   */
  createCustomCategory(description: string): CategoryRef {
    return {
      type: 'Custom',
      description_hash: this.generateHash(description),
    };
  }

  // ===========================================================================
  // OFFERING/NEED BUILDERS
  // ===========================================================================

  /**
   * Create a Thing offering (physical goods)
   */
  createThingOffering(description: string, quantity?: number, unit?: string): WhatOffered {
    return {
      type: 'Thing',
      description_hash: this.generateHash(description),
      quantity,
      unit,
    };
  }

  /**
   * Create a Work offering (services/labor)
   */
  createWorkOffering(description: string, durationHours?: number): WhatOffered {
    return {
      type: 'Work',
      description_hash: this.generateHash(description),
      duration: durationHours,
    };
  }

  /**
   * Create an Access offering (rental/use of asset)
   */
  createAccessOffering(assetId: string, accessType: string, durationDays?: number): WhatOffered {
    return {
      type: 'Access',
      asset_id: assetId,
      access_type: accessType,
      duration: durationDays,
    };
  }

  /**
   * Create a Knowledge offering (information/expertise)
   */
  createKnowledgeOffering(description: string): WhatOffered {
    return {
      type: 'Knowledge',
      description_hash: this.generateHash(description),
    };
  }

  /**
   * Create a Care offering (support/caregiving)
   */
  createCareOffering(description: string, durationHours?: number): WhatOffered {
    return {
      type: 'Care',
      description_hash: this.generateHash(description),
      duration: durationHours,
    };
  }

  // ===========================================================================
  // LOCATION BUILDERS
  // ===========================================================================

  /**
   * Create a specific location scope
   */
  createSpecificLocation(bioregion: string, locationHash: string): LocationScope {
    return {
      type: 'Specific',
      bioregion,
      location_hash: locationHash,
    };
  }

  /**
   * Create a bioregional scope (anywhere in bioregion)
   */
  createBioregionalLocation(bioregion: string): LocationScope {
    return {
      type: 'Bioregional',
      bioregion,
    };
  }

  /**
   * Create a mobile scope (provider travels)
   */
  createMobileLocation(bioregions: string[]): LocationScope {
    return {
      type: 'Mobile',
      range: bioregions,
    };
  }

  /**
   * Create a remote scope (delivered remotely)
   */
  createRemoteLocation(): LocationScope {
    return { type: 'Remote' };
  }

  /**
   * Create an anywhere scope (no geographic restriction)
   */
  createAnywhereLocation(): LocationScope {
    return { type: 'Anywhere' };
  }

  // ===========================================================================
  // TIME SCOPE BUILDERS
  // ===========================================================================

  /**
   * Create immediate availability
   */
  createNowAvailability(): TimeScope {
    return { type: 'Now' };
  }

  /**
   * Create scheduled availability
   */
  createScheduledAvailability(startDate: Date, endDate?: Date): TimeScope {
    return {
      type: 'Scheduled',
      start: startDate.getTime(),
      end: endDate?.getTime(),
    };
  }

  /**
   * Create on-demand availability
   */
  createOnDemandAvailability(): TimeScope {
    return { type: 'OnDemand' };
  }

  /**
   * Create recurring availability
   */
  createRecurringAvailability(patternDescription: string): TimeScope {
    return {
      type: 'Recurring',
      pattern_hash: this.generateHash(patternDescription),
    };
  }

  // ===========================================================================
  // TERMS BUILDERS
  // ===========================================================================

  /**
   * Create fixed price terms
   */
  createPricedTerms(amount: number | bigint, negotiable: boolean = true): Terms {
    return {
      type: 'Priced',
      amount: BigInt(amount),
      negotiable,
    };
  }

  /**
   * Create price range terms
   */
  createRangeTerms(min: number | bigint, max: number | bigint): Terms {
    return {
      type: 'Range',
      min: BigInt(min),
      max: BigInt(max),
    };
  }

  /**
   * Create auction terms
   */
  createAuctionTerms(startingBid: number | bigint, reserve?: number | bigint): Terms {
    return {
      type: 'Auction',
      starting: BigInt(startingBid),
      reserve: reserve ? BigInt(reserve) : undefined,
    };
  }

  /**
   * Create trade terms
   */
  createTradeTerms(acceptsDescription: string): Terms {
    return {
      type: 'Trade',
      accepts_hash: this.generateHash(acceptsDescription),
    };
  }

  /**
   * Create gift terms
   */
  createGiftTerms(conditions?: string): Terms {
    return {
      type: 'Gift',
      conditions: conditions ? this.generateHash(conditions) : undefined,
    };
  }

  /**
   * Create community service terms
   */
  createCommunityServiceTerms(): Terms {
    return { type: 'CommunityService' };
  }

  // ===========================================================================
  // BUDGET BUILDERS (for Needs)
  // ===========================================================================

  /**
   * Create fixed budget
   */
  createFixedBudget(amount: number | bigint): Budget {
    return {
      type: 'Fixed',
      amount: BigInt(amount),
    };
  }

  /**
   * Create range budget
   */
  createRangeBudget(min: number | bigint, max: number | bigint): Budget {
    return {
      type: 'Range',
      min: BigInt(min),
      max: BigInt(max),
    };
  }

  /**
   * Create negotiable budget
   */
  createNegotiableBudget(): Budget {
    return { type: 'Negotiable' };
  }

  // ===========================================================================
  // REQUIREMENT BUILDERS
  // ===========================================================================

  /**
   * Create minimum verification level requirement
   */
  createVerificationRequirement(minLevel: 0 | 1 | 2 | 3): Requirement {
    return {
      type: 'MinVerification',
      level: minLevel,
    };
  }

  /**
   * Create bioregion residency requirement
   */
  createResidencyRequirement(bioregion: string): Requirement {
    return {
      type: 'Residency',
      bioregion,
    };
  }

  /**
   * Create credential requirement
   */
  createCredentialRequirement(credentialHash: string): Requirement {
    return {
      type: 'Credential',
      credential_hash: credentialHash,
    };
  }

  /**
   * Create custom requirement
   */
  createCustomRequirement(description: string): Requirement {
    return {
      type: 'Custom',
      requirement_hash: this.generateHash(description),
    };
  }

  // ===========================================================================
  // VERIFICATION METHOD BUILDERS
  // ===========================================================================

  /**
   * Self-reported verification (trust the parties)
   */
  createSelfReportedVerification(): VerificationMethod {
    return { type: 'SelfReported' };
  }

  /**
   * Counterparty confirmation (both parties sign off)
   */
  createCounterpartyVerification(): VerificationMethod {
    return { type: 'CounterpartyConfirm' };
  }

  /**
   * Community attestation (N attestors required)
   */
  createCommunityVerification(minAttestors: number): VerificationMethod {
    return {
      type: 'CommunityAttestation',
      min_attestors: minAttestors,
    };
  }

  /**
   * Designated verifier (specific pNFT verifies)
   */
  createDesignatedVerification(verifierPnft: string): VerificationMethod {
    return {
      type: 'DesignatedVerifier',
      verifier: verifierPnft,
    };
  }

  // ===========================================================================
  // TRANSACTION TYPE BUILDERS
  // ===========================================================================

  /**
   * Create labor transaction type
   */
  createLaborType(workCode: string, hours?: number): TransactionType {
    return {
      type: 'Labor',
      work_code: workCode,
      hours,
    };
  }

  /**
   * Create goods transaction type
   */
  createGoodsType(productCode: string, quantity: number | bigint, unitCode: string): TransactionType {
    return {
      type: 'Goods',
      product_code: productCode,
      quantity: BigInt(quantity),
      unit_code: unitCode,
    };
  }

  /**
   * Create services transaction type
   */
  createServicesType(serviceCode: string): TransactionType {
    return {
      type: 'Services',
      service_code: serviceCode,
    };
  }

  /**
   * Create care transaction type
   */
  createCareType(careType: string, hours: number): TransactionType {
    return {
      type: 'Care',
      care_type: careType,
      hours,
    };
  }

  /**
   * Create gift transaction type
   */
  createGiftType(): TransactionType {
    return { type: 'Gift' };
  }

  /**
   * Create UBI transaction type
   */
  createUbiType(cycle: number): TransactionType {
    return {
      type: 'UBI',
      cycle,
    };
  }

  // ===========================================================================
  // IMPACT ESTIMATION HELPERS
  // ===========================================================================

  /**
   * Estimate CO2 from driving (kg per km)
   */
  estimateDrivingCO2(distanceKm: number, vehicleType: 'car' | 'truck' | 'motorcycle' = 'car'): CompoundFlow {
    const factors = { car: 120, truck: 270, motorcycle: 70 }; // grams CO2 per km
    const grams = Math.round(distanceKm * factors[vehicleType]);
    return this.createCO2Emission(grams, MEASUREMENT_METHODS.CALCULATED, 75);
  }

  /**
   * Estimate CO2 from electricity (kg per kWh)
   */
  estimateElectricityCO2(kWh: number, gridMix: 'coal' | 'gas' | 'mixed' | 'renewable' = 'mixed'): CompoundFlow {
    const factors = { coal: 900, gas: 400, mixed: 500, renewable: 50 }; // grams CO2 per kWh
    const grams = Math.round(kWh * factors[gridMix]);
    return this.createCO2Emission(grams, MEASUREMENT_METHODS.ESTIMATED, 70);
  }

  /**
   * Estimate CO2 sequestration from tree planting
   */
  estimateTreeSequestration(treeCount: number, yearsGrowth: number = 1): CompoundFlow {
    // Average tree sequesters ~22 kg CO2 per year
    const gramsPerYearPerTree = 22000;
    const grams = Math.round(treeCount * yearsGrowth * gramsPerYearPerTree);
    return this.createCO2Sequestration(grams, MEASUREMENT_METHODS.ESTIMATED, 60);
  }

  /**
   * Estimate water footprint for food production (liters)
   */
  estimateFoodWaterFootprint(
    foodType: 'vegetables' | 'grains' | 'poultry' | 'pork' | 'beef',
    kgProduced: number
  ): CompoundFlow {
    // Approximate liters of water per kg of food produced
    const factors = { vegetables: 300, grains: 1500, poultry: 4000, pork: 6000, beef: 15000 };
    const liters = Math.round(kgProduced * factors[foodType]);
    return this.createWaterUsage(liters, MEASUREMENT_METHODS.ESTIMATED, 65);
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Generate a simple hash for strings
   * In production, this would use proper cryptographic hashing
   */
  generateHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  /**
   * Calculate net impact from multiple flows
   */
  calculateNetImpact(flows: CompoundFlow[]): bigint {
    return flows.reduce((acc, flow) => acc + BigInt(flow.quantity), 0n);
  }

  /**
   * Summarize compound flows by compound
   */
  summarizeByCompound(flows: CompoundFlow[]): Map<string, bigint> {
    const summary = new Map<string, bigint>();
    for (const flow of flows) {
      const current = summary.get(flow.compound) || 0n;
      summary.set(flow.compound, current + BigInt(flow.quantity));
    }
    return summary;
  }

  /**
   * Format compound name for display
   */
  formatCompoundName(code: string): string {
    const names: Record<string, string> = {
      '0101': 'CO2 (Carbon Dioxide)',
      '0102': 'CH4 (Methane)',
      '0103': 'CO (Carbon Monoxide)',
      '0105': 'Cellulose',
      '0204': 'N2O (Nitrous Oxide)',
      '0205': 'NH3 (Ammonia)',
      '0301': 'SO2 (Sulfur Dioxide)',
      '0401': 'H2O (Water)',
      '0402': 'O2 (Oxygen)',
      '0601': 'PM10 (Particulates)',
      '0602': 'PM2.5 (Fine Particulates)',
    };
    return names[code] || `Unknown (${code})`;
  }

  /**
   * Format quantity with appropriate unit
   */
  formatQuantity(quantity: bigint, unit: string): string {
    const num = Number(quantity);
    const unitNames: Record<string, string> = {
      '01': 'g',
      '02': 'kg',
      '03': 'L',
      '04': 'mol',
      '05': 't',
    };
    const unitName = unitNames[unit] || 'units';

    if (Math.abs(num) >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M ${unitName}`;
    } else if (Math.abs(num) >= 1000) {
      return `${(num / 1000).toFixed(2)}K ${unitName}`;
    }
    return `${num} ${unitName}`;
  }
}

export default MetadataBuilder;
