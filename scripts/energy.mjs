#!/usr/bin/env node
/**
 * UltraLife Protocol — Energy Tracking CLI
 *
 * Track energy production, consumption, and renewable energy credits.
 *
 * Usage:
 *   node energy.mjs --register-source --type solar --capacity 10
 *   node energy.mjs --log-production --source src_123 --amount 50
 *   node energy.mjs --log-consumption --amount 30
 *   node energy.mjs --generate-credits
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONSTANTS
// =============================================================================

const ENERGY_SOURCES = {
  solar: { name: 'Solar', carbonFactor: 0.02, creditMultiplier: 1.0 },
  wind: { name: 'Wind', carbonFactor: 0.01, creditMultiplier: 1.1 },
  hydro: { name: 'Hydroelectric', carbonFactor: 0.015, creditMultiplier: 1.0 },
  geothermal: { name: 'Geothermal', carbonFactor: 0.02, creditMultiplier: 1.05 },
  biomass: { name: 'Biomass', carbonFactor: 0.1, creditMultiplier: 0.7 },
  biogas: { name: 'Biogas', carbonFactor: 0.08, creditMultiplier: 0.8 },
  tidal: { name: 'Tidal', carbonFactor: 0.01, creditMultiplier: 1.15 },
};

// Grid average carbon intensity (kg CO2/kWh)
const GRID_CARBON_INTENSITY = 0.4;

// kWh per credit
const KWH_PER_CREDIT = 1000;

// =============================================================================
// HELPERS
// =============================================================================

function loadDeployment() {
  const deploymentPath = path.join(__dirname, 'deployment.json');
  if (!fs.existsSync(deploymentPath)) {
    return { energy: { sources: [], production: [], consumption: [], credits: [] } };
  }
  const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  if (!data.energy) data.energy = { sources: [], production: [], consumption: [], credits: [] };
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

// =============================================================================
// COMMANDS
// =============================================================================

function showHelp() {
  console.log(`
===============================================================================
                    UltraLife Protocol — Energy Tracking
===============================================================================

Usage: node energy.mjs [command] [options]

COMMANDS:
  --register-source      Register an energy source
    --type <type>        Source type (see below)
    --capacity <kW>      Capacity in kilowatts
    --location <text>    Location description
    --land <id>          Associated land parcel (optional)
    --user <name>        Register as test user

  --list-sources         List energy sources
    --user <name>        Filter by owner
    --bioregion <id>     Filter by bioregion

  --show-source          Show source details
    --source <id>        Source ID

  --log-production       Log energy production
    --source <id>        Source ID
    --amount <kWh>       Amount produced (kWh)
    --period <hours>     Time period (default: 24)

  --log-consumption      Log energy consumption
    --amount <kWh>       Amount consumed (kWh)
    --user <name>        Log as test user

  --generate-credits     Generate renewable energy credits
    --source <id>        Source ID (or --all for all sources)
    --all                Generate for all your sources

  --list-credits         List energy credits
    --user <name>        Filter by owner

  --transfer-credits     Transfer energy credits
    --credit <id>        Credit ID
    --to <address>       Recipient address
    --amount <n>         Amount to transfer

  --retire-credits       Retire credits (permanent offset)
    --credit <id>        Credit ID
    --amount <n>         Amount to retire

  --balance              Show your energy balance
    --user <name>        Check for test user

  --stats                Show energy statistics
    --bioregion <id>     For specific bioregion

  --list-types           Show energy source types

  --help                 Show this help

ENERGY SOURCES:
${Object.entries(ENERGY_SOURCES).map(([k, v]) => `  ${k.padEnd(12)} ${v.name.padEnd(15)} (Carbon: ${v.carbonFactor} kg/kWh, Credit: ${v.creditMultiplier}x)`).join('\n')}

CREDIT CALCULATION:
  Renewable credits = (Production kWh / ${KWH_PER_CREDIT}) * Type Multiplier
  Carbon avoided = Production * (Grid intensity - Source intensity)
  Grid carbon intensity: ${GRID_CARBON_INTENSITY} kg CO2/kWh
`);
}

async function registerSource(args, deployment) {
  const type = args.type;
  const capacity = parseFloat(args.capacity);
  const location = args.location || '';
  const landId = args.land;
  const userName = args.user;

  if (!type) {
    console.error('Error: --type is required');
    return;
  }

  if (!ENERGY_SOURCES[type]) {
    console.error(`Error: Unknown type "${type}". Use --list-types to see options.`);
    return;
  }

  if (!capacity || capacity <= 0) {
    console.error('Error: --capacity is required and must be positive');
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const sourceType = ENERGY_SOURCES[type];

  const source = {
    sourceId: generateId('energy'),
    owner: pnft.id,
    ownerAddress: pnft.address,
    bioregion: pnft.bioregion,
    type,
    typeName: sourceType.name,
    capacityKw: capacity,
    location,
    landId: landId || null,
    carbonFactor: sourceType.carbonFactor,
    creditMultiplier: sourceType.creditMultiplier,
    totalProduction: 0,
    totalCreditsGenerated: 0,
    registeredAt: new Date().toISOString(),
    status: 'active',
    testnetSimulated: true,
  };

  deployment.energy.sources.push(source);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         ENERGY SOURCE REGISTERED
===============================================================================
  Source ID:       ${source.sourceId}
  Type:            ${sourceType.name}
  Capacity:        ${capacity} kW
  Owner:           ${pnft.owner}
  Bioregion:       ${pnft.bioregion}
  ${location ? `Location:        ${location}` : ''}
  ${landId ? `Land:            ${landId}` : ''}
-------------------------------------------------------------------------------
  Carbon factor:   ${sourceType.carbonFactor} kg CO2/kWh
  Credit mult:     ${sourceType.creditMultiplier}x
-------------------------------------------------------------------------------

Log production with: npm run energy:log -- --source ${source.sourceId} --amount <kWh>
`);
}

function listSources(args, deployment) {
  const userName = args.user;
  const bioregion = args.bioregion;

  let sources = deployment.energy.sources || [];

  if (userName) {
    const pnft = getUserPnft(deployment, userName);
    if (pnft) {
      sources = sources.filter(s => s.owner === pnft.id);
    }
  }

  if (bioregion) {
    sources = sources.filter(s => s.bioregion === bioregion);
  }

  console.log(`
===============================================================================
                    ENERGY SOURCES
===============================================================================`);

  if (sources.length === 0) {
    console.log('\n  No energy sources found.\n');
    return;
  }

  console.log('\n  ID                    TYPE            CAPACITY    PRODUCTION   STATUS');
  console.log('  --------------------  --------------  ----------  -----------  ------');

  for (const s of sources) {
    console.log(`  ${s.sourceId.padEnd(20)}  ${s.typeName.slice(0, 14).padEnd(14)}  ${String(s.capacityKw + ' kW').padEnd(10)}  ${String(s.totalProduction.toFixed(0) + ' kWh').padEnd(11)}  ${s.status}`);
  }

  const totalCapacity = sources.reduce((sum, s) => sum + s.capacityKw, 0);
  const totalProduction = sources.reduce((sum, s) => sum + s.totalProduction, 0);

  console.log(`
-------------------------------------------------------------------------------
  Total: ${sources.length} sources
  Capacity: ${totalCapacity.toFixed(2)} kW
  Total Production: ${totalProduction.toLocaleString()} kWh
`);
}

function showSource(args, deployment) {
  const sourceId = args.source;

  if (!sourceId) {
    console.error('Error: --source is required');
    return;
  }

  const source = deployment.energy.sources.find(s => s.sourceId === sourceId);
  if (!source) {
    console.error(`Error: Source ${sourceId} not found`);
    return;
  }

  const productionLogs = deployment.energy.production.filter(p => p.sourceId === sourceId);
  const recentLogs = productionLogs.slice(-5);

  console.log(`
===============================================================================
                    ENERGY SOURCE
===============================================================================
  Source ID:       ${source.sourceId}
  Type:            ${source.typeName}
  Status:          ${source.status.toUpperCase()}
  Owner:           ${source.owner}
  Bioregion:       ${source.bioregion}
-------------------------------------------------------------------------------
  SPECIFICATIONS:
    Capacity:      ${source.capacityKw} kW
    Carbon Factor: ${source.carbonFactor} kg CO2/kWh
    Credit Mult:   ${source.creditMultiplier}x
    Location:      ${source.location || 'Not specified'}
    Land:          ${source.landId || 'Not linked'}
-------------------------------------------------------------------------------
  PRODUCTION:
    Total:         ${source.totalProduction.toLocaleString()} kWh
    Credits Gen:   ${source.totalCreditsGenerated.toLocaleString()}
    Registered:    ${new Date(source.registeredAt).toLocaleString()}
-------------------------------------------------------------------------------
  RECENT PRODUCTION LOGS (${recentLogs.length}):
`);

  if (recentLogs.length === 0) {
    console.log('    (No production logged yet)\n');
  } else {
    for (const log of recentLogs) {
      console.log(`    - ${new Date(log.loggedAt).toLocaleDateString()}: ${log.amountKwh} kWh over ${log.periodHours}h`);
    }
    console.log('');
  }
}

async function logProduction(args, deployment) {
  const sourceId = args.source;
  const amount = parseFloat(args.amount);
  const period = parseInt(args.period) || 24;

  if (!sourceId) {
    console.error('Error: --source is required');
    return;
  }

  if (!amount || amount <= 0) {
    console.error('Error: --amount is required and must be positive');
    return;
  }

  const source = deployment.energy.sources.find(s => s.sourceId === sourceId);
  if (!source) {
    console.error(`Error: Source ${sourceId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment);
  if (!pnft || source.owner !== pnft.id) {
    console.error('Error: Only source owner can log production');
    return;
  }

  // Calculate carbon avoided
  const carbonAvoided = amount * (GRID_CARBON_INTENSITY - source.carbonFactor);

  const log = {
    logId: generateId('prodlog'),
    sourceId,
    amountKwh: amount,
    periodHours: period,
    carbonAvoided,
    loggedAt: new Date().toISOString(),
    testnetSimulated: true,
  };

  source.totalProduction += amount;
  deployment.energy.production.push(log);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         PRODUCTION LOGGED
===============================================================================
  Source:          ${source.typeName} (${sourceId})
  Amount:          ${amount.toLocaleString()} kWh
  Period:          ${period} hours
-------------------------------------------------------------------------------
  Carbon avoided:  ${carbonAvoided.toFixed(2)} kg CO2
  Total production: ${source.totalProduction.toLocaleString()} kWh
`);
}

async function logConsumption(args, deployment) {
  const amount = parseFloat(args.amount);
  const userName = args.user;

  if (!amount || amount <= 0) {
    console.error('Error: --amount is required and must be positive');
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const carbonUsed = amount * GRID_CARBON_INTENSITY;

  const log = {
    logId: generateId('conslog'),
    consumer: pnft.id,
    consumerAddress: pnft.address,
    bioregion: pnft.bioregion,
    amountKwh: amount,
    carbonUsed,
    loggedAt: new Date().toISOString(),
    testnetSimulated: true,
  };

  deployment.energy.consumption.push(log);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         CONSUMPTION LOGGED
===============================================================================
  Consumer:        ${pnft.owner}
  Amount:          ${amount.toLocaleString()} kWh
  Carbon impact:   ${carbonUsed.toFixed(2)} kg CO2
-------------------------------------------------------------------------------
  Tip: Offset with renewable energy credits!
`);
}

async function generateCredits(args, deployment) {
  const sourceId = args.source;
  const all = args.all;

  const pnft = getUserPnft(deployment);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  let sources;
  if (all) {
    sources = deployment.energy.sources.filter(s => s.owner === pnft.id);
  } else if (sourceId) {
    const source = deployment.energy.sources.find(s => s.sourceId === sourceId);
    if (!source) {
      console.error(`Error: Source ${sourceId} not found`);
      return;
    }
    if (source.owner !== pnft.id) {
      console.error('Error: Only source owner can generate credits');
      return;
    }
    sources = [source];
  } else {
    console.error('Error: --source or --all is required');
    return;
  }

  let totalCredits = 0;

  for (const source of sources) {
    const availableKwh = source.totalProduction - (source.totalCreditsGenerated * KWH_PER_CREDIT);
    const newCredits = Math.floor((availableKwh / KWH_PER_CREDIT) * source.creditMultiplier);

    if (newCredits <= 0) continue;

    const credit = {
      creditId: generateId('energycred'),
      sourceId: source.sourceId,
      sourceType: source.type,
      owner: pnft.id,
      ownerAddress: pnft.address,
      bioregion: source.bioregion,
      amount: newCredits,
      kwhEquivalent: newCredits * KWH_PER_CREDIT,
      carbonAvoided: newCredits * KWH_PER_CREDIT * (GRID_CARBON_INTENSITY - source.carbonFactor),
      generatedAt: new Date().toISOString(),
      status: 'active',
      testnetSimulated: true,
    };

    source.totalCreditsGenerated += newCredits;
    deployment.energy.credits.push(credit);
    totalCredits += newCredits;
  }

  await saveDeploymentAsync(deployment);

  if (totalCredits === 0) {
    console.log('\nNo new credits available to generate. Produce more energy first.\n');
    return;
  }

  console.log(`
===============================================================================
                         ENERGY CREDITS GENERATED
===============================================================================
  Sources processed: ${sources.length}
  Total credits:     ${totalCredits.toLocaleString()}
  kWh equivalent:    ${(totalCredits * KWH_PER_CREDIT).toLocaleString()} kWh
`);
}

function listCredits(args, deployment) {
  const userName = args.user;

  let credits = deployment.energy.credits || [];

  if (userName) {
    const pnft = getUserPnft(deployment, userName);
    if (pnft) {
      credits = credits.filter(c => c.owner === pnft.id);
    }
  }

  console.log(`
===============================================================================
                    ENERGY CREDITS
===============================================================================`);

  if (credits.length === 0) {
    console.log('\n  No energy credits found.\n');
    return;
  }

  console.log('\n  ID                    SOURCE TYPE     AMOUNT    KWH        STATUS');
  console.log('  --------------------  --------------  --------  ---------  ------');

  for (const c of credits) {
    const typeName = ENERGY_SOURCES[c.sourceType]?.name.slice(0, 14) || c.sourceType;
    console.log(`  ${c.creditId.padEnd(20)}  ${typeName.padEnd(14)}  ${String(c.amount).padStart(8)}  ${String(c.kwhEquivalent).padStart(9)}  ${c.status}`);
  }

  const total = credits.reduce((sum, c) => sum + c.amount, 0);
  const totalKwh = credits.reduce((sum, c) => sum + c.kwhEquivalent, 0);

  console.log(`
-------------------------------------------------------------------------------
  Total: ${total.toLocaleString()} credits (${totalKwh.toLocaleString()} kWh equivalent)
`);
}

async function transferCredits(args, deployment) {
  const creditId = args.credit;
  const toAddress = args.to;
  const amount = parseInt(args.amount);

  if (!creditId || !toAddress || !amount) {
    console.error('Error: --credit, --to, and --amount are required');
    return;
  }

  const credit = deployment.energy.credits.find(c => c.creditId === creditId);
  if (!credit) {
    console.error(`Error: Credit ${creditId} not found`);
    return;
  }

  if (credit.amount < amount) {
    console.error(`Error: Insufficient credits (${credit.amount} < ${amount})`);
    return;
  }

  const pnft = getUserPnft(deployment);
  if (!pnft || credit.ownerAddress !== pnft.address) {
    console.error('Error: Only credit owner can transfer');
    return;
  }

  const newCredit = {
    ...credit,
    creditId: generateId('energycred'),
    amount,
    kwhEquivalent: amount * KWH_PER_CREDIT,
    previousOwner: credit.ownerAddress,
    ownerAddress: toAddress,
    transferredAt: new Date().toISOString(),
  };

  credit.amount -= amount;
  credit.kwhEquivalent = credit.amount * KWH_PER_CREDIT;
  deployment.energy.credits.push(newCredit);

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         CREDITS TRANSFERRED
===============================================================================
  Amount:          ${amount.toLocaleString()} credits
  kWh equivalent:  ${(amount * KWH_PER_CREDIT).toLocaleString()} kWh
  To:              ${toAddress.slice(0, 20)}...
`);
}

async function retireCredits(args, deployment) {
  const creditId = args.credit;
  const amount = parseInt(args.amount);

  if (!creditId || !amount) {
    console.error('Error: --credit and --amount are required');
    return;
  }

  const credit = deployment.energy.credits.find(c => c.creditId === creditId);
  if (!credit) {
    console.error(`Error: Credit ${creditId} not found`);
    return;
  }

  if (credit.amount < amount) {
    console.error(`Error: Insufficient credits (${credit.amount} < ${amount})`);
    return;
  }

  credit.amount -= amount;
  credit.kwhEquivalent = credit.amount * KWH_PER_CREDIT;

  if (!deployment.energy.retirements) deployment.energy.retirements = [];
  deployment.energy.retirements.push({
    retirementId: generateId('retire'),
    creditId,
    amount,
    kwhEquivalent: amount * KWH_PER_CREDIT,
    retiredAt: new Date().toISOString(),
  });

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         CREDITS RETIRED
===============================================================================
  Amount:          ${amount.toLocaleString()} credits
  kWh equivalent:  ${(amount * KWH_PER_CREDIT).toLocaleString()} kWh
  Carbon offset:   ${(amount * KWH_PER_CREDIT * GRID_CARBON_INTENSITY).toFixed(2)} kg CO2
`);
}

function showBalance(args, deployment) {
  const userName = args.user;
  const pnft = getUserPnft(deployment, userName);

  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const sources = deployment.energy.sources.filter(s => s.owner === pnft.id);
  const credits = deployment.energy.credits.filter(c => c.owner === pnft.id && c.status === 'active');
  const consumption = deployment.energy.consumption.filter(c => c.consumer === pnft.id);

  const totalProduction = sources.reduce((sum, s) => sum + s.totalProduction, 0);
  const totalCredits = credits.reduce((sum, c) => sum + c.amount, 0);
  const totalConsumed = consumption.reduce((sum, c) => sum + c.amountKwh, 0);
  const totalCarbonConsumed = consumption.reduce((sum, c) => sum + c.carbonUsed, 0);
  const creditsKwh = totalCredits * KWH_PER_CREDIT;

  const netEnergy = totalProduction - totalConsumed;
  const netCarbon = (totalProduction * 0.02) - totalCarbonConsumed;

  console.log(`
===============================================================================
                    ENERGY BALANCE — ${pnft.owner}
===============================================================================
  SOURCES:         ${sources.length}
  TOTAL CAPACITY:  ${sources.reduce((sum, s) => sum + s.capacityKw, 0)} kW

  PRODUCTION:      ${totalProduction.toLocaleString()} kWh
  CONSUMPTION:     ${totalConsumed.toLocaleString()} kWh
  NET:             ${netEnergy >= 0 ? '+' : ''}${netEnergy.toLocaleString()} kWh
-------------------------------------------------------------------------------
  CREDITS:         ${totalCredits.toLocaleString()}
  kWh EQUIVALENT:  ${creditsKwh.toLocaleString()} kWh
-------------------------------------------------------------------------------
  CARBON IMPACT:
    Consumed:      ${totalCarbonConsumed.toFixed(2)} kg CO2
    Offsetable:    ${(creditsKwh * GRID_CARBON_INTENSITY).toFixed(2)} kg CO2
    Net:           ${(totalCarbonConsumed - (creditsKwh * GRID_CARBON_INTENSITY)).toFixed(2)} kg CO2
`);
}

function showStats(args, deployment) {
  const bioregion = args.bioregion;

  let sources = deployment.energy.sources || [];
  let production = deployment.energy.production || [];
  let credits = deployment.energy.credits || [];

  if (bioregion) {
    sources = sources.filter(s => s.bioregion === bioregion);
    credits = credits.filter(c => c.bioregion === bioregion);
  }

  const totalCapacity = sources.reduce((sum, s) => sum + s.capacityKw, 0);
  const totalProduction = sources.reduce((sum, s) => sum + s.totalProduction, 0);
  const totalCredits = credits.reduce((sum, c) => sum + c.amount, 0);

  const byType = {};
  for (const s of sources) {
    byType[s.type] = byType[s.type] || { count: 0, capacity: 0, production: 0 };
    byType[s.type].count++;
    byType[s.type].capacity += s.capacityKw;
    byType[s.type].production += s.totalProduction;
  }

  console.log(`
===============================================================================
                    ENERGY STATISTICS
                    ${bioregion ? `Bioregion: ${bioregion}` : 'All Bioregions'}
===============================================================================
  SOURCES:         ${sources.length}
  TOTAL CAPACITY:  ${totalCapacity.toFixed(2)} kW
  TOTAL PRODUCED:  ${totalProduction.toLocaleString()} kWh
  TOTAL CREDITS:   ${totalCredits.toLocaleString()}
-------------------------------------------------------------------------------
  BY TYPE:
`);

  for (const [type, data] of Object.entries(byType).sort((a, b) => b[1].production - a[1].production)) {
    const typeName = ENERGY_SOURCES[type]?.name || type;
    console.log(`    ${typeName.padEnd(15)} ${String(data.count).padStart(3)} sources, ${data.capacity.toFixed(0).padStart(6)} kW, ${data.production.toLocaleString().padStart(12)} kWh`);
  }

  console.log('');
}

function listTypes() {
  console.log(`
===============================================================================
                    ENERGY SOURCE TYPES
===============================================================================
`);

  for (const [key, type] of Object.entries(ENERGY_SOURCES)) {
    console.log(`  ${key.padEnd(12)} ${type.name}`);
    console.log(`               Carbon: ${type.carbonFactor} kg CO2/kWh`);
    console.log(`               Credit multiplier: ${type.creditMultiplier}x`);
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

  if (args['register-source']) {
    await registerSource(args, deployment);
    return;
  }

  if (args['list-sources']) {
    listSources(args, deployment);
    return;
  }

  if (args['show-source']) {
    showSource(args, deployment);
    return;
  }

  if (args['log-production']) {
    await logProduction(args, deployment);
    return;
  }

  if (args['log-consumption']) {
    await logConsumption(args, deployment);
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

  if (args.balance) {
    showBalance(args, deployment);
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
