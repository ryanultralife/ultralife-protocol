#!/usr/bin/env node
/**
 * UltraLife Protocol — Land Rights CLI
 *
 * Land is not owned. Land is stewarded.
 * Manages land registration, rights separation, and stewardship operations.
 *
 * Usage:
 *   node land-rights.mjs --register --name "Forest Parcel" --area 40000 --type forest
 *   node land-rights.mjs --list
 *   node land-rights.mjs --show --land <id>
 *   node land-rights.mjs --transfer-right --land <id> --right surface --to <pnft>
 *   node land-rights.mjs --lease-right --land <id> --right carbon --to <pnft> --cycles 4
 *   node land-rights.mjs --record-impact --land <id> --right surface --impact <net>
 *   node land-rights.mjs --transfer-stewardship --land <id> --to <pnft>
 *   node land-rights.mjs --update-access --land <id> --public true
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const deploymentPath = path.join(__dirname, 'deployment.json');

// =============================================================================
// CONSTANTS
// =============================================================================

const RIGHT_TYPES = {
  surface: {
    name: 'Surface',
    description: 'What happens on top (farming, buildings, movement)',
    minLevel: 'Standard',
  },
  subsurface: {
    name: 'Subsurface',
    description: 'What is below (minerals, aquifers, geology)',
    minLevel: 'Verified',
  },
  water: {
    name: 'Water',
    description: 'What flows through (streams, rain, irrigation)',
    minLevel: 'Verified',
  },
  air: {
    name: 'Air',
    description: 'What circulates above (emissions, capture, quality)',
    minLevel: 'Standard',
  },
  cellulose: {
    name: 'Cellulose',
    description: 'Living biomass (trees, crops, organisms)',
    minLevel: 'Standard',
  },
  development: {
    name: 'Development',
    description: 'Who can build structures',
    minLevel: 'Verified',
  },
  carbon: {
    name: 'Carbon',
    description: 'Who gets credit for sequestration',
    minLevel: 'Standard',
  },
  access: {
    name: 'Access',
    description: 'Who can traverse the land',
    minLevel: 'Basic',
  },
};

const LAND_CLASSIFICATIONS = {
  forest: {
    name: 'Forest',
    terrain: 'Mountainous',
    ecosystem: 'Forest',
    sequestrationRate: 5, // tCO2 per hectare per year
  },
  grassland: {
    name: 'Grassland',
    terrain: 'Rolling',
    ecosystem: 'Grassland',
    sequestrationRate: 2,
  },
  wetland: {
    name: 'Wetland',
    terrain: 'Lowland',
    ecosystem: 'Wetland',
    sequestrationRate: 8,
  },
  agricultural: {
    name: 'Agricultural',
    terrain: 'Flat',
    ecosystem: 'Managed',
    sequestrationRate: 1,
  },
  regenerative: {
    name: 'Regenerative',
    terrain: 'Mixed',
    ecosystem: 'Regenerating',
    sequestrationRate: 4,
  },
  coastal: {
    name: 'Coastal',
    terrain: 'Coastal',
    ecosystem: 'Marine',
    sequestrationRate: 6,
  },
  urban: {
    name: 'Urban',
    terrain: 'Urban',
    ecosystem: 'Built',
    sequestrationRate: 0,
  },
  desert: {
    name: 'Desert',
    terrain: 'Arid',
    ecosystem: 'Desert',
    sequestrationRate: 0.5,
  },
};

const ACQUISITION_TYPES = ['Original', 'Transfer', 'Lease', 'Inheritance', 'Traditional', 'Grant'];

const DEFAULT_STEWARD_SHARE = 7000;  // 70% in basis points
const DEFAULT_BIOREGION_SHARE = 2000;  // 20% in basis points
const MIN_AREA = 100;  // m2

const PNFT_LEVELS = ['Basic', 'Ward', 'Standard', 'Verified', 'Steward'];

// =============================================================================
// HELPERS
// =============================================================================

function loadDeployment() {
  if (!fs.existsSync(deploymentPath)) {
    return {
      lands: [],
      pnfts: [],
      testUsers: [],
      bioregionStats: {},
    };
  }
  const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  if (!data.lands) data.lands = [];
  if (!data.bioregionStats) data.bioregionStats = {};
  return data;
}

function saveDeployment(data) {
  fs.writeFileSync(deploymentPath, JSON.stringify(data, null, 2));
}

function generateLandId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return `land_${timestamp}_${random}`;
}

function getCurrentSlot() {
  // Estimate slot from system time (preview testnet approximation)
  const genesisTime = 1666656000;
  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime - genesisTime;
}

function formatDate(timestamp) {
  return new Date(timestamp).toISOString().replace('T', ' ').substr(0, 19);
}

function formatArea(m2) {
  if (m2 >= 10000) {
    return `${(m2 / 10000).toFixed(2)} ha`;
  }
  return `${m2} m2`;
}

function getUserPnft(deployment, userName) {
  if (userName) {
    const user = deployment.testUsers?.find(u =>
      u.name?.toLowerCase() === userName.toLowerCase()
    );
    if (user && user.pnftId) {
      const pnft = deployment.pnfts?.find(p => p.id === user.pnftId);
      return pnft ? { ...pnft, owner: user.name, address: user.address } : null;
    }
  }
  // Default to first verified+ pNFT
  if (deployment.pnfts && deployment.pnfts.length > 0) {
    const verifiedPnft = deployment.pnfts.find(p =>
      p.level === 'Verified' || p.level === 'Steward'
    ) || deployment.pnfts[0];
    return { ...verifiedPnft, owner: verifiedPnft.id };
  }
  return null;
}

function canStewardLand(level) {
  return level === 'Verified' || level === 'Steward';
}

function canHoldRight(level, rightType) {
  const right = RIGHT_TYPES[rightType];
  if (!right) return false;
  const levelIdx = PNFT_LEVELS.indexOf(level);
  const minIdx = PNFT_LEVELS.indexOf(right.minLevel);
  return levelIdx >= minIdx;
}

function createDefaultRights(stewardPnft, slot) {
  const rights = {};
  for (const [key, _] of Object.entries(RIGHT_TYPES)) {
    rights[key] = {
      holder: stewardPnft,
      acquisition: 'Original',
      acquired_at: slot,
      transferable: true,
      steward_share: DEFAULT_STEWARD_SHARE,
      bioregion_share: DEFAULT_BIOREGION_SHARE,
      expires: null,
      conditions: null,
    };
  }
  // Add access-specific fields
  rights.access.public_access = false;
  rights.access.min_level_required = 'Basic';
  rights.access.access_fee = null;
  rights.access.allowed_pnfts = [];
  return rights;
}

// =============================================================================
// COMMANDS
// =============================================================================

function showHelp() {
  console.log(`
========================================================================
                  UltraLife Protocol - Land Rights

       Land is not owned. Land is stewarded.
       Every action on land creates impact. Impact flows to right holders.
========================================================================

Usage: node land-rights.mjs [command] [options]

COMMANDS:

  --register                    Register a new land parcel
    --name <name>               Name for the parcel
    --area <m2>                 Area in square meters (min: 100)
    --type <type>               Land type (see --list-types)
    --bioregion <name>          Bioregion (default: sierra_nevada)
    --bounds <hash>             Optional bounds hash for geospatial data
    --traditional <territory>   Optional traditional territory claim

  --list                        List all registered lands
    --bioregion <name>          Filter by bioregion
    --steward <pnft>            Filter by steward

  --show --land <id>            Show detailed land information

  --transfer-right              Transfer a specific right
    --land <id>                 Land ID
    --right <type>              Right type (surface, carbon, water, etc.)
    --to <pnft>                 Recipient pNFT ID
    --acquisition <type>        How acquired (Transfer, Grant, Traditional)

  --lease-right                 Lease a right temporarily
    --land <id>                 Land ID
    --right <type>              Right type
    --to <pnft>                 Lessee pNFT ID
    --cycles <n>                Duration in 37-day cycles
    --payment <amount>          Payment in ULTRA

  --return-right                Return a leased right
    --land <id>                 Land ID
    --right <type>              Right type to return

  --record-impact               Record impact from land activity
    --land <id>                 Land ID
    --right <type>              Which right is responsible
    --impact <net>              Net impact value (positive = good)
    --activity <desc>           Activity description
    --evidence <hash>           Evidence hash (IPFS)

  --transfer-stewardship        Transfer primary stewardship
    --land <id>                 Land ID
    --to <pnft>                 New steward pNFT ID

  --update-access               Update access rights
    --land <id>                 Land ID
    --public <true|false>       Allow public access
    --min-level <level>         Minimum verification level
    --fee <amount>              Access fee in ULTRA (optional)

  --grant-access                Grant access to specific pNFT
    --land <id>                 Land ID
    --to <pnft>                 Grantee pNFT ID

  --revoke-access               Revoke access from specific pNFT
    --land <id>                 Land ID
    --from <pnft>               Revokee pNFT ID

  --update-health               Update land health metrics
    --land <id>                 Land ID
    --soil <0-100>              Soil health index
    --water <0-100>             Water health index
    --biodiversity <0-100>      Biodiversity index

  --list-types                  List land classification types
  --list-rights                 List right types and requirements
  --help                        Show this help

OPTIONS:
  --user <name>                 Act as test user (Alice, Bob, etc.)

RIGHTS (separated ownership):
  surface      What happens on top (farming, buildings)
  subsurface   What is below (minerals, aquifers)
  water        What flows through (streams, irrigation)
  air          What circulates above (emissions, capture)
  cellulose    Living biomass (trees, crops)
  development  Who can build structures
  carbon       Who gets sequestration credits
  access       Who can traverse the land

REVENUE SHARING (basis points):
  - Steward:   70% (default)
  - Bioregion: 20% (default)
  - Remaining: 10% to specific right holder
`);
}

function listTypes() {
  console.log('\n=== Land Classification Types ===\n');
  console.log('TYPE            TERRAIN       ECOSYSTEM     SEQUESTRATION');
  console.log('-'.repeat(60));

  for (const [key, type] of Object.entries(LAND_CLASSIFICATIONS)) {
    console.log(
      `${key.padEnd(15)} ${type.terrain.padEnd(13)} ${type.ecosystem.padEnd(13)} ${type.sequestrationRate} tCO2/ha/yr`
    );
  }
}

function listRights() {
  console.log('\n=== Land Right Types ===\n');
  console.log('RIGHT           MIN LEVEL     DESCRIPTION');
  console.log('-'.repeat(70));

  for (const [key, right] of Object.entries(RIGHT_TYPES)) {
    console.log(
      `${key.padEnd(15)} ${right.minLevel.padEnd(13)} ${right.description}`
    );
  }
}

function registerLand(args, deployment) {
  const name = args.name;
  const area = parseInt(args.area) || 0;
  const type = args.type?.toLowerCase() || 'forest';
  const bioregion = args.bioregion || 'sierra_nevada';
  const bounds = args.bounds || crypto.createHash('sha256').update(name + Date.now()).digest('hex');
  const traditional = args.traditional || null;
  const userName = args.user;

  if (!name) {
    console.error('Error: --name is required');
    return;
  }

  if (area < MIN_AREA) {
    console.error(`Error: Minimum area is ${MIN_AREA} m2`);
    return;
  }

  if (!LAND_CLASSIFICATIONS[type]) {
    console.error(`Error: Invalid land type. Use --list-types to see options.`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found. Mint a Verified+ pNFT first.');
    return;
  }

  if (!canStewardLand(pnft.level)) {
    console.error(`Error: ${pnft.level} level cannot steward land. Need Verified or Steward.`);
    return;
  }

  const classification = LAND_CLASSIFICATIONS[type];
  const slot = getCurrentSlot();
  const landId = generateLandId();

  // Calculate sequestration capacity (area in hectares * rate)
  const hectares = area / 10000;
  const sequestrationCapacity = Math.round(hectares * classification.sequestrationRate);

  const land = {
    landId: landId,
    name: name,
    boundsHash: bounds,
    area_m2: area,
    bioregion: bioregion,
    classification: {
      name: classification.name,
      terrain: classification.terrain,
      ecosystem: classification.ecosystem,
      sequestrationRate: classification.sequestrationRate,
    },
    health: {
      overall_index: 75,
      soil_health: 70,
      water_health: 80,
      biodiversity_index: 70,
      carbon_stock: Math.round(area / 100),
      last_survey: null,
    },
    primarySteward: pnft.id,
    stewardAddress: pnft.owner,
    rights: createDefaultRights(pnft.id, slot),
    traditional_territory: traditional,
    cultural_protocols: null,
    registered_at: slot,
    registeredAt: new Date().toISOString(),
    impactHistory: [],
    testnetSimulated: true,
  };

  // Add carbon-specific sequestration info
  land.rights.carbon.sequestrationCapacity = sequestrationCapacity;

  deployment.lands.push(land);

  // Update bioregion stats
  if (!deployment.bioregionStats[bioregion]) {
    deployment.bioregionStats[bioregion] = {
      totalLandArea: 0,
      landsRegistered: 0,
      totalSequestrationCapacity: 0,
    };
  }
  deployment.bioregionStats[bioregion].totalLandArea += area;
  deployment.bioregionStats[bioregion].landsRegistered += 1;
  deployment.bioregionStats[bioregion].totalSequestrationCapacity += sequestrationCapacity;

  // Update pNFT with land
  const pnftRecord = deployment.pnfts?.find(p => p.id === pnft.id);
  if (pnftRecord) {
    if (!pnftRecord.lands_stewarded) pnftRecord.lands_stewarded = [];
    pnftRecord.lands_stewarded.push(landId);
  }

  saveDeployment(deployment);

  console.log('\n========================================================================');
  console.log('                       LAND REGISTERED                                  ');
  console.log('========================================================================\n');

  console.log(`  Land ID:        ${landId}`);
  console.log(`  Name:           ${name}`);
  console.log(`  Area:           ${formatArea(area)}`);
  console.log(`  Type:           ${classification.name}`);
  console.log(`  Bioregion:      ${bioregion}`);
  console.log(`  Steward:        ${pnft.id}`);
  console.log(`  Sequestration:  ${sequestrationCapacity} tCO2/year capacity`);
  if (traditional) {
    console.log(`  Traditional:    ${traditional}`);
  }
  console.log(`\n  All rights assigned to primary steward.`);
  console.log(`  Use --show --land ${landId} to view details.`);
}

function listLands(args, deployment) {
  let lands = deployment.lands || [];
  const bioregionFilter = args.bioregion;
  const stewardFilter = args.steward;

  if (bioregionFilter) {
    lands = lands.filter(l => l.bioregion === bioregionFilter);
  }
  if (stewardFilter) {
    lands = lands.filter(l => l.primarySteward === stewardFilter);
  }

  console.log('\n=== Registered Lands ===\n');

  if (lands.length === 0) {
    console.log('  No lands registered.');
    return;
  }

  console.log('ID                              NAME                    AREA         BIOREGION        TYPE');
  console.log('-'.repeat(100));

  for (const land of lands) {
    console.log(
      `${land.landId.padEnd(31)} ${land.name.substring(0, 22).padEnd(23)} ${formatArea(land.area_m2).padEnd(12)} ${land.bioregion.padEnd(16)} ${land.classification.name}`
    );
  }

  console.log(`\nTotal: ${lands.length} parcel(s)`);

  // Bioregion summary
  if (!bioregionFilter && Object.keys(deployment.bioregionStats).length > 0) {
    console.log('\n=== Bioregion Summary ===\n');
    for (const [bio, stats] of Object.entries(deployment.bioregionStats)) {
      console.log(`  ${bio}: ${stats.landsRegistered} parcels, ${formatArea(stats.totalLandArea)}, ${stats.totalSequestrationCapacity} tCO2/yr capacity`);
    }
  }
}

function showLand(args, deployment) {
  const landId = args.land;

  if (!landId) {
    console.error('Error: --land <id> required');
    return;
  }

  const land = deployment.lands?.find(l => l.landId === landId);

  if (!land) {
    console.error(`Error: Land ${landId} not found`);
    return;
  }

  console.log('\n========================================================================');
  console.log(`  LAND: ${land.name}`);
  console.log('========================================================================\n');

  console.log('  BASIC INFO');
  console.log('  ----------');
  console.log(`  ID:             ${land.landId}`);
  console.log(`  Area:           ${formatArea(land.area_m2)}`);
  console.log(`  Bioregion:      ${land.bioregion}`);
  console.log(`  Registered:     ${formatDate(land.registeredAt)}`);

  console.log('\n  CLASSIFICATION');
  console.log('  --------------');
  console.log(`  Type:           ${land.classification.name}`);
  console.log(`  Terrain:        ${land.classification.terrain}`);
  console.log(`  Ecosystem:      ${land.classification.ecosystem}`);
  console.log(`  Sequestration:  ${land.classification.sequestrationRate} tCO2/ha/yr`);

  console.log('\n  STEWARDSHIP');
  console.log('  -----------');
  console.log(`  Primary:        ${land.primarySteward}`);
  if (land.traditional_territory) {
    console.log(`  Traditional:    ${land.traditional_territory}`);
  }
  if (land.cultural_protocols) {
    console.log(`  Protocols:      ${land.cultural_protocols}`);
  }

  console.log('\n  HEALTH INDICES');
  console.log('  ---------------');
  console.log(`  Overall:        ${land.health.overall_index}/100`);
  console.log(`  Soil:           ${land.health.soil_health}/100`);
  console.log(`  Water:          ${land.health.water_health}/100`);
  console.log(`  Biodiversity:   ${land.health.biodiversity_index}/100`);
  console.log(`  Carbon Stock:   ${land.health.carbon_stock} tonnes`);
  if (land.health.last_survey) {
    console.log(`  Last Survey:    ${formatDate(land.health.last_survey)}`);
  }

  console.log('\n  RIGHTS ALLOCATION');
  console.log('  ------------------');
  console.log('  RIGHT           HOLDER                          SHARES       EXPIRES');
  console.log('  ' + '-'.repeat(76));

  for (const [rightType, right] of Object.entries(land.rights)) {
    const shares = `${right.steward_share/100}%/${right.bioregion_share/100}%`;
    const expires = right.expires ? formatDate(right.expires * 1000) : 'permanent';
    const holderShort = right.holder.substring(0, 28);
    console.log(
      `  ${rightType.padEnd(15)} ${holderShort.padEnd(31)} ${shares.padEnd(12)} ${expires}`
    );
  }

  if (land.impactHistory && land.impactHistory.length > 0) {
    console.log('\n  RECENT IMPACTS');
    console.log('  --------------');
    for (const impact of land.impactHistory.slice(-5)) {
      const sign = impact.net >= 0 ? '+' : '';
      console.log(`  ${formatDate(impact.timestamp)}  ${sign}${impact.net}  ${impact.activity.substring(0, 30)}`);
    }
  }
}

function transferRight(args, deployment) {
  const landId = args.land;
  const rightType = args.right?.toLowerCase();
  const toPnft = args.to;
  const acquisition = args.acquisition || 'Transfer';
  const userName = args.user;

  if (!landId || !rightType || !toPnft) {
    console.error('Error: --land, --right, and --to are required');
    return;
  }

  if (!RIGHT_TYPES[rightType]) {
    console.error(`Error: Invalid right type. Use --list-rights to see options.`);
    return;
  }

  const land = deployment.lands?.find(l => l.landId === landId);
  if (!land) {
    console.error(`Error: Land ${landId} not found`);
    return;
  }

  const right = land.rights[rightType];
  if (!right.transferable) {
    console.error(`Error: This ${rightType} right is not transferable`);
    return;
  }

  // Check current holder is acting
  const actorPnft = getUserPnft(deployment, userName);
  if (!actorPnft || actorPnft.id !== right.holder) {
    console.error(`Error: Only the current holder (${right.holder}) can transfer this right`);
    return;
  }

  // Check recipient exists and is qualified
  const recipientPnft = deployment.pnfts?.find(p => p.id === toPnft);
  if (!recipientPnft) {
    console.error(`Error: Recipient pNFT ${toPnft} not found`);
    return;
  }

  if (!canHoldRight(recipientPnft.level, rightType)) {
    console.error(`Error: ${recipientPnft.level} level cannot hold ${rightType} rights. Need ${RIGHT_TYPES[rightType].minLevel}.`);
    return;
  }

  const slot = getCurrentSlot();
  const previousHolder = right.holder;

  right.holder = toPnft;
  right.acquisition = acquisition;
  right.acquired_at = slot;
  right.expires = null;
  right.conditions = null;

  saveDeployment(deployment);

  console.log('\n========================================================================');
  console.log('                       RIGHT TRANSFERRED                                ');
  console.log('========================================================================\n');

  console.log(`  Land:           ${land.name}`);
  console.log(`  Right:          ${RIGHT_TYPES[rightType].name}`);
  console.log(`  From:           ${previousHolder}`);
  console.log(`  To:             ${toPnft}`);
  console.log(`  Acquisition:    ${acquisition}`);
}

function leaseRight(args, deployment) {
  const landId = args.land;
  const rightType = args.right?.toLowerCase();
  const toPnft = args.to;
  const cycles = parseInt(args.cycles) || 1;
  const payment = parseFloat(args.payment) || 0;
  const userName = args.user;

  if (!landId || !rightType || !toPnft) {
    console.error('Error: --land, --right, and --to are required');
    return;
  }

  if (!RIGHT_TYPES[rightType]) {
    console.error(`Error: Invalid right type.`);
    return;
  }

  const land = deployment.lands?.find(l => l.landId === landId);
  if (!land) {
    console.error(`Error: Land ${landId} not found`);
    return;
  }

  const right = land.rights[rightType];

  // Check actor is current holder
  const actorPnft = getUserPnft(deployment, userName);
  if (!actorPnft || actorPnft.id !== right.holder) {
    console.error(`Error: Only the current holder can lease this right`);
    return;
  }

  // Check lessee exists and is qualified
  const lesseePnft = deployment.pnfts?.find(p => p.id === toPnft);
  if (!lesseePnft) {
    console.error(`Error: Lessee pNFT ${toPnft} not found`);
    return;
  }

  if (!canHoldRight(lesseePnft.level, rightType)) {
    console.error(`Error: Lessee ${lesseePnft.level} level cannot hold ${rightType} rights.`);
    return;
  }

  const slot = getCurrentSlot();
  const SLOTS_PER_CYCLE = 37 * 86400;  // 37 days in seconds/slots
  const expirySlot = slot + (cycles * SLOTS_PER_CYCLE);

  const originalHolder = right.holder;

  // Store original holder for return
  right.originalHolder = originalHolder;
  right.holder = toPnft;
  right.acquisition = 'Lease';
  right.acquired_at = slot;
  right.expires = expirySlot;
  right.conditions = `Lease for ${cycles} cycles, payment: ${payment} ULTRA`;

  // Handle payment
  if (payment > 0) {
    const stewardPayment = payment * right.steward_share / 10000;
    const bioregionPayment = payment * right.bioregion_share / 10000;
    console.log(`  Payment distribution: Steward ${stewardPayment.toFixed(2)}, Bioregion ${bioregionPayment.toFixed(2)} ULTRA`);
  }

  saveDeployment(deployment);

  console.log('\n========================================================================');
  console.log('                        RIGHT LEASED                                    ');
  console.log('========================================================================\n');

  console.log(`  Land:           ${land.name}`);
  console.log(`  Right:          ${RIGHT_TYPES[rightType].name}`);
  console.log(`  Lessee:         ${toPnft}`);
  console.log(`  Duration:       ${cycles} cycle(s) (${cycles * 37} days)`);
  console.log(`  Expires:        Slot ${expirySlot}`);
  console.log(`  Payment:        ${payment} ULTRA`);
}

function returnRight(args, deployment) {
  const landId = args.land;
  const rightType = args.right?.toLowerCase();

  if (!landId || !rightType) {
    console.error('Error: --land and --right are required');
    return;
  }

  const land = deployment.lands?.find(l => l.landId === landId);
  if (!land) {
    console.error(`Error: Land ${landId} not found`);
    return;
  }

  const right = land.rights[rightType];
  if (!right.expires) {
    console.error(`Error: This right is not leased`);
    return;
  }

  const originalHolder = right.originalHolder || land.primarySteward;
  const slot = getCurrentSlot();

  right.holder = originalHolder;
  right.acquisition = 'Original';
  right.acquired_at = slot;
  right.expires = null;
  right.conditions = null;
  delete right.originalHolder;

  saveDeployment(deployment);

  console.log('\n========================================================================');
  console.log('                       RIGHT RETURNED                                   ');
  console.log('========================================================================\n');

  console.log(`  Land:           ${land.name}`);
  console.log(`  Right:          ${RIGHT_TYPES[rightType].name}`);
  console.log(`  Returned to:    ${originalHolder}`);
}

function recordImpact(args, deployment) {
  const landId = args.land;
  const rightType = args.right?.toLowerCase() || 'surface';
  const impact = parseFloat(args.impact) || 0;
  const activity = args.activity || 'Unspecified activity';
  const evidence = args.evidence || crypto.randomBytes(16).toString('hex');
  const userName = args.user;

  if (!landId) {
    console.error('Error: --land is required');
    return;
  }

  const land = deployment.lands?.find(l => l.landId === landId);
  if (!land) {
    console.error(`Error: Land ${landId} not found`);
    return;
  }

  const right = land.rights[rightType];
  const actorPnft = getUserPnft(deployment, userName);

  if (!actorPnft || actorPnft.id !== right.holder) {
    console.error(`Error: Only the right holder (${right.holder}) can record impacts`);
    return;
  }

  if (!land.impactHistory) land.impactHistory = [];

  const impactRecord = {
    timestamp: new Date().toISOString(),
    slot: getCurrentSlot(),
    rightType: rightType,
    activity: activity,
    net: impact,
    evidenceHash: evidence,
    recordedBy: actorPnft.id,
  };

  land.impactHistory.push(impactRecord);

  // Update health indices based on impact
  const healthDelta = Math.round(impact / 10);
  land.health.overall_index = Math.max(0, Math.min(100, land.health.overall_index + healthDelta));

  saveDeployment(deployment);

  console.log('\n========================================================================');
  console.log('                      IMPACT RECORDED                                   ');
  console.log('========================================================================\n');

  console.log(`  Land:           ${land.name}`);
  console.log(`  Right:          ${RIGHT_TYPES[rightType].name}`);
  console.log(`  Activity:       ${activity}`);
  console.log(`  Net Impact:     ${impact >= 0 ? '+' : ''}${impact}`);
  console.log(`  Evidence:       ${evidence.substring(0, 32)}...`);
  console.log(`  Health Change:  ${healthDelta >= 0 ? '+' : ''}${healthDelta} (now ${land.health.overall_index}/100)`);

  if (impact < 0) {
    console.log(`\n  NOTE: Negative impact recorded. Remediation may be required.`);
  } else if (impact > 0) {
    console.log(`\n  Positive impact! Impact tokens may be minted for this activity.`);
  }
}

function transferStewardship(args, deployment) {
  const landId = args.land;
  const toPnft = args.to;
  const userName = args.user;

  if (!landId || !toPnft) {
    console.error('Error: --land and --to are required');
    return;
  }

  const land = deployment.lands?.find(l => l.landId === landId);
  if (!land) {
    console.error(`Error: Land ${landId} not found`);
    return;
  }

  const actorPnft = getUserPnft(deployment, userName);
  if (!actorPnft || actorPnft.id !== land.primarySteward) {
    console.error(`Error: Only the current steward can transfer stewardship`);
    return;
  }

  const newStewardPnft = deployment.pnfts?.find(p => p.id === toPnft);
  if (!newStewardPnft) {
    console.error(`Error: pNFT ${toPnft} not found`);
    return;
  }

  if (!canStewardLand(newStewardPnft.level)) {
    console.error(`Error: ${newStewardPnft.level} level cannot steward land. Need Verified or Steward.`);
    return;
  }

  const previousSteward = land.primarySteward;
  land.primarySteward = toPnft;
  land.stewardAddress = newStewardPnft.owner;

  // Update all rights to new steward (unless separately held)
  const slot = getCurrentSlot();
  for (const [rightType, right] of Object.entries(land.rights)) {
    if (right.holder === previousSteward) {
      right.holder = toPnft;
      right.acquired_at = slot;
    }
  }

  // Update pNFT records
  const oldStewardRecord = deployment.pnfts?.find(p => p.id === previousSteward);
  if (oldStewardRecord && oldStewardRecord.lands_stewarded) {
    oldStewardRecord.lands_stewarded = oldStewardRecord.lands_stewarded.filter(id => id !== landId);
  }
  if (!newStewardPnft.lands_stewarded) newStewardPnft.lands_stewarded = [];
  newStewardPnft.lands_stewarded.push(landId);

  saveDeployment(deployment);

  console.log('\n========================================================================');
  console.log('                  STEWARDSHIP TRANSFERRED                               ');
  console.log('========================================================================\n');

  console.log(`  Land:           ${land.name}`);
  console.log(`  From:           ${previousSteward}`);
  console.log(`  To:             ${toPnft}`);
  console.log(`  All rights held by previous steward transferred.`);
}

function updateAccess(args, deployment) {
  const landId = args.land;
  const publicAccess = args.public === 'true' || args.public === true;
  const minLevel = args['min-level'] || 'Basic';
  const fee = args.fee ? parseFloat(args.fee) : null;
  const userName = args.user;

  if (!landId) {
    console.error('Error: --land is required');
    return;
  }

  const land = deployment.lands?.find(l => l.landId === landId);
  if (!land) {
    console.error(`Error: Land ${landId} not found`);
    return;
  }

  const actorPnft = getUserPnft(deployment, userName);
  if (!actorPnft || actorPnft.id !== land.primarySteward) {
    console.error(`Error: Only the steward can update access rights`);
    return;
  }

  if (!PNFT_LEVELS.includes(minLevel)) {
    console.error(`Error: Invalid level. Options: ${PNFT_LEVELS.join(', ')}`);
    return;
  }

  land.rights.access.public_access = publicAccess;
  land.rights.access.min_level_required = minLevel;
  land.rights.access.access_fee = fee;

  saveDeployment(deployment);

  console.log('\n========================================================================');
  console.log('                     ACCESS UPDATED                                     ');
  console.log('========================================================================\n');

  console.log(`  Land:           ${land.name}`);
  console.log(`  Public Access:  ${publicAccess ? 'Yes' : 'No'}`);
  console.log(`  Min Level:      ${minLevel}`);
  console.log(`  Access Fee:     ${fee !== null ? fee + ' ULTRA' : 'None'}`);
}

function grantAccess(args, deployment) {
  const landId = args.land;
  const toPnft = args.to;
  const userName = args.user;

  if (!landId || !toPnft) {
    console.error('Error: --land and --to are required');
    return;
  }

  const land = deployment.lands?.find(l => l.landId === landId);
  if (!land) {
    console.error(`Error: Land ${landId} not found`);
    return;
  }

  const actorPnft = getUserPnft(deployment, userName);
  if (!actorPnft || actorPnft.id !== land.primarySteward) {
    console.error(`Error: Only the steward can grant access`);
    return;
  }

  if (!land.rights.access.allowed_pnfts) {
    land.rights.access.allowed_pnfts = [];
  }

  if (!land.rights.access.allowed_pnfts.includes(toPnft)) {
    land.rights.access.allowed_pnfts.push(toPnft);
  }

  saveDeployment(deployment);

  console.log(`\nAccess granted to ${toPnft} for land ${land.name}`);
}

function revokeAccess(args, deployment) {
  const landId = args.land;
  const fromPnft = args.from;
  const userName = args.user;

  if (!landId || !fromPnft) {
    console.error('Error: --land and --from are required');
    return;
  }

  const land = deployment.lands?.find(l => l.landId === landId);
  if (!land) {
    console.error(`Error: Land ${landId} not found`);
    return;
  }

  const actorPnft = getUserPnft(deployment, userName);
  if (!actorPnft || actorPnft.id !== land.primarySteward) {
    console.error(`Error: Only the steward can revoke access`);
    return;
  }

  if (land.rights.access.allowed_pnfts) {
    land.rights.access.allowed_pnfts = land.rights.access.allowed_pnfts.filter(id => id !== fromPnft);
  }

  saveDeployment(deployment);

  console.log(`\nAccess revoked from ${fromPnft} for land ${land.name}`);
}

function updateHealth(args, deployment) {
  const landId = args.land;
  const soil = args.soil !== undefined ? parseInt(args.soil) : null;
  const water = args.water !== undefined ? parseInt(args.water) : null;
  const biodiversity = args.biodiversity !== undefined ? parseInt(args.biodiversity) : null;
  const userName = args.user;

  if (!landId) {
    console.error('Error: --land is required');
    return;
  }

  const land = deployment.lands?.find(l => l.landId === landId);
  if (!land) {
    console.error(`Error: Land ${landId} not found`);
    return;
  }

  const actorPnft = getUserPnft(deployment, userName);
  if (!actorPnft || actorPnft.id !== land.primarySteward) {
    console.error(`Error: Only the steward can update health metrics`);
    return;
  }

  if (soil !== null) land.health.soil_health = Math.max(0, Math.min(100, soil));
  if (water !== null) land.health.water_health = Math.max(0, Math.min(100, water));
  if (biodiversity !== null) land.health.biodiversity_index = Math.max(0, Math.min(100, biodiversity));

  // Recalculate overall
  land.health.overall_index = Math.round(
    (land.health.soil_health + land.health.water_health + land.health.biodiversity_index) / 3
  );
  land.health.last_survey = new Date().toISOString();

  saveDeployment(deployment);

  console.log('\n========================================================================');
  console.log('                      HEALTH UPDATED                                    ');
  console.log('========================================================================\n');

  console.log(`  Land:           ${land.name}`);
  console.log(`  Soil:           ${land.health.soil_health}/100`);
  console.log(`  Water:          ${land.health.water_health}/100`);
  console.log(`  Biodiversity:   ${land.health.biodiversity_index}/100`);
  console.log(`  Overall:        ${land.health.overall_index}/100`);
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const args = parseArgs(process.argv.slice(2));
  const deployment = loadDeployment();

  if (args.help || Object.keys(args).length === 0) {
    showHelp();
    return;
  }

  if (args['list-types']) {
    listTypes();
    return;
  }

  if (args['list-rights']) {
    listRights();
    return;
  }

  if (args.register) {
    registerLand(args, deployment);
    return;
  }

  if (args.list) {
    listLands(args, deployment);
    return;
  }

  if (args.show && args.land) {
    showLand(args, deployment);
    return;
  }

  if (args['transfer-right']) {
    transferRight(args, deployment);
    return;
  }

  if (args['lease-right']) {
    leaseRight(args, deployment);
    return;
  }

  if (args['return-right']) {
    returnRight(args, deployment);
    return;
  }

  if (args['record-impact']) {
    recordImpact(args, deployment);
    return;
  }

  if (args['transfer-stewardship']) {
    transferStewardship(args, deployment);
    return;
  }

  if (args['update-access']) {
    updateAccess(args, deployment);
    return;
  }

  if (args['grant-access']) {
    grantAccess(args, deployment);
    return;
  }

  if (args['revoke-access']) {
    revokeAccess(args, deployment);
    return;
  }

  if (args['update-health']) {
    updateHealth(args, deployment);
    return;
  }

  showHelp();
}

function parseArgs(argv) {
  const args = {};
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];

      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 2;
      } else {
        args[key] = true;
        i += 1;
      }
    } else {
      i += 1;
    }
  }

  return args;
}

main();
