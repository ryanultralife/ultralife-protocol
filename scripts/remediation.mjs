#!/usr/bin/env node
/**
 * UltraLife Protocol — Environmental Remediation CLI
 *
 * Track and manage environmental remediation projects.
 *
 * Usage:
 *   node remediation.mjs --create-project --name "Creek Restoration" --type water
 *   node remediation.mjs --log-activity --project proj_123 --type planting
 *   node remediation.mjs --generate-credits --project proj_123
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONSTANTS
// =============================================================================

const REMEDIATION_TYPES = {
  water: {
    name: 'Water Quality Restoration',
    activities: ['filtration', 'wetland_creation', 'pollution_cleanup', 'stream_restoration'],
    creditBase: 50,
  },
  soil: {
    name: 'Soil Remediation',
    activities: ['contamination_removal', 'composting', 'biochar', 'cover_cropping'],
    creditBase: 40,
  },
  habitat: {
    name: 'Habitat Restoration',
    activities: ['native_planting', 'invasive_removal', 'corridor_creation', 'nest_boxes'],
    creditBase: 35,
  },
  air: {
    name: 'Air Quality Improvement',
    activities: ['tree_planting', 'pollution_reduction', 'green_infrastructure'],
    creditBase: 30,
  },
  waste: {
    name: 'Waste Remediation',
    activities: ['cleanup', 'recycling_infrastructure', 'composting_system', 'landfill_capping'],
    creditBase: 25,
  },
  erosion: {
    name: 'Erosion Control',
    activities: ['terracing', 'riparian_buffers', 'check_dams', 'ground_cover'],
    creditBase: 30,
  },
  mine: {
    name: 'Mine Reclamation',
    activities: ['tailings_stabilization', 'pit_filling', 'revegetation', 'water_treatment'],
    creditBase: 60,
  },
};

const ACTIVITY_CREDITS = {
  filtration: 10,
  wetland_creation: 50,
  pollution_cleanup: 40,
  stream_restoration: 60,
  contamination_removal: 80,
  composting: 15,
  biochar: 20,
  cover_cropping: 10,
  native_planting: 25,
  invasive_removal: 20,
  corridor_creation: 40,
  nest_boxes: 5,
  tree_planting: 30,
  pollution_reduction: 35,
  green_infrastructure: 45,
  cleanup: 20,
  recycling_infrastructure: 25,
  composting_system: 30,
  landfill_capping: 50,
  terracing: 25,
  riparian_buffers: 35,
  check_dams: 20,
  ground_cover: 15,
  tailings_stabilization: 70,
  pit_filling: 60,
  revegetation: 40,
  water_treatment: 55,
};

// =============================================================================
// HELPERS
// =============================================================================

function loadDeployment() {
  const deploymentPath = path.join(__dirname, 'deployment.json');
  if (!fs.existsSync(deploymentPath)) {
    return { remediation: { projects: [], activities: [], credits: [] } };
  }
  const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  if (!data.remediation) data.remediation = { projects: [], activities: [], credits: [] };
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
                    UltraLife Protocol — Environmental Remediation
===============================================================================

Usage: node remediation.mjs [command] [options]

COMMANDS:
  --create-project       Create a remediation project
    --name <name>        Project name
    --type <type>        Remediation type (see below)
    --description <text> Description
    --land <id>          Associated land (optional)
    --user <name>        Create as test user

  --list-projects        List remediation projects
    --type <type>        Filter by type
    --bioregion <id>     Filter by bioregion
    --user <name>        Filter by owner

  --show-project         Show project details
    --project <id>       Project ID

  --log-activity         Log remediation activity
    --project <id>       Project ID
    --type <type>        Activity type
    --hours <n>          Hours worked
    --notes <text>       Activity notes

  --verify-activity      Verify an activity (by another user)
    --activity <id>      Activity ID
    --user <name>        Verify as test user

  --generate-credits     Generate remediation credits
    --project <id>       Project ID

  --list-credits         List remediation credits
    --user <name>        Filter by owner

  --transfer-credits     Transfer credits
    --credit <id>        Credit ID
    --to <address>       Recipient address
    --amount <n>         Amount to transfer

  --retire-credits       Retire credits (permanent offset)
    --credit <id>        Credit ID
    --amount <n>         Amount to retire
    --reason <text>      Reason for retirement

  --stats                Show remediation statistics
    --bioregion <id>     For specific bioregion

  --list-types           Show remediation types
  --list-activities      Show activity types for a remediation type
    --type <type>        Remediation type

  --help                 Show this help

REMEDIATION TYPES:
${Object.entries(REMEDIATION_TYPES).map(([k, v]) => `  ${k.padEnd(10)} ${v.name.padEnd(30)} (base: ${v.creditBase} credits)`).join('\n')}
`);
}

async function createProject(args, deployment) {
  const name = args.name;
  const type = args.type;
  const description = args.description || '';
  const landId = args.land;
  const userName = args.user;

  if (!name || !type) {
    console.error('Error: --name and --type are required');
    return;
  }

  const remType = REMEDIATION_TYPES[type];
  if (!remType) {
    console.error(`Error: Unknown type "${type}". Use --list-types to see options.`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const project = {
    projectId: generateId('remproj'),
    name,
    type,
    typeName: remType.name,
    description,
    landId: landId || null,
    owner: pnft.id,
    ownerAddress: pnft.address,
    bioregion: pnft.bioregion,
    activities: [],
    totalHours: 0,
    totalCredits: 0,
    creditsGenerated: 0,
    participants: [pnft.id],
    status: 'active',
    createdAt: new Date().toISOString(),
    testnetSimulated: true,
  };

  deployment.remediation.projects.push(project);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         REMEDIATION PROJECT CREATED
===============================================================================
  Project ID:    ${project.projectId}
  Name:          ${name}
  Type:          ${remType.name}
  Owner:         ${pnft.owner}
  Bioregion:     ${pnft.bioregion}
  ${landId ? `Land:          ${landId}` : ''}
-------------------------------------------------------------------------------
  Available activities:
${remType.activities.map(a => `    - ${a.replace(/_/g, ' ')} (${ACTIVITY_CREDITS[a] || 10} credits)`).join('\n')}
-------------------------------------------------------------------------------

Log activity with: npm run remediation:log -- --project ${project.projectId} --type <activity>
`);
}

function listProjects(args, deployment) {
  const type = args.type;
  const bioregion = args.bioregion;
  const userName = args.user;

  let projects = deployment.remediation.projects || [];

  if (type) {
    projects = projects.filter(p => p.type === type);
  }

  if (bioregion) {
    projects = projects.filter(p => p.bioregion === bioregion);
  }

  if (userName) {
    const pnft = getUserPnft(deployment, userName);
    if (pnft) {
      projects = projects.filter(p => p.owner === pnft.id || p.participants.includes(pnft.id));
    }
  }

  console.log(`
===============================================================================
                    REMEDIATION PROJECTS
===============================================================================`);

  if (projects.length === 0) {
    console.log('\n  No projects found.\n');
    return;
  }

  console.log('\n  ID                    NAME                    TYPE                  HOURS   CREDITS');
  console.log('  --------------------  ----------------------  --------------------  ------  -------');

  for (const p of projects) {
    console.log(`  ${p.projectId.padEnd(20)}  ${p.name.slice(0, 22).padEnd(22)}  ${p.typeName.slice(0, 20).padEnd(20)}  ${String(p.totalHours).padStart(6)}  ${String(p.totalCredits).padStart(7)}`);
  }

  const totalHours = projects.reduce((sum, p) => sum + p.totalHours, 0);
  const totalCredits = projects.reduce((sum, p) => sum + p.totalCredits, 0);

  console.log(`
-------------------------------------------------------------------------------
  Total: ${projects.length} projects
  Hours: ${totalHours.toLocaleString()}
  Credits: ${totalCredits.toLocaleString()}
`);
}

function showProject(args, deployment) {
  const projectId = args.project;

  if (!projectId) {
    console.error('Error: --project is required');
    return;
  }

  const project = deployment.remediation.projects.find(p => p.projectId === projectId);
  if (!project) {
    console.error(`Error: Project ${projectId} not found`);
    return;
  }

  const activities = deployment.remediation.activities.filter(a => a.projectId === projectId);
  const recentActivities = activities.slice(-5);

  console.log(`
===============================================================================
                    ${project.name}
===============================================================================
  Project ID:    ${project.projectId}
  Type:          ${project.typeName}
  Status:        ${project.status.toUpperCase()}
  Owner:         ${project.owner}
  Bioregion:     ${project.bioregion}
  ${project.landId ? `Land:          ${project.landId}` : ''}
-------------------------------------------------------------------------------
  PROGRESS:
    Total Hours:     ${project.totalHours}
    Total Credits:   ${project.totalCredits}
    Generated:       ${project.creditsGenerated}
    Participants:    ${project.participants.length}
-------------------------------------------------------------------------------
  RECENT ACTIVITIES (${recentActivities.length}/${activities.length}):
`);

  if (recentActivities.length === 0) {
    console.log('    (No activities logged yet)\n');
  } else {
    for (const act of recentActivities) {
      const verified = act.verified ? '[VERIFIED]' : '[pending]';
      console.log(`    - ${new Date(act.loggedAt).toLocaleDateString()}: ${act.activityType.replace(/_/g, ' ')} (${act.hours}h, ${act.credits} credits) ${verified}`);
    }
    console.log('');
  }
}

async function logActivity(args, deployment) {
  const projectId = args.project;
  const activityType = args.type;
  const hours = parseFloat(args.hours) || 1;
  const notes = args.notes || '';

  if (!projectId || !activityType) {
    console.error('Error: --project and --type are required');
    return;
  }

  const project = deployment.remediation.projects.find(p => p.projectId === projectId);
  if (!project) {
    console.error(`Error: Project ${projectId} not found`);
    return;
  }

  const remType = REMEDIATION_TYPES[project.type];
  if (!remType.activities.includes(activityType)) {
    console.error(`Error: Activity "${activityType}" not valid for ${remType.name}`);
    console.error(`Valid activities: ${remType.activities.join(', ')}`);
    return;
  }

  const pnft = getUserPnft(deployment);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const baseCredits = ACTIVITY_CREDITS[activityType] || 10;
  const credits = Math.round(baseCredits * hours);

  const activity = {
    activityId: generateId('remact'),
    projectId,
    activityType,
    hours,
    credits,
    worker: pnft.id,
    workerAddress: pnft.address,
    notes,
    verified: false,
    verifications: [],
    loggedAt: new Date().toISOString(),
    testnetSimulated: true,
  };

  project.totalHours += hours;
  project.totalCredits += credits;

  if (!project.participants.includes(pnft.id)) {
    project.participants.push(pnft.id);
  }

  deployment.remediation.activities.push(activity);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         ACTIVITY LOGGED
===============================================================================
  Activity ID:   ${activity.activityId}
  Project:       ${project.name}
  Type:          ${activityType.replace(/_/g, ' ')}
-------------------------------------------------------------------------------
  Hours:         ${hours}
  Credits:       ${credits}
  Worker:        ${pnft.owner}
  ${notes ? `Notes:         ${notes}` : ''}
-------------------------------------------------------------------------------
  Status: Pending verification

Request verification from another participant.
`);
}

async function verifyActivity(args, deployment) {
  const activityId = args.activity;
  const userName = args.user;

  if (!activityId) {
    console.error('Error: --activity is required');
    return;
  }

  const activity = deployment.remediation.activities.find(a => a.activityId === activityId);
  if (!activity) {
    console.error(`Error: Activity ${activityId} not found`);
    return;
  }

  if (activity.verified) {
    console.error('Error: Activity already verified');
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  if (activity.worker === pnft.id) {
    console.error('Error: Cannot verify your own activity');
    return;
  }

  const project = deployment.remediation.projects.find(p => p.projectId === activity.projectId);
  if (project && !project.participants.includes(pnft.id)) {
    // Auto-add as participant when verifying
    project.participants.push(pnft.id);
  }

  activity.verifications.push({
    verifier: pnft.id,
    verifiedAt: new Date().toISOString(),
  });

  // Require 1 verification for now
  if (activity.verifications.length >= 1) {
    activity.verified = true;
  }

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         ACTIVITY VERIFIED
===============================================================================
  Activity ID:   ${activityId}
  Verifier:      ${pnft.owner}
  Status:        ${activity.verified ? 'VERIFIED' : `Pending (${activity.verifications.length}/1)`}
`);
}

async function generateCredits(args, deployment) {
  const projectId = args.project;

  if (!projectId) {
    console.error('Error: --project is required');
    return;
  }

  const project = deployment.remediation.projects.find(p => p.projectId === projectId);
  if (!project) {
    console.error(`Error: Project ${projectId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment);
  if (!pnft || project.owner !== pnft.id) {
    console.error('Error: Only project owner can generate credits');
    return;
  }

  // Calculate verified credits not yet generated
  const activities = deployment.remediation.activities.filter(a =>
    a.projectId === projectId && a.verified
  );

  const totalVerifiedCredits = activities.reduce((sum, a) => sum + a.credits, 0);
  const newCredits = totalVerifiedCredits - project.creditsGenerated;

  if (newCredits <= 0) {
    console.log('\nNo new verified credits to generate.\n');
    return;
  }

  const credit = {
    creditId: generateId('remcred'),
    projectId,
    projectName: project.name,
    type: project.type,
    owner: pnft.id,
    ownerAddress: pnft.address,
    bioregion: project.bioregion,
    amount: newCredits,
    generatedAt: new Date().toISOString(),
    status: 'active',
    testnetSimulated: true,
  };

  project.creditsGenerated = totalVerifiedCredits;
  deployment.remediation.credits.push(credit);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         REMEDIATION CREDITS GENERATED
===============================================================================
  Credit ID:     ${credit.creditId}
  Project:       ${project.name}
  Type:          ${project.typeName}
-------------------------------------------------------------------------------
  Amount:        ${newCredits.toLocaleString()} credits
  Total gen:     ${project.creditsGenerated.toLocaleString()} credits
`);
}

function listCredits(args, deployment) {
  const userName = args.user;

  let credits = deployment.remediation.credits || [];

  if (userName) {
    const pnft = getUserPnft(deployment, userName);
    if (pnft) {
      credits = credits.filter(c => c.owner === pnft.id);
    }
  }

  console.log(`
===============================================================================
                    REMEDIATION CREDITS
===============================================================================`);

  if (credits.length === 0) {
    console.log('\n  No credits found.\n');
    return;
  }

  console.log('\n  ID                    PROJECT                 TYPE          AMOUNT   STATUS');
  console.log('  --------------------  ----------------------  ------------  -------  ------');

  for (const c of credits) {
    console.log(`  ${c.creditId.padEnd(20)}  ${c.projectName.slice(0, 22).padEnd(22)}  ${c.type.padEnd(12)}  ${String(c.amount).padStart(7)}  ${c.status}`);
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

  const credit = deployment.remediation.credits.find(c => c.creditId === creditId);
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
    creditId: generateId('remcred'),
    amount,
    previousOwner: credit.ownerAddress,
    ownerAddress: toAddress,
    transferredAt: new Date().toISOString(),
  };

  credit.amount -= amount;
  deployment.remediation.credits.push(newCredit);

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         CREDITS TRANSFERRED
===============================================================================
  Amount:        ${amount.toLocaleString()} credits
  To:            ${toAddress.slice(0, 20)}...
`);
}

async function retireCredits(args, deployment) {
  const creditId = args.credit;
  const amount = parseInt(args.amount);
  const reason = args.reason || 'Environmental offset';

  if (!creditId || !amount) {
    console.error('Error: --credit and --amount are required');
    return;
  }

  const credit = deployment.remediation.credits.find(c => c.creditId === creditId);
  if (!credit) {
    console.error(`Error: Credit ${creditId} not found`);
    return;
  }

  if (credit.amount < amount) {
    console.error(`Error: Insufficient credits (${credit.amount} < ${amount})`);
    return;
  }

  credit.amount -= amount;

  if (!deployment.remediation.retirements) deployment.remediation.retirements = [];
  deployment.remediation.retirements.push({
    retirementId: generateId('retire'),
    creditId,
    amount,
    reason,
    retiredAt: new Date().toISOString(),
  });

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         CREDITS RETIRED
===============================================================================
  Amount:        ${amount.toLocaleString()} credits
  Reason:        ${reason}
`);
}

function showStats(args, deployment) {
  const bioregion = args.bioregion;

  let projects = deployment.remediation.projects || [];
  let credits = deployment.remediation.credits || [];

  if (bioregion) {
    projects = projects.filter(p => p.bioregion === bioregion);
    credits = credits.filter(c => c.bioregion === bioregion);
  }

  const totalHours = projects.reduce((sum, p) => sum + p.totalHours, 0);
  const totalCredits = credits.reduce((sum, c) => sum + c.amount, 0);

  const byType = {};
  for (const p of projects) {
    byType[p.type] = byType[p.type] || { count: 0, hours: 0, credits: 0 };
    byType[p.type].count++;
    byType[p.type].hours += p.totalHours;
    byType[p.type].credits += p.totalCredits;
  }

  console.log(`
===============================================================================
                    REMEDIATION STATISTICS
                    ${bioregion ? `Bioregion: ${bioregion}` : 'All Bioregions'}
===============================================================================
  PROJECTS:      ${projects.length}
  TOTAL HOURS:   ${totalHours.toLocaleString()}
  TOTAL CREDITS: ${totalCredits.toLocaleString()}
-------------------------------------------------------------------------------
  BY TYPE:
`);

  for (const [type, data] of Object.entries(byType)) {
    const typeName = REMEDIATION_TYPES[type]?.name || type;
    console.log(`    ${typeName.padEnd(25)} ${String(data.count).padStart(3)} projects, ${String(data.hours).padStart(6)} hours, ${String(data.credits).padStart(8)} credits`);
  }

  console.log('');
}

function listTypes() {
  console.log(`
===============================================================================
                    REMEDIATION TYPES
===============================================================================
`);

  for (const [key, type] of Object.entries(REMEDIATION_TYPES)) {
    console.log(`  ${key.padEnd(10)} ${type.name}`);
    console.log(`             Base credits: ${type.creditBase}`);
    console.log(`             Activities: ${type.activities.join(', ')}`);
    console.log('');
  }
}

function listActivities(args) {
  const type = args.type;

  if (!type) {
    console.error('Error: --type is required');
    return;
  }

  const remType = REMEDIATION_TYPES[type];
  if (!remType) {
    console.error(`Error: Unknown type "${type}". Use --list-types to see options.`);
    return;
  }

  console.log(`
===============================================================================
                    ACTIVITIES FOR ${remType.name.toUpperCase()}
===============================================================================
`);

  for (const activity of remType.activities) {
    const credits = ACTIVITY_CREDITS[activity] || 10;
    console.log(`  ${activity.replace(/_/g, ' ').padEnd(25)} ${credits} credits per hour`);
  }

  console.log('');
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

  if (args['create-project']) {
    await createProject(args, deployment);
    return;
  }

  if (args['list-projects']) {
    listProjects(args, deployment);
    return;
  }

  if (args['show-project']) {
    showProject(args, deployment);
    return;
  }

  if (args['log-activity']) {
    await logActivity(args, deployment);
    return;
  }

  if (args['verify-activity']) {
    await verifyActivity(args, deployment);
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

  if (args['list-activities']) {
    listActivities(args);
    return;
  }

  showHelp();
}

main().catch(console.error);
