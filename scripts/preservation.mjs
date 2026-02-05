#!/usr/bin/env node
/**
 * UltraLife Protocol — Land Preservation CLI
 *
 * Manage land preservation pledges, conservation easements,
 * and preservation credit generation.
 *
 * Usage:
 *   node preservation.mjs --pledge --land land_123 --years 25
 *   node preservation.mjs --list-pledges
 *   node preservation.mjs --generate-credits --pledge pledge_123
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONSTANTS
// =============================================================================

const PRESERVATION_TYPES = {
  conservation_easement: {
    name: 'Conservation Easement',
    minYears: 20,
    creditMultiplier: 1.5,
    restrictions: ['no_development', 'maintain_habitat'],
  },
  wilderness_covenant: {
    name: 'Wilderness Covenant',
    minYears: 50,
    creditMultiplier: 2.0,
    restrictions: ['no_development', 'no_extraction', 'minimal_access'],
  },
  agricultural_preserve: {
    name: 'Agricultural Preserve',
    minYears: 10,
    creditMultiplier: 1.0,
    restrictions: ['agricultural_use_only', 'no_subdivision'],
  },
  riparian_buffer: {
    name: 'Riparian Buffer Zone',
    minYears: 15,
    creditMultiplier: 1.3,
    restrictions: ['no_development', 'maintain_vegetation', 'water_quality'],
  },
  wildlife_corridor: {
    name: 'Wildlife Corridor',
    minYears: 25,
    creditMultiplier: 1.8,
    restrictions: ['no_fencing', 'no_development', 'maintain_connectivity'],
  },
};

// Credits per hectare per year by ecosystem type
const BASE_CREDITS_PER_HECTARE = {
  forest: 5.0,
  wetland: 7.0,
  grassland: 2.5,
  agricultural: 1.5,
  riparian: 6.0,
  desert: 1.0,
};

// =============================================================================
// HELPERS
// =============================================================================

function loadDeployment() {
  const deploymentPath = path.join(__dirname, 'deployment.json');
  if (!fs.existsSync(deploymentPath)) {
    return { preservation: { pledges: [], credits: [], verifications: [] } };
  }
  const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  if (!data.preservation) data.preservation = { pledges: [], credits: [], verifications: [] };
  return data;
}

async function saveDeploymentAsync(data) {
  const { atomicWriteSync } = await import('./utils.mjs');
  const deploymentPath = path.join(__dirname, 'deployment.json');
  atomicWriteSync(deploymentPath, data);
}

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
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

function getUserPnft(deployment, userName) {
  if (userName) {
    const user = deployment.testUsers?.find(u =>
      u.name?.toLowerCase() === userName.toLowerCase()
    );
    if (user && user.pnft) {
      return { ...user.pnft, owner: user.name, address: user.address };
    }
  }
  if (deployment.pnfts && deployment.pnfts.length > 0) {
    const mainPnft = deployment.pnfts.find(p => p.isMainWallet) || deployment.pnfts[0];
    return { ...mainPnft, owner: 'Main', address: deployment.walletAddress };
  }
  return null;
}

function getLand(deployment, landId) {
  return deployment.lands?.find(l => l.landId === landId);
}

// =============================================================================
// COMMANDS
// =============================================================================

function showHelp() {
  console.log(`
===============================================================================
                    UltraLife Protocol — Land Preservation
===============================================================================

Usage: node preservation.mjs [command] [options]

COMMANDS:
  --pledge               Create a preservation pledge
    --land <id>          Land parcel ID
    --type <type>        Preservation type (see below)
    --years <n>          Pledge duration in years
    --user <name>        Pledge as test user

  --list-pledges         List all preservation pledges
    --bioregion <id>     Filter by bioregion
    --user <name>        Filter by user

  --show-pledge          Show pledge details
    --pledge <id>        Pledge ID

  --verify               Submit verification for a pledge
    --pledge <id>        Pledge ID
    --evidence <hash>    Evidence hash
    --notes <text>       Verification notes

  --generate-credits     Generate preservation credits
    --pledge <id>        Pledge ID

  --list-credits         List preservation credits
    --user <name>        Filter by user

  --transfer-credits     Transfer preservation credits
    --credit <id>        Credit ID
    --to <address>       Recipient address
    --amount <n>         Amount to transfer

  --retire-credits       Retire credits (permanent offset)
    --credit <id>        Credit ID
    --amount <n>         Amount to retire
    --reason <text>      Reason for retirement

  --stats                Show preservation statistics
    --bioregion <id>     For specific bioregion

  --list-types           Show preservation types

  --help                 Show this help

PRESERVATION TYPES:
${Object.entries(PRESERVATION_TYPES).map(([k, v]) => `  ${k.padEnd(22)} ${v.name} (min ${v.minYears} years, ${v.creditMultiplier}x credits)`).join('\n')}

CREDIT CALCULATION:
  Base credits per hectare/year by ecosystem:
${Object.entries(BASE_CREDITS_PER_HECTARE).map(([k, v]) => `    ${k.padEnd(15)} ${v} credits`).join('\n')}

  Credits = Area (ha) * Years * Base Rate * Type Multiplier
`);
}

async function createPledge(args, deployment) {
  const landId = args.land;
  const type = args.type || 'conservation_easement';
  const years = parseInt(args.years);
  const userName = args.user;

  if (!landId) {
    console.error('Error: --land is required');
    return;
  }

  if (!years || years < 1) {
    console.error('Error: --years is required and must be positive');
    return;
  }

  const preservationType = PRESERVATION_TYPES[type];
  if (!preservationType) {
    console.error(`Error: Unknown type "${type}". Use --list-types to see options.`);
    return;
  }

  if (years < preservationType.minYears) {
    console.error(`Error: ${preservationType.name} requires minimum ${preservationType.minYears} years`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const land = getLand(deployment, landId);
  if (!land) {
    console.error(`Error: Land ${landId} not found`);
    return;
  }

  if (land.primarySteward !== pnft.id) {
    console.error('Error: Only the primary steward can create preservation pledges');
    return;
  }

  // Check for existing pledge
  const existing = deployment.preservation.pledges.find(p =>
    p.landId === landId && p.status === 'active'
  );
  if (existing) {
    console.error(`Error: Land already has active pledge (${existing.pledgeId})`);
    return;
  }

  // Calculate estimated credits
  const areaHectares = (land.area_m2 || 160000) / 10000;
  const ecosystem = land.classification?.ecosystem?.toLowerCase() || 'forest';
  const baseRate = BASE_CREDITS_PER_HECTARE[ecosystem] || 2.0;
  const totalCredits = areaHectares * years * baseRate * preservationType.creditMultiplier;

  const pledge = {
    pledgeId: generateId('pledge'),
    landId,
    landName: land.name,
    steward: pnft.id,
    stewardAddress: pnft.address,
    bioregion: land.bioregion,
    type,
    typeName: preservationType.name,
    years,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + years * 365.25 * 24 * 60 * 60 * 1000).toISOString(),
    restrictions: preservationType.restrictions,
    areaHectares,
    ecosystem,
    estimatedCredits: Math.round(totalCredits),
    creditsGenerated: 0,
    verifications: [],
    status: 'active',
    createdAt: new Date().toISOString(),
    testnetSimulated: true,
  };

  deployment.preservation.pledges.push(pledge);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         PRESERVATION PLEDGE CREATED
===============================================================================
  Pledge ID:       ${pledge.pledgeId}
  Land:            ${land.name} (${landId})
  Steward:         ${pnft.owner}
  Bioregion:       ${land.bioregion}
-------------------------------------------------------------------------------
  TYPE:            ${preservationType.name}
  DURATION:        ${years} years
  START:           ${new Date(pledge.startDate).toLocaleDateString()}
  END:             ${new Date(pledge.endDate).toLocaleDateString()}
-------------------------------------------------------------------------------
  RESTRICTIONS:
${preservationType.restrictions.map(r => `    - ${r.replace(/_/g, ' ')}`).join('\n')}
-------------------------------------------------------------------------------
  CREDITS:
    Area:          ${areaHectares.toFixed(2)} hectares
    Ecosystem:     ${ecosystem}
    Base rate:     ${baseRate} credits/ha/year
    Multiplier:    ${preservationType.creditMultiplier}x
    Estimated:     ${pledge.estimatedCredits.toLocaleString()} total credits
-------------------------------------------------------------------------------

Generate credits with: npm run preservation:credits -- --pledge ${pledge.pledgeId}
`);
}

function listPledges(args, deployment) {
  const bioregion = args.bioregion;
  const userName = args.user;

  let pledges = deployment.preservation.pledges || [];

  if (bioregion) {
    pledges = pledges.filter(p => p.bioregion === bioregion);
  }

  if (userName) {
    const pnft = getUserPnft(deployment, userName);
    if (pnft) {
      pledges = pledges.filter(p => p.steward === pnft.id);
    }
  }

  console.log(`
===============================================================================
                    PRESERVATION PLEDGES
===============================================================================`);

  if (pledges.length === 0) {
    console.log('\n  No preservation pledges found.\n');
    return;
  }

  console.log('\n  ID                    LAND                    TYPE                   YEARS   STATUS');
  console.log('  --------------------  ----------------------  ---------------------  -----   ------');

  for (const p of pledges) {
    console.log(`  ${p.pledgeId.padEnd(20)}  ${(p.landName || p.landId).slice(0, 22).padEnd(22)}  ${p.typeName.slice(0, 21).padEnd(21)}  ${String(p.years).padEnd(5)}   ${p.status}`);
  }

  const totalHa = pledges.reduce((sum, p) => sum + (p.areaHectares || 0), 0);
  const totalCredits = pledges.reduce((sum, p) => sum + (p.estimatedCredits || 0), 0);

  console.log(`
-------------------------------------------------------------------------------
  Total: ${pledges.length} pledges
  Area:  ${totalHa.toFixed(2)} hectares
  Estimated Credits: ${totalCredits.toLocaleString()}
`);
}

function showPledge(args, deployment) {
  const pledgeId = args.pledge;

  if (!pledgeId) {
    console.error('Error: --pledge is required');
    return;
  }

  const pledge = deployment.preservation.pledges.find(p => p.pledgeId === pledgeId);
  if (!pledge) {
    console.error(`Error: Pledge ${pledgeId} not found`);
    return;
  }

  const yearsRemaining = Math.max(0,
    Math.ceil((new Date(pledge.endDate) - Date.now()) / (365.25 * 24 * 60 * 60 * 1000))
  );

  console.log(`
===============================================================================
                    PRESERVATION PLEDGE
===============================================================================
  Pledge ID:       ${pledge.pledgeId}
  Land:            ${pledge.landName} (${pledge.landId})
  Steward:         ${pledge.steward}
  Bioregion:       ${pledge.bioregion}
  Status:          ${pledge.status.toUpperCase()}
-------------------------------------------------------------------------------
  TYPE:            ${pledge.typeName}
  DURATION:        ${pledge.years} years (${yearsRemaining} remaining)
  START:           ${new Date(pledge.startDate).toLocaleDateString()}
  END:             ${new Date(pledge.endDate).toLocaleDateString()}
-------------------------------------------------------------------------------
  RESTRICTIONS:
${pledge.restrictions.map(r => `    - ${r.replace(/_/g, ' ')}`).join('\n')}
-------------------------------------------------------------------------------
  AREA:            ${pledge.areaHectares.toFixed(2)} hectares
  ECOSYSTEM:       ${pledge.ecosystem}
  EST. CREDITS:    ${pledge.estimatedCredits.toLocaleString()}
  GENERATED:       ${pledge.creditsGenerated.toLocaleString()}
-------------------------------------------------------------------------------
  VERIFICATIONS (${pledge.verifications.length}):
`);

  if (pledge.verifications.length === 0) {
    console.log('    (No verifications yet)\n');
  } else {
    for (const v of pledge.verifications.slice(-5)) {
      console.log(`    - ${new Date(v.date).toLocaleDateString()}: ${v.result} (${v.verifier})`);
    }
  }
}

async function verifyPledge(args, deployment) {
  const pledgeId = args.pledge;
  const evidence = args.evidence;
  const notes = args.notes || '';

  if (!pledgeId) {
    console.error('Error: --pledge is required');
    return;
  }

  const pledge = deployment.preservation.pledges.find(p => p.pledgeId === pledgeId);
  if (!pledge) {
    console.error(`Error: Pledge ${pledgeId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const verification = {
    verificationId: generateId('verify'),
    verifier: pnft.id,
    verifierAddress: pnft.address,
    date: new Date().toISOString(),
    evidenceHash: evidence || crypto.randomBytes(16).toString('hex'),
    notes,
    result: 'compliant',
  };

  pledge.verifications.push(verification);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         VERIFICATION RECORDED
===============================================================================
  Pledge:         ${pledgeId}
  Verifier:       ${pnft.owner}
  Date:           ${new Date(verification.date).toLocaleString()}
  Result:         COMPLIANT
  Evidence:       ${verification.evidenceHash.slice(0, 16)}...
`);
}

async function generateCredits(args, deployment) {
  const pledgeId = args.pledge;

  if (!pledgeId) {
    console.error('Error: --pledge is required');
    return;
  }

  const pledge = deployment.preservation.pledges.find(p => p.pledgeId === pledgeId);
  if (!pledge) {
    console.error(`Error: Pledge ${pledgeId} not found`);
    return;
  }

  if (pledge.status !== 'active') {
    console.error(`Error: Pledge is ${pledge.status}`);
    return;
  }

  // Calculate credits for elapsed time
  const startDate = new Date(pledge.startDate);
  const now = new Date();
  const elapsedYears = (now - startDate) / (365.25 * 24 * 60 * 60 * 1000);
  const baseRate = BASE_CREDITS_PER_HECTARE[pledge.ecosystem] || 2.0;
  const preservationType = PRESERVATION_TYPES[pledge.type];
  const multiplier = preservationType?.creditMultiplier || 1.0;

  const totalEarned = pledge.areaHectares * elapsedYears * baseRate * multiplier;
  const newCredits = Math.floor(totalEarned - pledge.creditsGenerated);

  if (newCredits <= 0) {
    console.log('\nNo new credits to generate. Try again later.\n');
    return;
  }

  const credit = {
    creditId: generateId('prevcred'),
    pledgeId,
    landId: pledge.landId,
    steward: pledge.steward,
    stewardAddress: pledge.stewardAddress,
    bioregion: pledge.bioregion,
    amount: newCredits,
    type: 'preservation',
    preservationType: pledge.type,
    generatedAt: new Date().toISOString(),
    status: 'active',
    testnetSimulated: true,
  };

  pledge.creditsGenerated += newCredits;
  deployment.preservation.credits.push(credit);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         PRESERVATION CREDITS GENERATED
===============================================================================
  Credit ID:       ${credit.creditId}
  Pledge:          ${pledgeId}
  Land:            ${pledge.landName}
-------------------------------------------------------------------------------
  Amount:          ${newCredits.toLocaleString()} credits
  Type:            Preservation (${pledge.typeName})
-------------------------------------------------------------------------------
  Total generated: ${pledge.creditsGenerated.toLocaleString()} / ${pledge.estimatedCredits.toLocaleString()}
`);
}

function listCredits(args, deployment) {
  const userName = args.user;

  let credits = deployment.preservation.credits || [];

  if (userName) {
    const pnft = getUserPnft(deployment, userName);
    if (pnft) {
      credits = credits.filter(c => c.steward === pnft.id);
    }
  }

  console.log(`
===============================================================================
                    PRESERVATION CREDITS
===============================================================================`);

  if (credits.length === 0) {
    console.log('\n  No preservation credits found.\n');
    return;
  }

  console.log('\n  ID                    PLEDGE                  TYPE                   AMOUNT   STATUS');
  console.log('  --------------------  ----------------------  ---------------------  ------   ------');

  for (const c of credits) {
    const type = PRESERVATION_TYPES[c.preservationType]?.name.slice(0, 21) || c.preservationType;
    console.log(`  ${c.creditId.padEnd(20)}  ${c.pledgeId.slice(0, 22).padEnd(22)}  ${type.padEnd(21)}  ${String(c.amount).padStart(6)}   ${c.status}`);
  }

  const total = credits.reduce((sum, c) => sum + c.amount, 0);
  console.log(`\n  Total: ${total.toLocaleString()} credits\n`);
}

async function transferCredits(args, deployment) {
  const creditId = args.credit;
  const toAddress = args.to;
  const amount = parseInt(args.amount);

  if (!creditId || !toAddress || !amount) {
    console.error('Error: --credit, --to, and --amount are required');
    return;
  }

  const credit = deployment.preservation.credits.find(c => c.creditId === creditId);
  if (!credit) {
    console.error(`Error: Credit ${creditId} not found`);
    return;
  }

  if (credit.amount < amount) {
    console.error(`Error: Insufficient credits (${credit.amount} < ${amount})`);
    return;
  }

  const pnft = getUserPnft(deployment);
  if (!pnft || credit.stewardAddress !== pnft.address) {
    console.error('Error: Only credit owner can transfer');
    return;
  }

  // Create new credit for recipient
  const newCredit = {
    ...credit,
    creditId: generateId('prevcred'),
    amount,
    previousOwner: credit.stewardAddress,
    stewardAddress: toAddress,
    transferredAt: new Date().toISOString(),
  };

  credit.amount -= amount;
  deployment.preservation.credits.push(newCredit);

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         CREDITS TRANSFERRED
===============================================================================
  Amount:          ${amount.toLocaleString()} credits
  From:            ${pnft.address.slice(0, 20)}...
  To:              ${toAddress.slice(0, 20)}...
  New Credit ID:   ${newCredit.creditId}
`);
}

async function retireCredits(args, deployment) {
  const creditId = args.credit;
  const amount = parseInt(args.amount);
  const reason = args.reason || 'Voluntary offset';

  if (!creditId || !amount) {
    console.error('Error: --credit and --amount are required');
    return;
  }

  const credit = deployment.preservation.credits.find(c => c.creditId === creditId);
  if (!credit) {
    console.error(`Error: Credit ${creditId} not found`);
    return;
  }

  if (credit.amount < amount) {
    console.error(`Error: Insufficient credits (${credit.amount} < ${amount})`);
    return;
  }

  const pnft = getUserPnft(deployment);
  if (!pnft || credit.stewardAddress !== pnft.address) {
    console.error('Error: Only credit owner can retire');
    return;
  }

  credit.amount -= amount;

  const retirement = {
    retirementId: generateId('retire'),
    creditId,
    amount,
    reason,
    retiredBy: pnft.id,
    retiredAt: new Date().toISOString(),
  };

  if (!deployment.preservation.retirements) deployment.preservation.retirements = [];
  deployment.preservation.retirements.push(retirement);

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         CREDITS RETIRED
===============================================================================
  Amount:          ${amount.toLocaleString()} credits
  Reason:          ${reason}
  Retired by:      ${pnft.owner}
-------------------------------------------------------------------------------
  Retirement ID:   ${retirement.retirementId}
  These credits are permanently retired and cannot be transferred.
`);
}

function showStats(args, deployment) {
  const bioregion = args.bioregion;

  let pledges = deployment.preservation.pledges || [];
  let credits = deployment.preservation.credits || [];

  if (bioregion) {
    pledges = pledges.filter(p => p.bioregion === bioregion);
    credits = credits.filter(c => c.bioregion === bioregion);
  }

  const totalArea = pledges.reduce((sum, p) => sum + (p.areaHectares || 0), 0);
  const totalEstimated = pledges.reduce((sum, p) => sum + (p.estimatedCredits || 0), 0);
  const totalGenerated = pledges.reduce((sum, p) => sum + (p.creditsGenerated || 0), 0);
  const totalActive = credits.filter(c => c.status === 'active').reduce((sum, c) => sum + c.amount, 0);

  const byType = {};
  for (const p of pledges) {
    byType[p.type] = byType[p.type] || { count: 0, area: 0 };
    byType[p.type].count++;
    byType[p.type].area += p.areaHectares || 0;
  }

  console.log(`
===============================================================================
                    PRESERVATION STATISTICS
                    ${bioregion ? `Bioregion: ${bioregion}` : 'All Bioregions'}
===============================================================================
  PLEDGES:
    Total:           ${pledges.length}
    Active:          ${pledges.filter(p => p.status === 'active').length}
    Area preserved:  ${totalArea.toFixed(2)} hectares

  CREDITS:
    Estimated:       ${totalEstimated.toLocaleString()}
    Generated:       ${totalGenerated.toLocaleString()}
    Active:          ${totalActive.toLocaleString()}
-------------------------------------------------------------------------------
  BY TYPE:
`);

  for (const [type, data] of Object.entries(byType)) {
    const typeName = PRESERVATION_TYPES[type]?.name || type;
    console.log(`    ${typeName.padEnd(25)} ${String(data.count).padStart(4)} pledges, ${data.area.toFixed(2)} ha`);
  }

  console.log('');
}

function listTypes() {
  console.log(`
===============================================================================
                    PRESERVATION TYPES
===============================================================================
`);

  for (const [key, type] of Object.entries(PRESERVATION_TYPES)) {
    console.log(`  ${key}`);
    console.log(`    Name:       ${type.name}`);
    console.log(`    Min years:  ${type.minYears}`);
    console.log(`    Multiplier: ${type.creditMultiplier}x`);
    console.log(`    Restrictions:`);
    for (const r of type.restrictions) {
      console.log(`      - ${r.replace(/_/g, ' ')}`);
    }
    console.log('');
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const deployment = loadDeployment();

  if (args.help || Object.keys(args).length === 0) {
    showHelp();
    return;
  }

  if (args.pledge) {
    await createPledge(args, deployment);
    return;
  }

  if (args['list-pledges']) {
    listPledges(args, deployment);
    return;
  }

  if (args['show-pledge']) {
    showPledge(args, deployment);
    return;
  }

  if (args.verify) {
    await verifyPledge(args, deployment);
    return;
  }

  if (args['generate-credits']) {
    await generateCredits(args, deployment);
    return;
  }

  if (args['list-credits']) {
    listCredits(args, deployment);
    return;
  }

  if (args['transfer-credits']) {
    await transferCredits(args, deployment);
    return;
  }

  if (args['retire-credits']) {
    await retireCredits(args, deployment);
    return;
  }

  if (args.stats) {
    showStats(args, deployment);
    return;
  }

  if (args['list-types']) {
    listTypes();
    return;
  }

  showHelp();
}

main().catch(console.error);
