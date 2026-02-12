/**
 * UltraLife Protocol — Central Configuration
 *
 * This module centralizes all configurable values used across the protocol.
 * Values can be overridden via environment variables.
 *
 * Usage:
 *   import { config, GOVERNANCE, CYCLES, FEES, PRICES } from './config.mjs';
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get environment variable with fallback default value.
 * Supports type coercion for numbers and booleans.
 */
function env(key, defaultValue) {
  const value = process.env[key];
  if (value === undefined) return defaultValue;

  // Type coercion based on default value type
  if (typeof defaultValue === 'number') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  if (typeof defaultValue === 'bigint') {
    try {
      return BigInt(value);
    } catch {
      return defaultValue;
    }
  }
  if (typeof defaultValue === 'boolean') {
    return value.toLowerCase() === 'true' || value === '1';
  }

  return value;
}

// =============================================================================
// NETWORK CONFIGURATION
// =============================================================================

export const NETWORK = {
  // Current network
  name: env('NETWORK', 'preprod'),

  // Network IDs
  ids: {
    mainnet: 1,
    preprod: 0,
    preview: 0,
  },

  // Genesis times (Unix seconds)
  genesis: {
    preview: 1666656000,
    preprod: 1654041600,
    mainnet: 1596059091,
  },

  // Slot duration (seconds)
  slotDuration: 1,

  // Blockfrost endpoints
  blockfrost: {
    mainnet: 'https://cardano-mainnet.blockfrost.io/api',
    preprod: 'https://cardano-preprod.blockfrost.io/api',
    preview: 'https://cardano-preview.blockfrost.io/api',
  },
};

// =============================================================================
// GOVERNANCE THRESHOLDS
// =============================================================================

export const GOVERNANCE = {
  // Voting thresholds (percentage)
  thresholds: {
    // Standard proposal pass threshold
    standard: env('GOV_THRESHOLD_STANDARD', 60),
    // Parameter change threshold
    parameter: env('GOV_THRESHOLD_PARAMETER', 66),
    // Emergency action threshold
    emergency: env('GOV_THRESHOLD_EMERGENCY', 75),
    // Constitutional change threshold
    constitutional: env('GOV_THRESHOLD_CONSTITUTIONAL', 80),
  },

  // Quorum requirements (percentage of eligible voters)
  quorum: {
    standard: env('GOV_QUORUM_STANDARD', 10),
    parameter: env('GOV_QUORUM_PARAMETER', 15),
    emergency: env('GOV_QUORUM_EMERGENCY', 5),
    constitutional: env('GOV_QUORUM_CONSTITUTIONAL', 25),
  },

  // Voting weights by verification level
  weights: {
    Basic: 0,
    Ward: 0,
    Standard: 1,
    Verified: 2,
    Steward: 3,
  },

  // Proposal costs (in ULTRA)
  proposalCosts: {
    standard: env('GOV_PROPOSAL_COST', 10),
    parameter: env('GOV_PROPOSAL_COST_PARAM', 25),
    spending: env('GOV_PROPOSAL_COST_SPENDING', 15),
    emergency: env('GOV_PROPOSAL_COST_EMERGENCY', 5),
  },

  // Voting period (in slots)
  votingPeriod: env('GOV_VOTING_PERIOD', 604800), // ~7 days

  // Execution delay after passing (in slots)
  executionDelay: env('GOV_EXECUTION_DELAY', 86400), // ~1 day

  // Minimum stewards for multi-sig actions
  minStewards: env('GOV_MIN_STEWARDS', 3),
};

// =============================================================================
// CYCLE LENGTHS
// =============================================================================

export const CYCLES = {
  // PRC-37 cycle (in slots, ~37 days)
  prc37: env('CYCLE_PRC37', 3196800),

  // Cardano epoch (in slots, ~5 days)
  cardanoEpoch: env('CYCLE_CARDANO_EPOCH', 432000),

  // UBI distribution cycle (in slots)
  ubiDistribution: env('CYCLE_UBI_DISTRIBUTION', 3196800),

  // Fee adjustment period (in slots, ~30 days)
  feeAdjustment: env('CYCLE_FEE_ADJUSTMENT', 2592000),

  // Health index update (in slots, ~7 days)
  healthUpdate: env('CYCLE_HEALTH_UPDATE', 604800),

  // Oracle update intervals (in seconds)
  oracle: {
    price: env('CYCLE_ORACLE_PRICE', 3600),       // 1 hour
    environmental: env('CYCLE_ORACLE_ENV', 86400), // 24 hours
    population: env('CYCLE_ORACLE_POP', 3196800),  // 1 cycle
  },

  // Staking cooldowns
  staking: {
    unstakeCooldown: env('CYCLE_UNSTAKE_COOLDOWN', 1296000), // ~15 days
    claimCooldown: env('CYCLE_CLAIM_COOLDOWN', 432000),      // ~5 days
  },
};

// =============================================================================
// FEE RATES
// =============================================================================

export const FEES = {
  // Transaction fees (in ULTRA)
  transactions: {
    // Identity
    mintPnftBasic: env('FEE_MINT_PNFT_BASIC', 10),
    upgradePnft: env('FEE_UPGRADE_PNFT', 5),
    recovery: env('FEE_RECOVERY', 20),

    // Marketplace
    createOffering: env('FEE_CREATE_OFFERING', 5),
    updateOffering: env('FEE_UPDATE_OFFERING', 2),
    cancelOffering: env('FEE_CANCEL_OFFERING', 1),
    acceptOffering: env('FEE_ACCEPT_OFFERING', 5),
    completeAgreement: env('FEE_COMPLETE_AGREEMENT', 2),

    // Transfers
    l1Transfer: env('FEE_L1_TRANSFER', 2),
    l2Transfer: env('FEE_L2_TRANSFER', 0.1),

    // Collectives
    createCollective: env('FEE_CREATE_COLLECTIVE', 20),
    collectiveProposal: env('FEE_COLLECTIVE_PROPOSAL', 5),

    // Impact
    recordImpact: env('FEE_RECORD_IMPACT', 1),
    verifyImpact: env('FEE_VERIFY_IMPACT', 5),

    // Governance
    createProposal: env('FEE_GOVERNANCE_PROPOSAL', 10),
    delegateVote: env('FEE_DELEGATE_VOTE', 1),

    // Staking
    registerValidator: env('FEE_REGISTER_VALIDATOR', 50),
    unstake: env('FEE_UNSTAKE', 5),

    // Hydra
    openHead: env('FEE_HYDRA_OPEN', 10),
    closeHead: env('FEE_HYDRA_CLOSE', 5),
  },

  // Fee allocation (percentage of collected fees)
  allocation: {
    ubiPool: env('FEE_ALLOC_UBI', 50),        // 50%
    validators: env('FEE_ALLOC_VALIDATORS', 30), // 30%
    treasury: env('FEE_ALLOC_TREASURY', 20),    // 20%
  },

  // Dynamic UBI fee range
  ubiRange: {
    min: env('FEE_UBI_MIN', 30),  // 30%
    max: env('FEE_UBI_MAX', 70),  // 70%
    adjustment: env('FEE_UBI_ADJUSTMENT', 5), // 5% per adjustment
  },

  // Market fees (basis points, 100 = 1%)
  market: {
    impactMarket: env('FEE_MARKET_IMPACT', 100),    // 1%
    marketplace: env('FEE_MARKET_GENERAL', 100),    // 1%
    workAuction: env('FEE_MARKET_WORK', 100),       // 1%
  },
};

// =============================================================================
// PRICES AND RATES
// =============================================================================

export const PRICES = {
  // Impact market default prices (ULTRA per unit)
  impact: {
    Carbon: env('PRICE_IMPACT_CARBON', 10),        // per tCO2
    Water: env('PRICE_IMPACT_WATER', 15),          // per 1000L
    Biodiversity: env('PRICE_IMPACT_BIO', 25),     // per index point
    Soil: env('PRICE_IMPACT_SOIL', 12),            // per soil unit
    Air: env('PRICE_IMPACT_AIR', 8),               // per air quality unit
    Waste: env('PRICE_IMPACT_WASTE', 5),           // per kg diverted
    Energy: env('PRICE_IMPACT_ENERGY', 7),         // per kWh saved
    LandUse: env('PRICE_IMPACT_LAND', 20),         // per hectare-year
  },

  // Land sequestration rates (tCO2/ha/year)
  sequestration: {
    forest: env('SEQ_FOREST', 5.0),
    wetland: env('SEQ_WETLAND', 3.0),
    grassland: env('SEQ_GRASSLAND', 1.0),
    agricultural: env('SEQ_AGRICULTURAL', 0.5),
    urban: env('SEQ_URBAN', 0.1),
    coastal: env('SEQ_COASTAL', 2.5),
    desert: env('SEQ_DESERT', 0.05),
  },

  // Token economics
  token: {
    totalSupply: 400_000_000_000n, // 400 billion ULTRA
    bootstrapGrant: env('TOKEN_BOOTSTRAP_GRANT', 50), // ULTRA per verified pNFT
    founderMonthly: env('TOKEN_FOUNDER_MONTHLY', 10000), // USD equivalent
  },

  // UBI targets
  ubi: {
    targetPerEpoch: env('UBI_TARGET_EPOCH', 100), // ULTRA per person per epoch
    survivalFloor: env('UBI_SURVIVAL_FLOOR', 20), // ULTRA minimum
    engagementMax: env('UBI_ENGAGEMENT_MAX', 5),  // Max transactions for full UBI
  },

  // Price bounds
  bounds: {
    minPrice: env('PRICE_MIN', 1),          // Minimum 1 ULTRA
    maxPrice: env('PRICE_MAX', 10000),      // Maximum 10,000 ULTRA
    maxEpochChange: env('PRICE_MAX_CHANGE', 0.25), // 25% max per epoch
  },
};

// =============================================================================
// CARE ECONOMY
// =============================================================================

export const CARE = {
  // Base credit rate
  creditsPerHour: env('CARE_CREDITS_PER_HOUR', 10),

  // Maximum hours
  maxDailyHours: env('CARE_MAX_DAILY_HOURS', 16),
  maxWeeklyHours: env('CARE_MAX_WEEKLY_HOURS', 84),

  // Care type multipliers
  multipliers: {
    Childcare_Infant: 1.5,
    Childcare_Toddler: 1.4,
    Childcare_Preschool: 1.2,
    Childcare_SchoolAge: 1.0,
    Childcare_Adolescent: 1.1,
    ElderCare_Independent: 0.8,
    ElderCare_Assisted: 1.2,
    ElderCare_FullTime: 1.5,
    ElderCare_Medical: 1.8,
    ElderCare_Palliative: 2.0,
    DisabilityCare: 1.3,
    HealthSupport: 1.2,
    Household: 0.8,
    CommunityService: 1.0,
    FamilySupport: 1.0,
  },

  // Attestation requirements
  minAttestations: env('CARE_MIN_ATTESTATIONS', 2),

  // Credit to UBI conversion
  ubiCreditRate: env('CARE_UBI_RATE', 0.1),
  maxUbiBoostPercent: env('CARE_MAX_UBI_BOOST', 50),

  // Direct conversion rate (ULTRA per credit)
  ultraExchangeRate: env('CARE_ULTRA_RATE', 0.05),

  // Cooldowns (in slots)
  cooldowns: {
    claim: env('CARE_COOLDOWN_CLAIM', 14400),      // ~4 hours
    conversion: env('CARE_COOLDOWN_CONVERT', 86400), // ~24 hours
  },
};

// =============================================================================
// IMPACT MARKET
// =============================================================================

export const IMPACT = {
  // Order constraints
  minOrderSize: env('IMPACT_MIN_ORDER', 1),
  maxOrderSize: env('IMPACT_MAX_ORDER', 100000),
  defaultExpirySlots: env('IMPACT_DEFAULT_EXPIRY', 604800), // ~7 days

  // Verification requirements
  minSurveyors: env('IMPACT_MIN_SURVEYORS', 2),
  surveyorLevel: 'Verified',

  // Offset requirements
  offsetRatio: env('IMPACT_OFFSET_RATIO', 1.1), // 10% buffer
  gracePeriodCycles: env('IMPACT_GRACE_PERIOD', 2),

  // Penalties (multiplier per cycle past grace)
  penalties: {
    cycle1: 1.1,  // 10%
    cycle2: 1.2,  // 20%
    cycle3: 1.5,  // 50%
    cycle4: 2.0,  // 100%
  },

  // Project funding overhead
  projectOverhead: env('IMPACT_PROJECT_OVERHEAD', 1.2), // 20%
};

// =============================================================================
// PROTOCOL PARAMETERS
// =============================================================================

export const PROTOCOL = {
  // Protocol name
  name: env('PROTOCOL_NAME', 'UltraLife'),

  // Initial treasury amounts (in lovelace)
  initialTreasuryAda: BigInt(env('INITIAL_TREASURY', '100000000')), // 100 ADA
  initialUbiPoolAda: BigInt(env('INITIAL_UBI_POOL', '50000000')),   // 50 ADA

  // Staking parameters
  staking: {
    minValidatorStake: env('STAKING_MIN_VALIDATOR', 10000), // ULTRA
    baseApy: env('STAKING_BASE_APY', 5), // 5%
  },

  // Oracle parameters
  oracle: {
    maxStaleness: env('ORACLE_MAX_STALENESS', 7200), // 2 hours
    minSources: env('ORACLE_MIN_SOURCES', 3),
    minStake: {
      Price: 10000,
      Environmental: 5000,
      Impact: 15000,
      Population: 20000,
    },
  },

  // Verification levels
  levels: {
    Basic: 0,
    Ward: 1,
    Standard: 2,
    Verified: 3,
    Steward: 4,
  },
};

// =============================================================================
// FILE PATHS
// =============================================================================

export const PATHS = {
  plutus: path.join(__dirname, '..', 'plutus.json'),
  deployment: path.join(__dirname, 'deployment.json'),
  protocolSpec: path.join(__dirname, 'protocol-schema.json'),
  testResults: path.join(__dirname, 'e2e-test-results.json'),
};

// =============================================================================
// FEE ESTIMATION (in lovelace)
// =============================================================================

export const FEE_ESTIMATES = {
  simpleTransfer: 200_000,
  referenceScriptBase: 500_000,
  referenceScriptPerByte: 50,
  mintTransaction: 400_000,
  contractInteraction: 800_000,
  genesisInit: 1_500_000,
};

export const MIN_UTXO_LOVELACE = 1_000_000n;

// =============================================================================
// MAIN CONFIG OBJECT
// =============================================================================

/**
 * Main configuration object with environment-based overrides.
 * This is the primary export for most scripts.
 */
export const config = {
  // Network
  network: NETWORK.name,
  networkId: NETWORK.ids[NETWORK.name] ?? 0,
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  walletMnemonic: process.env.WALLET_SEED_PHRASE,

  // IPFS
  ipfsProvider: env('IPFS_PROVIDER', 'pinata'),
  pinataApiKey: process.env.PINATA_API_KEY,
  pinataSecret: process.env.PINATA_SECRET,
  web3StorageToken: process.env.WEB3_STORAGE_TOKEN,

  // Paths
  paths: PATHS,

  // Feature flags
  features: {
    hydraEnabled: env('FEATURE_HYDRA', false),
    oraclesEnabled: env('FEATURE_ORACLES', false),
    mainnetMode: env('FEATURE_MAINNET', false),
  },

  // Debug
  debug: env('DEBUG', false),
  verbose: env('VERBOSE', false),
};

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate configuration for required values.
 * Call this at script startup to fail fast on missing config.
 */
export function validateConfig(requirements = ['blockfrostKey']) {
  const missing = [];

  if (requirements.includes('blockfrostKey') && !config.blockfrostKey) {
    missing.push('BLOCKFROST_API_KEY');
  }

  if (requirements.includes('walletMnemonic') && !config.walletMnemonic) {
    missing.push('WALLET_SEED_PHRASE');
  }

  if (requirements.includes('ipfs')) {
    if (config.ipfsProvider === 'pinata') {
      if (!config.pinataApiKey) missing.push('PINATA_API_KEY');
      if (!config.pinataSecret) missing.push('PINATA_SECRET');
    } else if (config.ipfsProvider === 'web3storage') {
      if (!config.web3StorageToken) missing.push('WEB3_STORAGE_TOKEN');
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}\nSet these in your .env file.`);
  }

  return true;
}

// =============================================================================
// EXPORTS SUMMARY
// =============================================================================

export default {
  config,
  NETWORK,
  GOVERNANCE,
  CYCLES,
  FEES,
  PRICES,
  CARE,
  IMPACT,
  PROTOCOL,
  PATHS,
  FEE_ESTIMATES,
  MIN_UTXO_LOVELACE,
  validateConfig,
};
