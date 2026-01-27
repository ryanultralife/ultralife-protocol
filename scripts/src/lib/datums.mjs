/**
 * UltraLife Protocol — Datum Builders
 *
 * Builds CBOR-encoded datums for UltraLife validators.
 * These must match the types defined in contracts/lib/ultralife/types.ak
 */

import { Data } from '@lucid-evolution/lucid';

// =============================================================================
// VERIFICATION LEVEL ENUM
// =============================================================================

/**
 * Verification levels for pNFTs
 * Must match VerificationLevel in types.ak
 */
export const VerificationLevel = {
  Basic: 0,
  Ward: 1,
  Standard: 2,
  Verified: 3,
  Steward: 4,
};

// =============================================================================
// pNFT DATUMS
// =============================================================================

/**
 * Build a pNFT datum
 * @param {Object} params Datum parameters
 * @returns {string} CBOR-encoded datum
 */
export function buildPnftDatum({
  pnftId,
  owner,
  level,
  bioregion = null,
  dnaHash = null,
  guardian = null,
  wardSince = null,
  createdAt,
  upgradedAt = null,
  consumerImpact = null,
  nutritionProfile = null,
}) {
  // Build the datum structure matching PnftDatum in types.ak
  const datum = {
    pnft_id: pnftId,
    owner: owner,
    level: levelToPlutus(level),
    bioregion: bioregion ? { Some: [bioregion] } : { None: [] },
    dna_hash: dnaHash ? { Some: [dnaHash] } : { None: [] },
    guardian: guardian ? { Some: [guardian] } : { None: [] },
    ward_since: wardSince !== null ? { Some: [BigInt(wardSince)] } : { None: [] },
    created_at: BigInt(createdAt),
    upgraded_at: upgradedAt !== null ? { Some: [BigInt(upgradedAt)] } : { None: [] },
    consumer_impact: consumerImpact ? { Some: [consumerImpact] } : { None: [] },
    nutrition_profile: nutritionProfile ? { Some: [nutritionProfile] } : { None: [] },
  };

  return Data.to(datum, PnftDatumSchema);
}

function levelToPlutus(level) {
  if (typeof level === 'number') {
    return { constructor: level, fields: [] };
  }
  const levelNum = VerificationLevel[level] ?? VerificationLevel.Basic;
  return { constructor: levelNum, fields: [] };
}

// Lucid Data schema for PnftDatum
const PnftDatumSchema = Data.Object({
  pnft_id: Data.Bytes(),
  owner: Data.Bytes(),
  level: Data.Enum([
    Data.Literal('Basic'),
    Data.Literal('Ward'),
    Data.Literal('Standard'),
    Data.Literal('Verified'),
    Data.Literal('Steward'),
  ]),
  bioregion: Data.Nullable(Data.Bytes()),
  dna_hash: Data.Nullable(Data.Bytes()),
  guardian: Data.Nullable(Data.Bytes()),
  ward_since: Data.Nullable(Data.Integer()),
  created_at: Data.Integer(),
  upgraded_at: Data.Nullable(Data.Integer()),
  consumer_impact: Data.Nullable(Data.Any()),
  nutrition_profile: Data.Nullable(Data.Any()),
});

// =============================================================================
// UBI POOL DATUMS
// =============================================================================

/**
 * Build a UBI pool datum
 * @param {Object} params Pool parameters
 * @returns {string} CBOR-encoded datum
 */
export function buildUbiPoolDatum({
  bioregion,
  cycle,
  feesCollected,
  ubiPool,
  eligibleCount,
  totalEngagementWeight,
  claimsCount = 0,
  distributed = 0,
  distributionStart,
}) {
  const datum = {
    bioregion: bioregion,
    cycle: BigInt(cycle),
    fees_collected: BigInt(feesCollected),
    ubi_pool: BigInt(ubiPool),
    eligible_count: BigInt(eligibleCount),
    total_engagement_weight: BigInt(totalEngagementWeight),
    claims_count: BigInt(claimsCount),
    distributed: BigInt(distributed),
    distribution_start: BigInt(distributionStart),
  };

  return Data.to(datum, UbiPoolDatumSchema);
}

const UbiPoolDatumSchema = Data.Object({
  bioregion: Data.Bytes(),
  cycle: Data.Integer(),
  fees_collected: Data.Integer(),
  ubi_pool: Data.Integer(),
  eligible_count: Data.Integer(),
  total_engagement_weight: Data.Integer(),
  claims_count: Data.Integer(),
  distributed: Data.Integer(),
  distribution_start: Data.Integer(),
});

/**
 * Build a UBI claim datum
 * @param {Object} params Claim parameters
 * @returns {string} CBOR-encoded datum
 */
export function buildUbiClaimDatum({
  pnft,
  cycle,
  baseShare,
  engagementMult,
  amount,
  slot,
}) {
  const datum = {
    pnft: pnft,
    cycle: BigInt(cycle),
    base_share: BigInt(baseShare),
    engagement_mult: BigInt(engagementMult),
    amount: BigInt(amount),
    slot: BigInt(slot),
  };

  return Data.to(datum, UbiClaimDatumSchema);
}

const UbiClaimDatumSchema = Data.Object({
  pnft: Data.Bytes(),
  cycle: Data.Integer(),
  base_share: Data.Integer(),
  engagement_mult: Data.Integer(),
  amount: Data.Integer(),
  slot: Data.Integer(),
});

// =============================================================================
// GENESIS DATUMS
// =============================================================================

/**
 * Build a genesis datum
 * @param {Object} params Genesis parameters
 * @returns {string} CBOR-encoded datum
 */
export function buildGenesisDatum({
  verificationsCompleted = 0,
  stewardsCreated = 0,
  bioregionsCreated = 0,
  registeredOracles = [],
  genesisActive = true,
}) {
  const datum = {
    verifications_completed: BigInt(verificationsCompleted),
    stewards_created: BigInt(stewardsCreated),
    bioregions_created: BigInt(bioregionsCreated),
    registered_oracles: registeredOracles.map(o => ({
      partner_id: o.partnerId,
      signing_key: o.signingKey,
      registered_at: BigInt(o.registeredAt),
      registered_by: o.registeredBy,
      metadata_hash: o.metadataHash,
      active: o.active,
    })),
    genesis_active: genesisActive,
  };

  return Data.to(datum, GenesisDatumSchema);
}

const GenesisDatumSchema = Data.Object({
  verifications_completed: Data.Integer(),
  stewards_created: Data.Integer(),
  bioregions_created: Data.Integer(),
  registered_oracles: Data.Array(Data.Object({
    partner_id: Data.Bytes(),
    signing_key: Data.Bytes(),
    registered_at: Data.Integer(),
    registered_by: Data.Bytes(),
    metadata_hash: Data.Bytes(),
    active: Data.Boolean(),
  })),
  genesis_active: Data.Boolean(),
});

// =============================================================================
// TRANSACTION RECORD DATUMS
// =============================================================================

/**
 * Build a transaction record datum
 * @param {Object} params Record parameters
 * @returns {string} CBOR-encoded datum
 */
export function buildTransactionRecordDatum({
  sender,
  senderBioregion,
  recipient,
  recipientBioregion,
  amount,
  txTypeCode,
  compoundFlows,
  impactAccruedTo,
  slot,
  cycle,
}) {
  const datum = {
    sender: sender,
    sender_bioregion: senderBioregion,
    recipient: recipient,
    recipient_bioregion: recipientBioregion,
    amount: BigInt(amount),
    tx_type_code: BigInt(txTypeCode),
    compound_flows: compoundFlows.map(f => ({
      compound: f.compound,
      quantity: BigInt(f.quantity),
      unit: encodeUnit(f.unit),
      measurement: encodeMeasurement(f.measurement),
      confidence: BigInt(f.confidence),
    })),
    impact_accrued_to: impactAccruedTo,
    slot: BigInt(slot),
    cycle: BigInt(cycle),
  };

  return Data.to(datum, TransactionRecordDatumSchema);
}

function encodeUnit(unit) {
  const units = { Grams: 0, Kilograms: 1, Liters: 2, Moles: 3 };
  return { constructor: units[unit] || 0, fields: [] };
}

function encodeMeasurement(measurement) {
  if (measurement.type === 'Direct') {
    return { constructor: 0, fields: [measurement.instrument || ''] };
  } else if (measurement.type === 'Calculated') {
    return { constructor: 1, fields: [measurement.formula || ''] };
  } else if (measurement.type === 'Estimated') {
    return { constructor: 2, fields: [measurement.reference || '', BigInt(measurement.similarity || 50)] };
  } else if (measurement.type === 'Surveyed') {
    return { constructor: 3, fields: [measurement.surveyor || ''] };
  }
  return { constructor: 1, fields: [''] }; // Default to Calculated
}

const TransactionRecordDatumSchema = Data.Object({
  sender: Data.Bytes(),
  sender_bioregion: Data.Bytes(),
  recipient: Data.Bytes(),
  recipient_bioregion: Data.Bytes(),
  amount: Data.Integer(),
  tx_type_code: Data.Integer(),
  compound_flows: Data.Array(Data.Object({
    compound: Data.Bytes(),
    quantity: Data.Integer(),
    unit: Data.Any(),
    measurement: Data.Any(),
    confidence: Data.Integer(),
  })),
  impact_accrued_to: Data.Bytes(),
  slot: Data.Integer(),
  cycle: Data.Integer(),
});

// =============================================================================
// TOKEN TRANSACTION METADATA
// =============================================================================

/**
 * Transaction type codes matching tx_type_code() in types.ak
 */
export const TransactionTypeCode = {
  Labor: 1,
  Goods: 2,
  Services: 3,
  Gift: 4,
  Investment: 5,
  Remediation: 6,
  UBI: 7,
  GovernanceReward: 8,
  Internal: 9,
};

/**
 * Build transaction metadata for token transfers
 * @param {Object} params Metadata parameters
 * @returns {string} CBOR-encoded metadata
 */
export function buildTransactionMeta({
  txType,
  impacts,
  evidenceHash,
  description = null,
}) {
  const meta = {
    tx_type: encodeTxType(txType),
    activity_impact: {
      compound_flows: impacts.map(i => ({
        compound: i.compound,
        quantity: BigInt(i.quantity),
        unit: encodeUnit(i.unit || 'Grams'),
        measurement: encodeMeasurement(i.measurement || { type: 'Calculated', formula: '' }),
        confidence: BigInt(i.confidence || 50),
      })),
      evidence_hash: evidenceHash,
      attestors: [],
    },
    legacy_impact: { None: [] },
    description: description ? { Some: [description] } : { None: [] },
  };

  return Data.to(meta, TransactionMetaSchema);
}

function encodeTxType(txType) {
  if (typeof txType === 'string') {
    // Simple types like 'Gift', 'Internal'
    if (txType === 'Gift') return { constructor: 3, fields: [] };
    if (txType === 'Internal') return { constructor: 8, fields: [] };
  }

  if (txType.type === 'Labor') {
    return { constructor: 0, fields: [txType.workCode || '', txType.hours ? { Some: [BigInt(txType.hours)] } : { None: [] }] };
  }
  if (txType.type === 'Goods') {
    return { constructor: 1, fields: [txType.productCode || '', BigInt(txType.quantity || 1), txType.unitCode || ''] };
  }
  if (txType.type === 'Services') {
    return { constructor: 2, fields: [txType.serviceCode || ''] };
  }
  if (txType.type === 'Gift') {
    return { constructor: 3, fields: [] };
  }
  if (txType.type === 'Investment') {
    return { constructor: 4, fields: [txType.termsHash || ''] };
  }
  if (txType.type === 'Remediation') {
    return { constructor: 5, fields: [txType.bondId || ''] };
  }
  if (txType.type === 'UBI') {
    return { constructor: 6, fields: [BigInt(txType.cycle || 0)] };
  }

  return { constructor: 8, fields: [] }; // Default to Internal
}

const TransactionMetaSchema = Data.Object({
  tx_type: Data.Any(),
  activity_impact: Data.Object({
    compound_flows: Data.Array(Data.Object({
      compound: Data.Bytes(),
      quantity: Data.Integer(),
      unit: Data.Any(),
      measurement: Data.Any(),
      confidence: Data.Integer(),
    })),
    evidence_hash: Data.Bytes(),
    attestors: Data.Array(Data.Bytes()),
  }),
  legacy_impact: Data.Nullable(Data.Any()),
  description: Data.Nullable(Data.Bytes()),
});

// =============================================================================
// IMPACT COMPOUND CODES
// =============================================================================

/**
 * Common compound codes for impact tracking
 * Matches the codes defined in types.ak
 */
export const CompoundCodes = {
  // Carbon compounds (0x01xx)
  CO2: '0101',
  CH4: '0102', // Methane
  CO: '0103',  // Carbon monoxide
  Cellulose: '0105',

  // Nitrogen compounds (0x02xx)
  NO: '0202',  // Nitric oxide
  NO2: '0203', // Nitrogen dioxide
  N2O: '0204', // Nitrous oxide
  NH3: '0205', // Ammonia

  // Sulfur compounds (0x03xx)
  SO2: '0301', // Sulfur dioxide
  H2S: '0303', // Hydrogen sulfide

  // Water/Oxygen (0x04xx)
  H2O: '0401', // Water
  O2: '0402',  // Oxygen
  O3: '0403',  // Ozone

  // Phosphorus (0x05xx)
  PO4: '0501', // Phosphate

  // Particulates (0x06xx)
  PM10: '0601',
  PM25: '0602',
  BlackCarbon: '0603',

  // Metals (0x07xx)
  Pb: '0703',  // Lead
  Hg: '0704',  // Mercury
  Cd: '0705',  // Cadmium
};

export default {
  VerificationLevel,
  TransactionTypeCode,
  CompoundCodes,
  buildPnftDatum,
  buildUbiPoolDatum,
  buildUbiClaimDatum,
  buildGenesisDatum,
  buildTransactionRecordDatum,
  buildTransactionMeta,
};
