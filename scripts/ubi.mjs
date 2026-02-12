#!/usr/bin/env node
/**
 * UltraLife Protocol — UBI CLI
 *
 * Universal Basic Income distribution management.
 * UBI is 100% fee-funded, distributed each 37-day cycle.
 *
 * Usage:
 *   node ubi.mjs --fund-pool --cycle 1 --amount 10000
 *   node ubi.mjs --claim --cycle 1
 *   node ubi.mjs --show-pool --cycle 1
 *   node ubi.mjs --my-claims
 *   node ubi.mjs --calculate --cycle 1
 *   node ubi.mjs --close-cycle --cycle 1
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONSTANTS (from ubi.ak validator)
// =============================================================================

const SURVIVAL_FLOOR = 20;           // Base UBI for everyone
const MIN_UBI_PER_PERSON = 10;
const MAX_UBI_PER_PERSON = 500;
const TARGET_UBI_PER_PERSON = 100;
const MIN_ENGAGEMENT_TX = 5;
const MIN_ENGAGEMENT_COUNTERPARTIES = 2;
const UBI_WINDOW_DAYS = 3.7;         // First 3.7 days of cycle

const ENGAGEMENT_RAMPS = {
  0: 0,      // 0 transactions = 0% of variable share
  1: 2500,   // 1 transaction = 25%
  2: 5000,   // 2 transactions = 50%
  3: 7000,   // 3 transactions = 70%
  4: 8500,   // 4 transactions = 85%
  5: 10000,  // 5+ with 2+ counterparties = 100%
};

// =============================================================================
// HELPERS
// =============================================================================

function loadDeployment() {
  const deploymentPath = path.join(__dirname, 'deployment.json');
  if (!fs.existsSync(deploymentPath)) {
    return { ubi: { pools: [], claims: [] } };
  }
  const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  if (!data.ubi) {
    data.ubi = { pools: [], claims: [] };
  }
  return data;
}

function saveDeployment(data) {
  const { atomicWriteSync } = require('./utils.mjs');
  const deploymentPath = path.join(__dirname, 'deployment.json');
  atomicWriteSync(deploymentPath, data);
}

async function saveDeploymentAsync(data) {
  const { atomicWriteSync } = await import('./utils.mjs');
  const deploymentPath = path.join(__dirname, 'deployment.json');
  atomicWriteSync(deploymentPath, data);
}

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function getCurrentCycle() {
  const CYCLE_LENGTH_MS = 37 * 24 * 60 * 60 * 1000;
  const protocolStart = new Date('2026-01-01').getTime();
  const now = Date.now();
  return Math.floor((now - protocolStart) / CYCLE_LENGTH_MS) + 1;
}

function getCycleWindow(cycle) {
  const CYCLE_LENGTH_MS = 37 * 24 * 60 * 60 * 1000;
  const protocolStart = new Date('2026-01-01').getTime();
  const cycleStart = protocolStart + ((cycle - 1) * CYCLE_LENGTH_MS);
  const windowEnd = cycleStart + (UBI_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { cycleStart, windowEnd };
}

function isInUbiWindow(cycle) {
  const { cycleStart, windowEnd } = getCycleWindow(cycle);
  const now = Date.now();
  return now >= cycleStart && now <= windowEnd;
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

function calculateEngagementWeight(stats) {
  if (!stats) return { weight: 0, ramp: 0 };

  const totalTx = (stats.txSent || 0) + (stats.txReceived || 0);
  const counterparties = stats.uniqueCounterparties || 0;
  const laborCount = stats.laborCount || 0;
  const remediationCount = stats.remediationCount || 0;

  // Calculate weight
  const base = 1000;
  const txWeight = totalTx * 100;
  const counterpartyWeight = counterparties * 500;
  const laborWeight = laborCount * 1000;
  const remediationWeight = remediationCount * 2000;
  const weight = base + txWeight + counterpartyWeight + laborWeight + remediationWeight;

  // Calculate ramp
  let ramp = 0;
  if (totalTx >= MIN_ENGAGEMENT_TX && counterparties >= MIN_ENGAGEMENT_COUNTERPARTIES) {
    ramp = 10000; // 100%
  } else if (totalTx >= 4) {
    ramp = 8500;
  } else if (totalTx >= 3) {
    ramp = 7000;
  } else if (totalTx >= 2) {
    ramp = 5000;
  } else if (totalTx >= 1) {
    ramp = 2500;
  }

  return { weight, ramp };
}

function calculateUbiAmount(pool, pnftStats) {
  const floor = SURVIVAL_FLOOR;
  const { weight, ramp } = calculateEngagementWeight(pnftStats);

  const poolAfterFloors = pool.amount - (pool.eligibleCount * SURVIVAL_FLOOR);
  let variableShare = 0;

  if (pool.totalWeight > 0 && poolAfterFloors > 0) {
    variableShare = (weight * poolAfterFloors) / pool.totalWeight;
  }

  const rampedShare = (variableShare * ramp) / 10000;
  const total = floor + rampedShare;

  return Math.min(Math.round(total * 100) / 100, MAX_UBI_PER_PERSON);
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

// =============================================================================
// COMMANDS
// =============================================================================

function showHelp() {
  console.log(`
===============================================================================
                    UltraLife Protocol — UBI Distribution
===============================================================================

Usage: node ubi.mjs [command] [options]

COMMANDS:
  --fund-pool            Fund UBI pool for a cycle
    --cycle <n>          Cycle number
    --amount <n>         Amount to fund (ULTRA)
    --bioregion <name>   Bioregion (default: sierra_nevada)

  --claim                Claim UBI for current cycle
    --cycle <n>          Cycle number (default: current)
    --user <name>        Claim as test user

  --show-pool            Show UBI pool status
    --cycle <n>          Cycle number (default: current)
    --bioregion <name>   Bioregion (default: all)

  --my-claims            Show your claim history
    --user <name>        Check for test user

  --calculate            Calculate expected UBI amount
    --cycle <n>          Cycle number (default: current)
    --user <name>        Calculate for test user

  --close-cycle          Close cycle (return unclaimed to treasury)
    --cycle <n>          Cycle number

  --current-cycle        Show current cycle info

  --help                 Show this help

UBI FORMULA:
  Distribution = Survival Floor + (Variable Share * Engagement Ramp)

  Survival Floor: ${SURVIVAL_FLOOR} ULTRA (everyone gets this)
  Engagement Ramp: 0% (0 tx) to 100% (5+ tx with 2+ counterparties)

  Variable Share based on engagement weight:
    - Transactions: +100 per tx
    - Counterparties: +500 per unique counterparty
    - Labor: +1000 per labor transaction
    - Remediation: +2000 per remediation

  Min: ${MIN_UBI_PER_PERSON} ULTRA | Max: ${MAX_UBI_PER_PERSON} ULTRA

UBI WINDOW:
  First ${UBI_WINDOW_DAYS} days of each 37-day cycle
  After window: unclaimed returns to treasury
`);
}

async function fundPool(args, deployment) {
  const cycle = parseInt(args.cycle) || getCurrentCycle();
  const amount = parseFloat(args.amount);
  const bioregion = args.bioregion || 'sierra_nevada';

  if (!amount || amount <= 0) {
    console.error('Error: --amount is required and must be positive');
    return;
  }

  // Calculate eligible count and total weight from bioregion stats
  const eligiblePnfts = (deployment.pnfts || []).filter(p =>
    p.bioregion === bioregion && p.level !== 'Basic' && p.level !== 'Ward'
  );
  const eligibleCount = eligiblePnfts.length;

  // Calculate total weight
  let totalWeight = 0;
  for (const pnft of eligiblePnfts) {
    const stats = deployment.avatarStats?.[pnft.id]?.[cycle - 1];
    const { weight } = calculateEngagementWeight(stats);
    totalWeight += weight;
  }

  const pool = {
    poolId: generateId('ubipool'),
    cycle,
    bioregion,
    amount,
    originalAmount: amount,
    eligibleCount,
    totalWeight,
    claimsCount: 0,
    totalDistributed: 0,
    status: 'active',
    fundedAt: new Date().toISOString(),
    testnetSimulated: true,
  };

  deployment.ubi.pools.push(pool);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         UBI POOL FUNDED
===============================================================================
  Pool ID:       ${pool.poolId}
  Cycle:         ${cycle}
  Bioregion:     ${bioregion}
  Amount:        ${amount} ULTRA
  Eligible:      ${eligibleCount} participants
  Total Weight:  ${totalWeight}
-------------------------------------------------------------------------------
  Per-person estimate: ${eligibleCount > 0 ? (amount / eligibleCount).toFixed(2) : 0} ULTRA
-------------------------------------------------------------------------------

Participants can claim during the UBI window (first ${UBI_WINDOW_DAYS} days of cycle).
Claim with: npm run ubi:claim -- --cycle ${cycle}
`);
}

async function claimUbi(args, deployment) {
  const cycle = parseInt(args.cycle) || getCurrentCycle();
  const userName = args.user;

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  if (pnft.level === 'Basic' || pnft.level === 'Ward') {
    console.error(`Error: ${pnft.level} level cannot claim UBI. Need Standard or higher.`);
    return;
  }

  // Check if in UBI window
  if (!isInUbiWindow(cycle)) {
    const { windowEnd } = getCycleWindow(cycle);
    console.error(`Error: UBI window for cycle ${cycle} has ended (${new Date(windowEnd).toISOString()})`);
    return;
  }

  // Find pool
  const pool = deployment.ubi.pools.find(p =>
    p.cycle === cycle && p.bioregion === pnft.bioregion && p.status === 'active'
  );

  if (!pool) {
    console.error(`Error: No active UBI pool for cycle ${cycle} in ${pnft.bioregion}`);
    return;
  }

  // Check if already claimed
  const existingClaim = deployment.ubi.claims.find(c =>
    c.pnftId === pnft.id && c.cycle === cycle
  );

  if (existingClaim) {
    console.error(`Error: Already claimed UBI for cycle ${cycle} (${existingClaim.amount} ULTRA)`);
    return;
  }

  // Get stats for previous cycle
  const stats = deployment.avatarStats?.[pnft.id]?.[cycle - 1];

  // Calculate amount
  const amount = calculateUbiAmount(pool, stats);

  if (pool.amount < amount) {
    console.error(`Error: Insufficient pool funds (${pool.amount} < ${amount})`);
    return;
  }

  // Create claim
  const claim = {
    claimId: generateId('ubiclaim'),
    pnftId: pnft.id,
    owner: pnft.owner,
    address: pnft.address,
    cycle,
    bioregion: pnft.bioregion,
    amount,
    engagementWeight: calculateEngagementWeight(stats).weight,
    engagementRamp: calculateEngagementWeight(stats).ramp,
    claimedAt: new Date().toISOString(),
    testnetSimulated: true,
  };

  // Update pool
  pool.amount -= amount;
  pool.claimsCount += 1;
  pool.totalDistributed += amount;

  // Update balance
  if (!deployment.ultraBalances) deployment.ultraBalances = {};
  deployment.ultraBalances[pnft.address] = (deployment.ultraBalances[pnft.address] || 0) + amount;

  deployment.ubi.claims.push(claim);
  await saveDeploymentAsync(deployment);

  const { weight, ramp } = calculateEngagementWeight(stats);

  console.log(`
===============================================================================
                           UBI CLAIMED
===============================================================================
  Claim ID:      ${claim.claimId}
  Cycle:         ${cycle}
  Recipient:     ${pnft.owner}
  pNFT:          ${pnft.id}
  Level:         ${pnft.level}
-------------------------------------------------------------------------------
  Survival Floor:     ${SURVIVAL_FLOOR} ULTRA
  Engagement Weight:  ${weight}
  Engagement Ramp:    ${(ramp / 100).toFixed(0)}%
  Variable Share:     ${(amount - SURVIVAL_FLOOR).toFixed(2)} ULTRA
-------------------------------------------------------------------------------
  TOTAL CLAIMED:      ${amount.toFixed(2)} ULTRA
-------------------------------------------------------------------------------
  New Balance:        ${deployment.ultraBalances[pnft.address].toFixed(2)} ULTRA
`);
}

function showPool(args, deployment) {
  const cycle = parseInt(args.cycle) || getCurrentCycle();
  const bioregion = args.bioregion;

  let pools = deployment.ubi.pools.filter(p => p.cycle === cycle);
  if (bioregion) {
    pools = pools.filter(p => p.bioregion === bioregion);
  }

  if (pools.length === 0) {
    console.log(`\nNo UBI pools found for cycle ${cycle}`);
    return;
  }

  console.log(`
===============================================================================
                    UBI POOLS — Cycle ${cycle}
===============================================================================`);

  for (const pool of pools) {
    const percentClaimed = pool.originalAmount > 0
      ? ((pool.totalDistributed / pool.originalAmount) * 100).toFixed(1)
      : 0;

    console.log(`
  Bioregion:      ${pool.bioregion}
  Pool ID:        ${pool.poolId}
  Status:         ${pool.status.toUpperCase()}
  Original:       ${pool.originalAmount} ULTRA
  Remaining:      ${pool.amount.toFixed(2)} ULTRA
  Distributed:    ${pool.totalDistributed.toFixed(2)} ULTRA (${percentClaimed}%)
  Claims:         ${pool.claimsCount} / ${pool.eligibleCount} eligible
  Avg per claim:  ${pool.claimsCount > 0 ? (pool.totalDistributed / pool.claimsCount).toFixed(2) : 0} ULTRA
  Funded:         ${new Date(pool.fundedAt).toLocaleString()}
`);
  }

  // Show window status
  const { cycleStart, windowEnd } = getCycleWindow(cycle);
  const now = Date.now();
  const inWindow = now >= cycleStart && now <= windowEnd;

  console.log(`-------------------------------------------------------------------------------
  UBI Window: ${new Date(cycleStart).toLocaleString()} to ${new Date(windowEnd).toLocaleString()}
  Status: ${inWindow ? 'OPEN' : 'CLOSED'}
`);
}

function myClaims(args, deployment) {
  const userName = args.user || 'Main';
  const pnft = getUserPnft(deployment, userName);

  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const claims = deployment.ubi.claims.filter(c => c.pnftId === pnft.id);

  console.log(`
===============================================================================
                    UBI Claims for ${pnft.owner}
===============================================================================`);

  if (claims.length === 0) {
    console.log('\n  No UBI claims found.\n');
    return;
  }

  console.log('\n  CYCLE    AMOUNT      WEIGHT    RAMP     CLAIMED AT');
  console.log('  ------   ---------   ------    ----     -------------------');

  let totalClaimed = 0;
  for (const claim of claims) {
    const rampPct = claim.engagementRamp ? `${(claim.engagementRamp / 100).toFixed(0)}%` : 'N/A';
    console.log(`  ${String(claim.cycle).padEnd(6)} ${claim.amount.toFixed(2).padStart(9)} ULTRA  ${String(claim.engagementWeight || 0).padEnd(6)}  ${rampPct.padEnd(6)}   ${new Date(claim.claimedAt).toLocaleString()}`);
    totalClaimed += claim.amount;
  }

  console.log(`
-------------------------------------------------------------------------------
  Total Claims: ${claims.length}
  Total UBI:    ${totalClaimed.toFixed(2)} ULTRA
`);
}

function calculateAmount(args, deployment) {
  const cycle = parseInt(args.cycle) || getCurrentCycle();
  const userName = args.user;

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const pool = deployment.ubi.pools.find(p =>
    p.cycle === cycle && p.bioregion === pnft.bioregion && p.status === 'active'
  );

  if (!pool) {
    console.log(`\nNo active UBI pool for cycle ${cycle} in ${pnft.bioregion}`);
    console.log('Showing calculation with hypothetical pool...\n');
  }

  const stats = deployment.avatarStats?.[pnft.id]?.[cycle - 1];
  const { weight, ramp } = calculateEngagementWeight(stats);

  const hypotheticalPool = pool || {
    amount: 10000,
    eligibleCount: 10,
    totalWeight: 10000,
  };

  const amount = calculateUbiAmount(hypotheticalPool, stats);

  console.log(`
===============================================================================
                    UBI Calculation for ${pnft.owner}
===============================================================================
  Cycle:           ${cycle}
  pNFT:            ${pnft.id}
  Level:           ${pnft.level}
  Bioregion:       ${pnft.bioregion}
-------------------------------------------------------------------------------
  ENGAGEMENT STATS (from cycle ${cycle - 1}):
    Transactions:     ${stats ? (stats.txSent || 0) + (stats.txReceived || 0) : 0}
    Counterparties:   ${stats?.uniqueCounterparties || 0}
    Labor txs:        ${stats?.laborCount || 0}
    Remediation txs:  ${stats?.remediationCount || 0}
-------------------------------------------------------------------------------
  CALCULATION:
    Engagement Weight: ${weight}
    Engagement Ramp:   ${(ramp / 100).toFixed(0)}%
    Survival Floor:    ${SURVIVAL_FLOOR} ULTRA
    Variable Share:    ${(amount - SURVIVAL_FLOOR).toFixed(2)} ULTRA
-------------------------------------------------------------------------------
  ESTIMATED UBI:       ${amount.toFixed(2)} ULTRA
-------------------------------------------------------------------------------
`);
}

async function closeCycle(args, deployment) {
  const cycle = parseInt(args.cycle);

  if (!cycle) {
    console.error('Error: --cycle is required');
    return;
  }

  const { windowEnd } = getCycleWindow(cycle);
  if (Date.now() <= windowEnd) {
    console.error(`Error: UBI window for cycle ${cycle} has not ended yet`);
    console.error(`Window ends: ${new Date(windowEnd).toISOString()}`);
    return;
  }

  const pools = deployment.ubi.pools.filter(p => p.cycle === cycle && p.status === 'active');

  if (pools.length === 0) {
    console.log(`\nNo active pools to close for cycle ${cycle}`);
    return;
  }

  let totalReturned = 0;

  for (const pool of pools) {
    const remaining = pool.amount;
    pool.status = 'closed';
    pool.closedAt = new Date().toISOString();
    pool.returnedToTreasury = remaining;
    totalReturned += remaining;
  }

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                    CYCLE ${cycle} CLOSED
===============================================================================
  Pools closed:        ${pools.length}
  Returned to treasury: ${totalReturned.toFixed(2)} ULTRA
  Total distributed:   ${pools.reduce((sum, p) => sum + p.totalDistributed, 0).toFixed(2)} ULTRA
  Total claims:        ${pools.reduce((sum, p) => sum + p.claimsCount, 0)}
`);
}

function currentCycleInfo(deployment) {
  const cycle = getCurrentCycle();
  const { cycleStart, windowEnd } = getCycleWindow(cycle);
  const now = Date.now();
  const inWindow = now >= cycleStart && now <= windowEnd;

  const pools = deployment.ubi.pools.filter(p => p.cycle === cycle && p.status === 'active');

  console.log(`
===============================================================================
                    Current UBI Cycle
===============================================================================
  Cycle Number:    ${cycle}
  Cycle Start:     ${new Date(cycleStart).toLocaleString()}
  UBI Window End:  ${new Date(windowEnd).toLocaleString()}
  Window Status:   ${inWindow ? 'OPEN' : 'CLOSED'}
-------------------------------------------------------------------------------
  Active Pools:    ${pools.length}
  Total Available: ${pools.reduce((sum, p) => sum + p.amount, 0).toFixed(2)} ULTRA
  Total Claimed:   ${pools.reduce((sum, p) => sum + p.totalDistributed, 0).toFixed(2)} ULTRA
`);
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

  if (args['fund-pool']) {
    await fundPool(args, deployment);
    return;
  }

  if (args.claim) {
    await claimUbi(args, deployment);
    return;
  }

  if (args['show-pool']) {
    showPool(args, deployment);
    return;
  }

  if (args['my-claims']) {
    myClaims(args, deployment);
    return;
  }

  if (args.calculate) {
    calculateAmount(args, deployment);
    return;
  }

  if (args['close-cycle']) {
    await closeCycle(args, deployment);
    return;
  }

  if (args['current-cycle']) {
    currentCycleInfo(deployment);
    return;
  }

  showHelp();
}

main().catch(console.error);
