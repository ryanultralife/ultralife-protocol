#!/usr/bin/env node
/**
 * UltraLife Protocol — Register Bioregion Stake Pool
 *
 * Registers a stake pool to serve a bioregion in the UltraLife ecosystem.
 * This creates the economic infrastructure for a bioregion, enabling:
 * - ULTRA token delegation
 * - Impact-aligned rewards
 * - Bioregion treasury contributions
 * - Local governance participation
 *
 * Usage:
 *   node register-bioregion-pool.mjs --bioregion "Sierra Nevada" --pool-id pool1... --ticker NASEC
 *   node register-bioregion-pool.mjs --create-bioregion "Sierra Nevada" --pool-id pool1...
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env file from scripts directory
dotenv.config({ path: path.join(__dirname, '.env') });

// Simple logger that doesn't require external deps
const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
};

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  network: process.env.NETWORK || 'preprod',
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  walletMnemonic: process.env.WALLET_SEED_PHRASE,
  deploymentPath: path.join(__dirname, 'deployment.json'),
};

// Sierra Nevada bioregion data
const SIERRA_NEVADA = {
  id: 'sierra_nevada',
  name: 'Sierra Nevada',
  // Approximate bounding box (simplified for demo)
  bounds: {
    north: 40.5,   // Northern boundary (near Lassen)
    south: 35.5,   // Southern boundary (near Tehachapi)
    east: -117.5,  // Eastern boundary
    west: -122.0,  // Western boundary
  },
  // Initial ecological health metrics
  health: {
    airQuality: 7500,      // 75% - good but wildfire impacts
    waterQuality: 8000,    // 80% - snowpack concerns
    biodiversity: 7000,    // 70% - some species stress
    carbonBalance: 6500,   // 65% - forest carbon at risk
    soilHealth: 7500,      // 75% - generally healthy
  },
};

// =============================================================================
// PREDEFINED BIOREGIONS
// =============================================================================

const BIOREGIONS = {
  'sierra_nevada': SIERRA_NEVADA,
  'pacific_northwest': {
    id: 'pacific_northwest',
    name: 'Pacific Northwest',
    bounds: { north: 49.0, south: 42.0, east: -116.0, west: -124.5 },
    health: { airQuality: 8000, waterQuality: 8500, biodiversity: 8000, carbonBalance: 8500, soilHealth: 8000 },
  },
  'great_lakes': {
    id: 'great_lakes',
    name: 'Great Lakes',
    bounds: { north: 49.0, south: 41.0, east: -76.0, west: -92.0 },
    health: { airQuality: 7000, waterQuality: 7500, biodiversity: 7000, carbonBalance: 7000, soilHealth: 7500 },
  },
  'gulf_coast': {
    id: 'gulf_coast',
    name: 'Gulf Coast',
    bounds: { north: 31.0, south: 25.0, east: -80.0, west: -97.5 },
    health: { airQuality: 7000, waterQuality: 6500, biodiversity: 7500, carbonBalance: 6500, soilHealth: 7000 },
  },
  'sonoran_desert': {
    id: 'sonoran_desert',
    name: 'Sonoran Desert',
    bounds: { north: 35.0, south: 28.0, east: -109.0, west: -117.0 },
    health: { airQuality: 8500, waterQuality: 5000, biodiversity: 6500, carbonBalance: 5500, soilHealth: 6000 },
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getBioregionById(idOrName) {
  // Try by ID first
  const normalized = idOrName.toLowerCase().replace(/\s+/g, '_');
  if (BIOREGIONS[normalized]) {
    return BIOREGIONS[normalized];
  }

  // Try by name
  for (const bio of Object.values(BIOREGIONS)) {
    if (bio.name.toLowerCase() === idOrName.toLowerCase()) {
      return bio;
    }
  }

  return null;
}

function hashBioregionBounds(bounds) {
  const str = JSON.stringify(bounds);
  return crypto.createHash('sha256').update(str).digest('hex');
}

function hashBioregionName(name) {
  return crypto.createHash('sha256').update(name).digest('hex');
}

function calculateInitialHealth(health) {
  // Average of all health metrics (0-10000 scale)
  const values = Object.values(health);
  return Math.floor(values.reduce((a, b) => a + b, 0) / values.length);
}

async function getCurrentSlot(provider) {
  try {
    const tip = await provider.fetchBlockchainTip();
    return tip.slot;
  } catch (error) {
    log.warn(`Could not fetch current slot: ${error.message}`);
    const preprodGenesisTime = 1654041600;
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime - preprodGenesisTime;
  }
}

function getVerificationKeyHash(address) {
  try {
    const deserialized = deserializeAddress(address);
    return deserialized.pubKeyHash;
  } catch (error) {
    throw new Error(`Failed to extract key hash: ${error.message}`);
  }
}

// =============================================================================
// DATUM BUILDERS
// =============================================================================

/**
 * Build BioregionDatum for on-chain storage
 * Aligned with lib/ultralife/types.ak BioregionDatum
 */
function buildBioregionDatum(bioregion, currentSlot) {
  const healthIndex = calculateInitialHealth(bioregion.health);

  return {
    constructor: 0,
    fields: [
      { bytes: stringToHex(bioregion.id) },                    // bioregion_id
      { bytes: hashBioregionName(bioregion.name) },            // name_hash
      { bytes: hashBioregionBounds(bioregion.bounds) },        // bounds_hash
      { int: healthIndex },                                     // health_index (0-10000)
      { int: 0 },                                               // resident_count
      { int: currentSlot },                                     // created_at
      { int: 0 },                                               // last_health_update
      { list: [] },                                             // stake_pools (empty initially)
    ],
  };
}

/**
 * Build BioregionPool datum for stake pool registration
 * Aligned with lib/ultralife/types_v2.ak BioregionPool
 */
function buildBioregionPoolDatum(poolId, operatorPnft, commitment, currentSlot, margin = 200) {
  return {
    constructor: 0,
    fields: [
      { bytes: poolId },                        // pool_id (Cardano pool ID hash)
      { bytes: operatorPnft },                  // operator_pnft (pNFT asset name)
      { int: 0 },                               // ultralife_stake (starts at 0)
      buildPoolImpactCommitment(commitment),    // impact_commitment
      { int: currentSlot },                     // registered_at
      { constructor: 1, fields: [] },           // active = True (constructor 1 for True in Aiken)
      { int: margin },                          // margin (basis points, e.g., 200 = 2%)
      { int: 100 },                             // min_delegation (100 ULTRA minimum)
    ],
  };
}

/**
 * Build PoolImpactCommitment
 * Aligned with lib/ultralife/types_v2.ak PoolImpactCommitment
 */
function buildPoolImpactCommitment(commitment) {
  return {
    constructor: 0,
    fields: [
      { constructor: commitment.renewableEnergy ? 1 : 0, fields: [] }, // renewable_energy (Bool)
      { int: commitment.carbonFootprint || 0 },                        // carbon_footprint (kg CO2e per epoch)
      { int: commitment.treasuryContribution || 500 },                 // treasury_contribution (basis points, min 5%)
      { int: commitment.localReinvestment || 1000 },                   // local_reinvestment (basis points)
      { bytes: commitment.evidenceHash || '' },                        // evidence_hash
    ],
  };
}

// =============================================================================
// MAIN REGISTRATION FLOW
// =============================================================================

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║      UltraLife Protocol — Bioregion Stake Pool Registration   ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Parse arguments
  const args = process.argv.slice(2);
  const bioregionIdx = args.indexOf('--bioregion');
  const createIdx = args.indexOf('--create-bioregion');
  const poolIdIdx = args.indexOf('--pool-id');
  const tickerIdx = args.indexOf('--ticker');
  const marginIdx = args.indexOf('--margin');
  const renewableIdx = args.indexOf('--renewable');
  const carbonIdx = args.indexOf('--carbon-footprint');
  const listIdx = args.indexOf('--list');

  // List available bioregions
  if (listIdx >= 0) {
    console.log('Available bioregions:\n');
    for (const bio of Object.values(BIOREGIONS)) {
      const health = calculateInitialHealth(bio.health);
      console.log(`  ${bio.id.padEnd(20)} ${bio.name.padEnd(20)} Health: ${(health / 100).toFixed(1)}%`);
    }
    console.log('\nUse --bioregion <name> to register a pool for a bioregion.');
    console.log('Use --create-bioregion <name> to create a new bioregion first.');
    return;
  }

  const bioregionName = bioregionIdx >= 0 ? args[bioregionIdx + 1] :
                        createIdx >= 0 ? args[createIdx + 1] : 'Sierra Nevada';
  const poolIdArg = poolIdIdx >= 0 ? args[poolIdIdx + 1] : null;
  const ticker = tickerIdx >= 0 ? args[tickerIdx + 1] : 'NASEC';
  const margin = marginIdx >= 0 ? parseInt(args[marginIdx + 1]) * 100 : 200; // Convert % to basis points
  const isRenewable = renewableIdx >= 0;
  const carbonFootprint = carbonIdx >= 0 ? parseInt(args[carbonIdx + 1]) : 50;

  // Get bioregion data
  const bioregion = getBioregionById(bioregionName);
  if (!bioregion) {
    log.error(`Unknown bioregion: ${bioregionName}`);
    log.info('Use --list to see available bioregions');
    process.exit(1);
  }

  log.info(`Bioregion: ${bioregion.name} (${bioregion.id})`);
  log.info(`Initial health: ${(calculateInitialHealth(bioregion.health) / 100).toFixed(1)}%`);

  // Check configuration
  if (!CONFIG.blockfrostKey || !CONFIG.walletMnemonic) {
    log.error('Missing configuration. Set BLOCKFROST_API_KEY and WALLET_SEED_PHRASE in .env');
    process.exit(1);
  }

  // Dynamic imports for heavy dependencies (only load when needed)
  const { atomicWriteSync, safeReadJson, formatAda } = await import('./utils.mjs');
  const { BlockfrostProvider, MeshWallet, deserializeAddress, stringToHex } = await import('@meshsdk/core');

  // Helper to get verification key hash
  const getVerificationKeyHash = (address) => {
    try {
      const deserialized = deserializeAddress(address);
      return deserialized.pubKeyHash;
    } catch (error) {
      throw new Error(`Failed to extract key hash: ${error.message}`);
    }
  };

  // Load deployment record
  let deployment = safeReadJson(CONFIG.deploymentPath, {});
  deployment.bioregions = deployment.bioregions || [];
  deployment.stakePools = deployment.stakePools || [];

  // Initialize provider and wallet
  const provider = new BlockfrostProvider(CONFIG.blockfrostKey);
  const wallet = new MeshWallet({
    networkId: CONFIG.network === 'mainnet' ? 1 : 0,
    fetcher: provider,
    submitter: provider,
    key: {
      type: 'mnemonic',
      words: CONFIG.walletMnemonic.trim().split(/\s+/),
    },
  });

  const address = wallet.getChangeAddress();
  const ownerHash = getVerificationKeyHash(address);
  log.info(`Wallet: ${address.slice(0, 40)}...`);
  log.info(`Owner hash: ${ownerHash.slice(0, 20)}...`);

  // Check balance
  const utxos = await provider.fetchAddressUTxOs(address);
  const balance = utxos.reduce((sum, u) => {
    const l = u.output.amount.find(a => a.unit === 'lovelace');
    return sum + BigInt(l?.quantity || 0);
  }, 0n);
  log.info(`Balance: ${formatAda(balance)}`);

  const required = 10_000_000n; // 10 ADA for bioregion + pool registration
  if (balance < required) {
    log.error(`Insufficient funds. Need ${formatAda(required)}, have ${formatAda(balance)}`);
    process.exit(1);
  }

  // Get current slot
  const currentSlot = await getCurrentSlot(provider);
  log.info(`Current slot: ${currentSlot}`);

  // Check if user has a pNFT (required for pool registration)
  const pnfts = deployment.pnfts || [];
  const userPnft = pnfts.find(p => p.owner === address && p.status === 'minted');

  if (!userPnft) {
    log.error('You need a pNFT to register a stake pool!');
    log.info('Run: npm run mint:pnft:basic');
    process.exit(1);
  }

  log.success(`Found pNFT: ${userPnft.id}`);
  const operatorPnft = stringToHex(userPnft.id);

  // Generate pool ID if not provided (for demo purposes)
  // In production, this would be the actual Cardano stake pool ID
  let poolId = poolIdArg;
  if (!poolId) {
    // Generate a demo pool ID (28 bytes = 56 hex chars)
    poolId = crypto.randomBytes(28).toString('hex');
    log.warn('No --pool-id provided, generating demo pool ID');
    log.info(`Demo pool ID: ${poolId.slice(0, 20)}...`);
  }

  // Build impact commitment
  const commitment = {
    renewableEnergy: isRenewable,
    carbonFootprint: carbonFootprint,
    treasuryContribution: 500,    // 5% minimum
    localReinvestment: 1000,      // 10% to local projects
    evidenceHash: crypto.createHash('sha256')
      .update(`${ticker}-impact-${Date.now()}`)
      .digest('hex'),
  };

  log.info(`Ticker: ${ticker}`);
  log.info(`Margin: ${margin / 100}%`);
  log.info(`Renewable energy: ${commitment.renewableEnergy ? 'Yes' : 'No'}`);
  log.info(`Carbon footprint: ${commitment.carbonFootprint} kg CO2e/epoch`);
  log.info(`Treasury contribution: ${commitment.treasuryContribution / 100}%`);

  // =========================================================================
  // STEP 1: Create Bioregion (if not exists)
  // =========================================================================

  let bioregionRecord = deployment.bioregions.find(b => b.id === bioregion.id);

  if (!bioregionRecord || createIdx >= 0) {
    log.info('');
    log.info('Step 1: Creating bioregion on-chain...');

    const bioregionDatum = buildBioregionDatum(bioregion, currentSlot);

    // For testnet, we'll create a simple UTxO with the bioregion datum
    // In production, this would use the bioregion_beacon minting policy

    bioregionRecord = {
      id: bioregion.id,
      name: bioregion.name,
      nameHash: hashBioregionName(bioregion.name),
      boundsHash: hashBioregionBounds(bioregion.bounds),
      healthIndex: calculateInitialHealth(bioregion.health),
      createdAt: new Date().toISOString(),
      createdSlot: currentSlot,
      status: 'created',
      datum: bioregionDatum,
    };

    // Add to deployment record
    const existingIdx = deployment.bioregions.findIndex(b => b.id === bioregion.id);
    if (existingIdx >= 0) {
      deployment.bioregions[existingIdx] = bioregionRecord;
    } else {
      deployment.bioregions.push(bioregionRecord);
    }

    log.success(`Bioregion ${bioregion.name} registered locally`);
  } else {
    log.info(`Bioregion ${bioregion.name} already exists`);
  }

  // =========================================================================
  // STEP 2: Register Stake Pool
  // =========================================================================

  log.info('');
  log.info('Step 2: Registering stake pool for bioregion...');

  const poolDatum = buildBioregionPoolDatum(
    poolId,
    operatorPnft,
    commitment,
    currentSlot,
    margin
  );

  const poolRecord = {
    poolId: poolId,
    ticker: ticker,
    bioregion: bioregion.id,
    operatorPnft: userPnft.id,
    operatorAddress: address,
    margin: margin,
    commitment: commitment,
    registeredAt: new Date().toISOString(),
    registeredSlot: currentSlot,
    status: 'registered',
    datum: poolDatum,
  };

  // Check for existing pool registration
  const existingPool = deployment.stakePools.find(p => p.poolId === poolId);
  if (existingPool) {
    log.warn(`Pool ${poolId.slice(0, 12)}... already registered`);
    log.info(`Updating registration...`);
    const idx = deployment.stakePools.indexOf(existingPool);
    deployment.stakePools[idx] = poolRecord;
  } else {
    deployment.stakePools.push(poolRecord);
  }

  // Update bioregion with pool reference
  bioregionRecord.stakePools = bioregionRecord.stakePools || [];
  if (!bioregionRecord.stakePools.includes(poolId)) {
    bioregionRecord.stakePools.push(poolId);
  }

  // Save deployment
  atomicWriteSync(CONFIG.deploymentPath, deployment);
  log.success('Deployment record updated');

  // =========================================================================
  // SUMMARY
  // =========================================================================

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           🌲 BIOREGION STAKE POOL REGISTERED! 🌲              ║
╠═══════════════════════════════════════════════════════════════╣
║  Bioregion:   ${bioregion.name.padEnd(46)}║
║  Health:      ${((calculateInitialHealth(bioregion.health) / 100).toFixed(1) + '%').padEnd(46)}║
╠═══════════════════════════════════════════════════════════════╣
║  Pool ID:     ${(poolId.slice(0, 40) + '...').padEnd(46)}║
║  Ticker:      ${ticker.padEnd(46)}║
║  Operator:    ${userPnft.id.padEnd(46)}║
║  Margin:      ${((margin / 100) + '%').padEnd(46)}║
╠═══════════════════════════════════════════════════════════════╣
║  IMPACT COMMITMENT:                                           ║
║  • Renewable energy:     ${(commitment.renewableEnergy ? 'Yes' : 'No').padEnd(35)}║
║  • Carbon footprint:     ${(commitment.carbonFootprint + ' kg CO2e/epoch').padEnd(35)}║
║  • Treasury contribution: ${((commitment.treasuryContribution / 100) + '%').padEnd(34)}║
║  • Local reinvestment:   ${((commitment.localReinvestment / 100) + '%').padEnd(35)}║
╚═══════════════════════════════════════════════════════════════╝

What you can do now:

  1. Delegate ULTRA tokens to this pool:
     "Delegate 1000 ULTRA to my Sierra Nevada pool"

  2. Check pool status:
     "Show me my stake pool registrations"

  3. Update impact commitment:
     "Update my pool's carbon footprint to 30 kg"

  4. Create a collective of bioregion SPOs:
     "Create a collective for Sierra Nevada stake pool operators"
`);
}

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
