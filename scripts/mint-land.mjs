#!/usr/bin/env node
/**
 * UltraLife Protocol — Mint Land NFT
 *
 * Register land into the UltraLife system.
 * Land is not owned — land is stewarded.
 *
 * Usage:
 *   node mint-land.mjs --name "Quincy Forest Parcel" --area 16000 --type forest
 *   node mint-land.mjs --name "Urban Garden" --area 500 --type agricultural --bioregion sierra_nevada
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// Fix libsodium ESM
function fixLibsodiumESM() {
  const nodeModules = path.join(__dirname, 'node_modules');
  const targetDir = path.join(nodeModules, 'libsodium-wrappers-sumo', 'dist', 'modules-sumo-esm');
  const targetFile = path.join(targetDir, 'libsodium-sumo.mjs');
  const sourceFile = path.join(nodeModules, 'libsodium-sumo', 'dist', 'modules-sumo-esm', 'libsodium-sumo.mjs');
  if (!fs.existsSync(targetFile) && fs.existsSync(sourceFile)) {
    try { fs.copyFileSync(sourceFile, targetFile); } catch (err) {}
  }
}
fixLibsodiumESM();

const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
};

const CONFIG = {
  network: process.env.NETWORK || 'preprod',
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  walletMnemonic: process.env.WALLET_SEED_PHRASE,
  deploymentPath: path.join(__dirname, 'deployment.json'),
};

// Land classifications matching Aiken validator
const LAND_TYPES = {
  forest: {
    name: 'Forest',
    terrain: 'Mountainous',
    ecosystem: 'Forest',
    description: 'Forested land with timber/carbon rights',
    sequestrationRate: 5.0, // tonnes CO2/ha/year
  },
  agricultural: {
    name: 'Agricultural',
    terrain: 'Valley',
    ecosystem: 'Agricultural',
    description: 'Cultivated land for food production',
    sequestrationRate: 0.5,
  },
  wetland: {
    name: 'Wetland',
    terrain: 'Wetland',
    ecosystem: 'Wetland',
    description: 'Protected wetland ecosystem',
    sequestrationRate: 3.0,
  },
  grassland: {
    name: 'Grassland',
    terrain: 'Plains',
    ecosystem: 'Grassland',
    description: 'Rangeland or prairie',
    sequestrationRate: 1.0,
  },
  urban: {
    name: 'Urban',
    terrain: 'Urban',
    ecosystem: 'Urban',
    description: 'Urban/developed land',
    sequestrationRate: 0.1,
  },
  coastal: {
    name: 'Coastal',
    terrain: 'Coastal',
    ecosystem: 'Coastal',
    description: 'Coastal zone with marine interface',
    sequestrationRate: 2.0,
  },
  desert: {
    name: 'Desert',
    terrain: 'Desert',
    ecosystem: 'Desert',
    description: 'Arid/semi-arid land',
    sequestrationRate: 0.2,
  },
};

// Right types from the validator
const RIGHTS = ['surface', 'subsurface', 'water', 'air', 'cellulose', 'development', 'carbon', 'access'];

function generateLandId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return `land_${timestamp}_${random}`;
}

function generateBoundsHash(name, area) {
  // Simulate geographic bounds hash (would be real GPS coordinates in production)
  return crypto.createHash('sha256')
    .update(`${name}-${area}-${Date.now()}`)
    .digest('hex');
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║        UltraLife Protocol — Register Land Stewardship         ║
║                                                               ║
║              "Land is not owned. Land is stewarded."          ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Parse arguments
  const args = process.argv.slice(2);
  const nameIdx = args.indexOf('--name');
  const areaIdx = args.indexOf('--area');
  const typeIdx = args.indexOf('--type');
  const bioregionIdx = args.indexOf('--bioregion');
  const listIdx = args.indexOf('--list');
  const listTypesIdx = args.indexOf('--list-types');

  const { atomicWriteSync, safeReadJson, formatAda } = await import('./utils.mjs');
  const { BlockfrostProvider, MeshWallet } = await import('@meshsdk/core');

  // Load deployment
  const deployment = safeReadJson(CONFIG.deploymentPath, {});
  deployment.lands = deployment.lands || [];

  // List land types
  if (listTypesIdx >= 0) {
    console.log('Available land types:\n');
    for (const [key, type] of Object.entries(LAND_TYPES)) {
      console.log(`  ${key.padEnd(14)} ${type.description}`);
      console.log(`                Sequestration: ${type.sequestrationRate} tCO2/ha/year\n`);
    }
    return;
  }

  // List registered lands
  if (listIdx >= 0) {
    if (deployment.lands.length === 0) {
      log.info('No lands registered yet.');
      log.info('Register one: npm run land:mint -- --name "My Forest" --area 10000 --type forest');
    } else {
      console.log('Registered lands:\n');
      for (const land of deployment.lands) {
        console.log(`  ${land.name.padEnd(25)} ${land.landId.slice(0, 20)}...`);
        console.log(`    Type: ${land.classification.name}, Area: ${land.area_m2.toLocaleString()} m²`);
        console.log(`    Steward: ${land.primarySteward.slice(0, 30)}...`);
        console.log(`    Rights held: ${Object.keys(land.rights).length}\n`);
      }
    }
    return;
  }

  if (!CONFIG.blockfrostKey || !CONFIG.walletMnemonic) {
    log.error('Missing configuration. Set BLOCKFROST_API_KEY and WALLET_SEED_PHRASE in .env');
    process.exit(1);
  }

  // Parse land details
  const landName = nameIdx >= 0 ? args[nameIdx + 1] : `Land_${Date.now().toString(36)}`;
  const area = areaIdx >= 0 ? parseInt(args[areaIdx + 1]) : 10000;
  const typeArg = typeIdx >= 0 ? args[typeIdx + 1].toLowerCase() : 'forest';
  const landType = LAND_TYPES[typeArg] || LAND_TYPES.forest;
  const bioregion = bioregionIdx >= 0 ? args[bioregionIdx + 1] : 'sierra_nevada';

  if (isNaN(area) || area < 100) {
    log.error('Invalid area. Minimum 100 m²');
    process.exit(1);
  }

  // Initialize wallet (steward)
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

  const stewardAddress = wallet.getChangeAddress();

  // Find steward's pNFT
  const pnfts = deployment.pnfts || [];
  const stewardPnft = pnfts.find(p => p.owner === stewardAddress && p.status === 'minted');

  if (!stewardPnft) {
    log.error('You need a pNFT to register land!');
    log.info('Mint one first: npm run mint:pnft:basic');
    process.exit(1);
  }

  // Check verification level (Verified+ required for land stewardship)
  // For testnet, we'll allow Basic level with a warning
  if (stewardPnft.level === 'Basic') {
    log.warn('Basic pNFT level detected.');
    log.warn('Production requires Verified+ level to steward land.');
    log.info('Proceeding with testnet simulation...');
  }

  log.info(`Registering land: ${landName}`);
  log.info(`Type: ${landType.name} - ${landType.description}`);
  log.info(`Area: ${area.toLocaleString()} m² (${(area / 10000).toFixed(2)} hectares)`);
  log.info(`Bioregion: ${bioregion}`);
  log.info(`Steward: ${stewardPnft.id}`);

  // Generate land record
  const landId = generateLandId();
  const boundsHash = generateBoundsHash(landName, area);
  const currentSlot = Math.floor(Date.now() / 1000) - 1654041600;

  // Calculate sequestration capacity
  const hectares = area / 10000;
  const annualSequestration = hectares * landType.sequestrationRate;
  const cycleSequestration = annualSequestration / 10; // ~37-day cycles, ~10/year

  // Initialize all rights to primary steward
  const defaultRightHolder = {
    holder: stewardPnft.id,
    acquisition: 'Original',
    acquired_at: currentSlot,
    transferable: true,
    steward_share: 7000, // 70%
    bioregion_share: 2000, // 20%
    expires: null,
    conditions: null,
  };

  const rights = {};
  for (const right of RIGHTS) {
    rights[right] = { ...defaultRightHolder };
  }

  // Carbon rights have special significance for sequestration
  rights.carbon.sequestrationCapacity = cycleSequestration;

  // Access rights default to controlled
  rights.access = {
    ...defaultRightHolder,
    public_access: false,
    min_level_required: 'Basic',
    access_fee: null,
    allowed_pnfts: [],
  };

  // Create land record
  const landRecord = {
    landId: landId,
    name: landName,
    boundsHash: boundsHash,
    area_m2: area,
    bioregion: bioregion,
    classification: {
      name: landType.name,
      terrain: landType.terrain,
      ecosystem: landType.ecosystem,
      sequestrationRate: landType.sequestrationRate,
    },
    health: {
      overall_index: 75, // Default healthy
      soil_health: 70,
      water_health: 80,
      biodiversity_index: 70,
      carbon_stock: hectares * 100, // tonnes (rough estimate)
      last_survey: null,
    },
    primarySteward: stewardPnft.id,
    stewardAddress: stewardAddress,
    rights: rights,
    traditional_territory: null,
    cultural_protocols: null,
    registered_at: currentSlot,
    registeredAt: new Date().toISOString(),
    testnetSimulated: true,
  };

  // Store land
  deployment.lands.push(landRecord);

  // Update pNFT with land stewardship
  const pnftIdx = pnfts.findIndex(p => p.id === stewardPnft.id);
  if (pnftIdx >= 0) {
    deployment.pnfts[pnftIdx].lands_stewarded = deployment.pnfts[pnftIdx].lands_stewarded || [];
    deployment.pnfts[pnftIdx].lands_stewarded.push(landId);
  }

  // Update bioregion stats
  deployment.bioregionStats = deployment.bioregionStats || {};
  deployment.bioregionStats[bioregion] = deployment.bioregionStats[bioregion] || {
    totalLandArea: 0,
    landsRegistered: 0,
    totalSequestrationCapacity: 0,
  };
  deployment.bioregionStats[bioregion].totalLandArea += area;
  deployment.bioregionStats[bioregion].landsRegistered += 1;
  deployment.bioregionStats[bioregion].totalSequestrationCapacity += annualSequestration;

  atomicWriteSync(CONFIG.deploymentPath, deployment);

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              🌲 LAND REGISTERED AS STEWARDSHIP! 🌲            ║
╠═══════════════════════════════════════════════════════════════╣
║  Land ID:    ${landId.padEnd(46)}║
║  Name:       ${landName.padEnd(46)}║
║  Type:       ${landType.name.padEnd(46)}║
║  Area:       ${(area.toLocaleString() + ' m² (' + (area / 10000).toFixed(2) + ' ha)').padEnd(46)}║
║  Bioregion:  ${bioregion.padEnd(46)}║
╠═══════════════════════════════════════════════════════════════╣
║  PRIMARY STEWARD:                                             ║
║    ${stewardPnft.id.padEnd(57)}║
╠═══════════════════════════════════════════════════════════════╣
║  RIGHTS REGISTERED (all held by steward):                     ║
║    Surface, Subsurface, Water, Air, Cellulose,                ║
║    Development, Carbon, Access                                ║
╠═══════════════════════════════════════════════════════════════╣
║  SEQUESTRATION CAPACITY:                                      ║
║    Annual:  ${(annualSequestration.toFixed(2) + ' tonnes CO2').padEnd(48)}║
║    Per-cycle: ${(cycleSequestration.toFixed(2) + ' tonnes CO2').padEnd(46)}║
║                                                               ║
║  This capacity generates sequestration credits that can       ║
║  offset impact tokens from economic activity.                 ║
╠═══════════════════════════════════════════════════════════════╣
║  HEALTH BASELINE:                                             ║
║    Overall: 75/100  Soil: 70/100  Water: 80/100               ║
║    Carbon Stock: ${(landRecord.health.carbon_stock.toFixed(0) + ' tonnes').padEnd(42)}║
╚═══════════════════════════════════════════════════════════════╝

As steward, you are now responsible for:
  - Maintaining or improving land health
  - Recording impacts from any activities
  - Generating sequestration credits (if carbon-positive)
  - Sharing revenue with bioregion treasury (20%)

Next steps:
  - Post work contracts: npm run work:post -- --land ${landId} --type forestry
  - Transfer rights: npm run land:transfer -- --land ${landId} --right carbon --to Alice
  - Record impact: npm run land:impact -- --land ${landId}
`);
}

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
