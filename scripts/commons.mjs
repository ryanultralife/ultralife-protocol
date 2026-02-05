#!/usr/bin/env node
/**
 * UltraLife Protocol — Commons CLI
 *
 * Manage shared community resources and commons governance.
 *
 * Usage:
 *   node commons.mjs --create --name "Community Garden" --type land
 *   node commons.mjs --add-steward --commons comm_123 --steward pnft_456
 *   node commons.mjs --list
 *   node commons.mjs --reserve --commons comm_123 --date 2026-03-01
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONSTANTS
// =============================================================================

const COMMONS_TYPES = {
  land: {
    name: 'Land Commons',
    description: 'Shared agricultural or natural land',
    governance: 'consensus',
  },
  water: {
    name: 'Water Commons',
    description: 'Shared water resources (wells, irrigation, etc.)',
    governance: 'rotation',
  },
  equipment: {
    name: 'Equipment Commons',
    description: 'Shared tools and machinery',
    governance: 'reservation',
  },
  seed: {
    name: 'Seed Commons',
    description: 'Community seed library',
    governance: 'exchange',
  },
  knowledge: {
    name: 'Knowledge Commons',
    description: 'Shared learning resources and expertise',
    governance: 'open',
  },
  facility: {
    name: 'Facility Commons',
    description: 'Shared buildings or spaces',
    governance: 'reservation',
  },
  forest: {
    name: 'Forest Commons',
    description: 'Community-managed forest resources',
    governance: 'quota',
  },
  grazing: {
    name: 'Grazing Commons',
    description: 'Shared pasture land',
    governance: 'rotation',
  },
};

// =============================================================================
// HELPERS
// =============================================================================

function loadDeployment() {
  const deploymentPath = path.join(__dirname, 'deployment.json');
  if (!fs.existsSync(deploymentPath)) {
    return { commons: { resources: [], reservations: [], contributions: [] } };
  }
  const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  if (!data.commons) data.commons = { resources: [], reservations: [], contributions: [] };
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
                    UltraLife Protocol — Commons Management
===============================================================================

Usage: node commons.mjs [command] [options]

COMMANDS:
  --create               Create a new commons resource
    --name <name>        Resource name
    --type <type>        Resource type (see below)
    --description <text> Description
    --capacity <n>       Capacity or quantity
    --land <id>          Associated land (optional)
    --user <name>        Create as test user

  --list                 List commons resources
    --type <type>        Filter by type
    --bioregion <id>     Filter by bioregion

  --show                 Show commons details
    --commons <id>       Commons ID

  --add-steward          Add a steward to commons
    --commons <id>       Commons ID
    --steward <pnft_id>  Steward pNFT ID

  --remove-steward       Remove a steward
    --commons <id>       Commons ID
    --steward <pnft_id>  Steward pNFT ID

  --reserve              Make a reservation
    --commons <id>       Commons ID
    --date <YYYY-MM-DD>  Reservation date
    --duration <hours>   Duration in hours (default: 4)
    --user <name>        Reserve as test user

  --cancel-reservation   Cancel a reservation
    --reservation <id>   Reservation ID

  --list-reservations    List reservations
    --commons <id>       Filter by commons
    --user <name>        Filter by user

  --contribute           Log a contribution to commons
    --commons <id>       Commons ID
    --type <type>        Contribution type (maintenance, improvement, donation)
    --description <text> Description
    --hours <n>          Hours contributed (optional)
    --user <name>        Contribute as test user

  --list-contributions   List contributions
    --commons <id>       Filter by commons
    --user <name>        Filter by user

  --set-rules            Set commons governance rules
    --commons <id>       Commons ID
    --rules <json>       Rules as JSON

  --my-commons           Show commons you steward
    --user <name>        Check for test user

  --stats                Show commons statistics
    --bioregion <id>     For specific bioregion

  --list-types           Show commons types

  --help                 Show this help

COMMONS TYPES:
${Object.entries(COMMONS_TYPES).map(([k, v]) => `  ${k.padEnd(12)} ${v.name.padEnd(20)} (${v.governance} governance)`).join('\n')}

GOVERNANCE MODELS:
  consensus   - Major decisions require agreement from all stewards
  rotation    - Access rotates among members on a schedule
  reservation - Members book time slots in advance
  exchange    - Members trade resources (take one, leave one)
  open        - Free access for all bioregion members
  quota       - Each member has an allocated share
`);
}

async function createCommons(args, deployment) {
  const name = args.name;
  const type = args.type;
  const description = args.description || '';
  const capacity = parseFloat(args.capacity) || 1;
  const landId = args.land;
  const userName = args.user;

  if (!name || !type) {
    console.error('Error: --name and --type are required');
    return;
  }

  const commonsType = COMMONS_TYPES[type];
  if (!commonsType) {
    console.error(`Error: Unknown type "${type}". Use --list-types to see options.`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const commons = {
    commonsId: generateId('comm'),
    name,
    type,
    typeName: commonsType.name,
    description,
    capacity,
    landId: landId || null,
    bioregion: pnft.bioregion,
    founder: pnft.id,
    founderAddress: pnft.address,
    stewards: [{
      pnftId: pnft.id,
      address: pnft.address,
      role: 'founder',
      joinedAt: new Date().toISOString(),
    }],
    governance: {
      model: commonsType.governance,
      rules: {},
      votingThreshold: 51,
    },
    usage: {
      totalReservations: 0,
      totalHoursUsed: 0,
      totalContributions: 0,
    },
    status: 'active',
    createdAt: new Date().toISOString(),
    testnetSimulated: true,
  };

  deployment.commons.resources.push(commons);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         COMMONS CREATED
===============================================================================
  Commons ID:    ${commons.commonsId}
  Name:          ${name}
  Type:          ${commonsType.name}
  Capacity:      ${capacity}
  Bioregion:     ${pnft.bioregion}
  Founder:       ${pnft.owner}
-------------------------------------------------------------------------------
  Governance:    ${commonsType.governance}
  ${description ? `Description:   ${description}` : ''}
  ${landId ? `Land:          ${landId}` : ''}
-------------------------------------------------------------------------------

Add stewards: npm run commons:steward -- --commons ${commons.commonsId} --steward <pnft_id>
`);
}

function listCommons(args, deployment) {
  const type = args.type;
  const bioregion = args.bioregion;

  let resources = deployment.commons.resources || [];

  if (type) {
    resources = resources.filter(r => r.type === type);
  }

  if (bioregion) {
    resources = resources.filter(r => r.bioregion === bioregion);
  }

  console.log(`
===============================================================================
                    COMMONS RESOURCES
===============================================================================`);

  if (resources.length === 0) {
    console.log('\n  No commons resources found.\n');
    return;
  }

  console.log('\n  ID                    NAME                    TYPE            STEWARDS  STATUS');
  console.log('  --------------------  ----------------------  --------------  --------  ------');

  for (const r of resources) {
    console.log(`  ${r.commonsId.padEnd(20)}  ${r.name.slice(0, 22).padEnd(22)}  ${r.typeName.slice(0, 14).padEnd(14)}  ${String(r.stewards.length).padStart(8)}  ${r.status}`);
  }

  console.log(`\n  Total: ${resources.length} commons resources\n`);
}

function showCommons(args, deployment) {
  const commonsId = args.commons;

  if (!commonsId) {
    console.error('Error: --commons is required');
    return;
  }

  const commons = deployment.commons.resources.find(r => r.commonsId === commonsId);
  if (!commons) {
    console.error(`Error: Commons ${commonsId} not found`);
    return;
  }

  const reservations = deployment.commons.reservations.filter(r =>
    r.commonsId === commonsId && new Date(r.date) >= new Date()
  );

  console.log(`
===============================================================================
                    ${commons.name}
===============================================================================
  Commons ID:    ${commons.commonsId}
  Type:          ${commons.typeName}
  Status:        ${commons.status.toUpperCase()}
  Bioregion:     ${commons.bioregion}
  Capacity:      ${commons.capacity}
  ${commons.description ? `Description:   ${commons.description}` : ''}
  ${commons.landId ? `Land:          ${commons.landId}` : ''}
-------------------------------------------------------------------------------
  GOVERNANCE:
    Model:       ${commons.governance.model}
    Threshold:   ${commons.governance.votingThreshold}%
-------------------------------------------------------------------------------
  USAGE STATISTICS:
    Reservations: ${commons.usage.totalReservations}
    Hours used:   ${commons.usage.totalHoursUsed}
    Contributions: ${commons.usage.totalContributions}
-------------------------------------------------------------------------------
  STEWARDS (${commons.stewards.length}):
`);

  for (const steward of commons.stewards) {
    console.log(`    - ${steward.pnftId} [${steward.role}]`);
  }

  console.log(`
-------------------------------------------------------------------------------
  UPCOMING RESERVATIONS (${reservations.length}):
`);

  if (reservations.length === 0) {
    console.log('    (No upcoming reservations)\n');
  } else {
    for (const res of reservations.slice(0, 5)) {
      console.log(`    - ${res.date}: ${res.reservedBy} (${res.duration}h)`);
    }
    if (reservations.length > 5) {
      console.log(`    ... and ${reservations.length - 5} more`);
    }
    console.log('');
  }
}

async function addSteward(args, deployment) {
  const commonsId = args.commons;
  const stewardId = args.steward;

  if (!commonsId || !stewardId) {
    console.error('Error: --commons and --steward are required');
    return;
  }

  const commons = deployment.commons.resources.find(r => r.commonsId === commonsId);
  if (!commons) {
    console.error(`Error: Commons ${commonsId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  // Check if caller is a steward
  const isFounder = commons.founder === pnft.id;
  const isSteward = commons.stewards.some(s => s.pnftId === pnft.id);

  if (!isFounder && !isSteward) {
    console.error('Error: Only stewards can add new stewards');
    return;
  }

  // Check if already a steward
  if (commons.stewards.some(s => s.pnftId === stewardId)) {
    console.error('Error: Already a steward');
    return;
  }

  // Find the steward's address
  const targetPnft = deployment.pnfts?.find(p => p.id === stewardId);
  const address = targetPnft?.owner || 'unknown';

  commons.stewards.push({
    pnftId: stewardId,
    address,
    role: 'steward',
    addedBy: pnft.id,
    joinedAt: new Date().toISOString(),
  });

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         STEWARD ADDED
===============================================================================
  Commons:       ${commons.name}
  New Steward:   ${stewardId}
  Added by:      ${pnft.owner}
  Total stewards: ${commons.stewards.length}
`);
}

async function removeSteward(args, deployment) {
  const commonsId = args.commons;
  const stewardId = args.steward;

  if (!commonsId || !stewardId) {
    console.error('Error: --commons and --steward are required');
    return;
  }

  const commons = deployment.commons.resources.find(r => r.commonsId === commonsId);
  if (!commons) {
    console.error(`Error: Commons ${commonsId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  if (commons.founder !== pnft.id) {
    console.error('Error: Only founder can remove stewards');
    return;
  }

  if (stewardId === commons.founder) {
    console.error('Error: Cannot remove founder');
    return;
  }

  const stewardIndex = commons.stewards.findIndex(s => s.pnftId === stewardId);
  if (stewardIndex === -1) {
    console.error('Error: Not a steward');
    return;
  }

  commons.stewards.splice(stewardIndex, 1);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         STEWARD REMOVED
===============================================================================
  Commons:       ${commons.name}
  Removed:       ${stewardId}
  Total stewards: ${commons.stewards.length}
`);
}

async function makeReservation(args, deployment) {
  const commonsId = args.commons;
  const date = args.date;
  const duration = parseFloat(args.duration) || 4;
  const userName = args.user;

  if (!commonsId || !date) {
    console.error('Error: --commons and --date are required');
    return;
  }

  const commons = deployment.commons.resources.find(r => r.commonsId === commonsId);
  if (!commons) {
    console.error(`Error: Commons ${commonsId} not found`);
    return;
  }

  if (commons.governance.model !== 'reservation' && commons.governance.model !== 'rotation') {
    console.error(`Error: This commons uses ${commons.governance.model} governance, not reservations`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  // Check if bioregion member
  if (pnft.bioregion !== commons.bioregion) {
    console.error('Error: Must be a member of the same bioregion');
    return;
  }

  // Check for conflicting reservations
  const reservationDate = new Date(date).toISOString().split('T')[0];
  const conflict = deployment.commons.reservations.find(r =>
    r.commonsId === commonsId &&
    r.date === reservationDate &&
    r.status === 'active'
  );

  if (conflict) {
    console.error(`Error: Already reserved on ${reservationDate} by ${conflict.reservedBy}`);
    return;
  }

  const reservation = {
    reservationId: generateId('res'),
    commonsId,
    commonsName: commons.name,
    date: reservationDate,
    duration,
    reservedBy: pnft.id,
    reservedByAddress: pnft.address,
    status: 'active',
    createdAt: new Date().toISOString(),
    testnetSimulated: true,
  };

  commons.usage.totalReservations++;
  commons.usage.totalHoursUsed += duration;

  deployment.commons.reservations.push(reservation);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         RESERVATION CREATED
===============================================================================
  Reservation ID: ${reservation.reservationId}
  Commons:        ${commons.name}
  Date:           ${reservationDate}
  Duration:       ${duration} hours
  Reserved by:    ${pnft.owner}
`);
}

async function cancelReservation(args, deployment) {
  const reservationId = args.reservation;

  if (!reservationId) {
    console.error('Error: --reservation is required');
    return;
  }

  const reservation = deployment.commons.reservations.find(r => r.reservationId === reservationId);
  if (!reservation) {
    console.error(`Error: Reservation ${reservationId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment);
  if (!pnft || reservation.reservedBy !== pnft.id) {
    console.error('Error: Only the reserver can cancel');
    return;
  }

  reservation.status = 'cancelled';
  reservation.cancelledAt = new Date().toISOString();

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         RESERVATION CANCELLED
===============================================================================
  Reservation ID: ${reservationId}
  Date:           ${reservation.date}
`);
}

function listReservations(args, deployment) {
  const commonsId = args.commons;
  const userName = args.user;

  let reservations = deployment.commons.reservations || [];

  if (commonsId) {
    reservations = reservations.filter(r => r.commonsId === commonsId);
  }

  if (userName) {
    const pnft = getUserPnft(deployment, userName);
    if (pnft) {
      reservations = reservations.filter(r => r.reservedBy === pnft.id);
    }
  }

  // Only show future and active
  reservations = reservations.filter(r =>
    r.status === 'active' && new Date(r.date) >= new Date(new Date().toISOString().split('T')[0])
  );

  console.log(`
===============================================================================
                    RESERVATIONS
===============================================================================`);

  if (reservations.length === 0) {
    console.log('\n  No upcoming reservations found.\n');
    return;
  }

  console.log('\n  ID                    COMMONS                 DATE        HOURS   RESERVED BY');
  console.log('  --------------------  ----------------------  ----------  ------  -----------');

  for (const r of reservations.sort((a, b) => a.date.localeCompare(b.date))) {
    console.log(`  ${r.reservationId.padEnd(20)}  ${r.commonsName.slice(0, 22).padEnd(22)}  ${r.date}  ${String(r.duration).padStart(6)}  ${r.reservedBy.slice(0, 11)}`);
  }

  console.log(`\n  Total: ${reservations.length} upcoming reservations\n`);
}

async function contribute(args, deployment) {
  const commonsId = args.commons;
  const type = args.type || 'maintenance';
  const description = args.description || '';
  const hours = parseFloat(args.hours) || 0;
  const userName = args.user;

  if (!commonsId) {
    console.error('Error: --commons is required');
    return;
  }

  const commons = deployment.commons.resources.find(r => r.commonsId === commonsId);
  if (!commons) {
    console.error(`Error: Commons ${commonsId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const contribution = {
    contributionId: generateId('contrib'),
    commonsId,
    commonsName: commons.name,
    type,
    description,
    hours,
    contributor: pnft.id,
    contributorAddress: pnft.address,
    createdAt: new Date().toISOString(),
    testnetSimulated: true,
  };

  commons.usage.totalContributions++;

  deployment.commons.contributions.push(contribution);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         CONTRIBUTION LOGGED
===============================================================================
  Contribution ID: ${contribution.contributionId}
  Commons:         ${commons.name}
  Type:            ${type}
  Hours:           ${hours || 'N/A'}
  Contributor:     ${pnft.owner}
  ${description ? `Description:     ${description}` : ''}
`);
}

function listContributions(args, deployment) {
  const commonsId = args.commons;
  const userName = args.user;

  let contributions = deployment.commons.contributions || [];

  if (commonsId) {
    contributions = contributions.filter(c => c.commonsId === commonsId);
  }

  if (userName) {
    const pnft = getUserPnft(deployment, userName);
    if (pnft) {
      contributions = contributions.filter(c => c.contributor === pnft.id);
    }
  }

  console.log(`
===============================================================================
                    CONTRIBUTIONS
===============================================================================`);

  if (contributions.length === 0) {
    console.log('\n  No contributions found.\n');
    return;
  }

  console.log('\n  ID                    COMMONS                 TYPE          HOURS   DATE');
  console.log('  --------------------  ----------------------  ------------  ------  ----------');

  for (const c of contributions.slice(-20)) {
    console.log(`  ${c.contributionId.padEnd(20)}  ${c.commonsName.slice(0, 22).padEnd(22)}  ${c.type.padEnd(12)}  ${String(c.hours || 0).padStart(6)}  ${c.createdAt.split('T')[0]}`);
  }

  const totalHours = contributions.reduce((sum, c) => sum + (c.hours || 0), 0);
  console.log(`\n  Total: ${contributions.length} contributions (${totalHours} hours)\n`);
}

async function setRules(args, deployment) {
  const commonsId = args.commons;
  const rulesStr = args.rules;

  if (!commonsId || !rulesStr) {
    console.error('Error: --commons and --rules are required');
    return;
  }

  const commons = deployment.commons.resources.find(r => r.commonsId === commonsId);
  if (!commons) {
    console.error(`Error: Commons ${commonsId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment);
  if (!pnft || commons.founder !== pnft.id) {
    console.error('Error: Only founder can set rules');
    return;
  }

  let rules;
  try {
    rules = JSON.parse(rulesStr);
  } catch (e) {
    console.error('Error: Invalid JSON in --rules');
    return;
  }

  commons.governance.rules = { ...commons.governance.rules, ...rules };
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         RULES UPDATED
===============================================================================
  Commons:       ${commons.name}
  New rules:
${JSON.stringify(commons.governance.rules, null, 2).split('\n').map(l => '    ' + l).join('\n')}
`);
}

function myCommons(args, deployment) {
  const userName = args.user;
  const pnft = getUserPnft(deployment, userName);

  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const myResources = (deployment.commons.resources || []).filter(r =>
    r.stewards.some(s => s.pnftId === pnft.id)
  );

  console.log(`
===============================================================================
                    My Commons — ${pnft.owner}
===============================================================================`);

  if (myResources.length === 0) {
    console.log('\n  Not a steward of any commons resources.\n');
    return;
  }

  for (const r of myResources) {
    const role = r.stewards.find(s => s.pnftId === pnft.id)?.role || 'steward';
    console.log(`
  ${r.name}
    ID:        ${r.commonsId}
    Type:      ${r.typeName}
    Role:      ${role}
    Stewards:  ${r.stewards.length}`);
  }

  console.log('');
}

function showStats(args, deployment) {
  const bioregion = args.bioregion;

  let resources = deployment.commons.resources || [];
  let reservations = deployment.commons.reservations || [];
  let contributions = deployment.commons.contributions || [];

  if (bioregion) {
    resources = resources.filter(r => r.bioregion === bioregion);
    const resourceIds = new Set(resources.map(r => r.commonsId));
    reservations = reservations.filter(r => resourceIds.has(r.commonsId));
    contributions = contributions.filter(c => resourceIds.has(c.commonsId));
  }

  const totalStewards = resources.reduce((sum, r) => sum + r.stewards.length, 0);
  const totalHoursUsed = resources.reduce((sum, r) => sum + r.usage.totalHoursUsed, 0);
  const totalContribHours = contributions.reduce((sum, c) => sum + (c.hours || 0), 0);

  const byType = {};
  for (const r of resources) {
    byType[r.type] = byType[r.type] || { count: 0, stewards: 0 };
    byType[r.type].count++;
    byType[r.type].stewards += r.stewards.length;
  }

  console.log(`
===============================================================================
                    COMMONS STATISTICS
                    ${bioregion ? `Bioregion: ${bioregion}` : 'All Bioregions'}
===============================================================================
  RESOURCES:       ${resources.length}
  TOTAL STEWARDS:  ${totalStewards}
  RESERVATIONS:    ${reservations.filter(r => r.status === 'active').length} active
  CONTRIBUTIONS:   ${contributions.length}
-------------------------------------------------------------------------------
  USAGE:
    Total hours used:     ${totalHoursUsed.toLocaleString()}
    Contribution hours:   ${totalContribHours.toLocaleString()}
-------------------------------------------------------------------------------
  BY TYPE:
`);

  for (const [type, data] of Object.entries(byType)) {
    const typeName = COMMONS_TYPES[type]?.name || type;
    console.log(`    ${typeName.padEnd(20)} ${String(data.count).padStart(3)} resources, ${String(data.stewards).padStart(4)} stewards`);
  }

  console.log('');
}

function listTypes() {
  console.log(`
===============================================================================
                    COMMONS TYPES
===============================================================================
`);

  for (const [key, type] of Object.entries(COMMONS_TYPES)) {
    console.log(`  ${key.padEnd(12)} ${type.name}`);
    console.log(`               ${type.description}`);
    console.log(`               Governance: ${type.governance}`);
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

  if (args.create) {
    await createCommons(args, deployment);
    return;
  }

  if (args.list) {
    listCommons(args, deployment);
    return;
  }

  if (args.show) {
    showCommons(args, deployment);
    return;
  }

  if (args['add-steward']) {
    await addSteward(args, deployment);
    return;
  }

  if (args['remove-steward']) {
    await removeSteward(args, deployment);
    return;
  }

  if (args.reserve) {
    await makeReservation(args, deployment);
    return;
  }

  if (args['cancel-reservation']) {
    await cancelReservation(args, deployment);
    return;
  }

  if (args['list-reservations']) {
    listReservations(args, deployment);
    return;
  }

  if (args.contribute) {
    await contribute(args, deployment);
    return;
  }

  if (args['list-contributions']) {
    listContributions(args, deployment);
    return;
  }

  if (args['set-rules']) {
    await setRules(args, deployment);
    return;
  }

  if (args['my-commons']) {
    myCommons(args, deployment);
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
