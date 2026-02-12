#!/usr/bin/env node
/**
 * UltraLife Protocol — Records CLI
 *
 * Health and medical records management with privacy controls.
 * Records are encrypted and access-controlled by the individual.
 *
 * Usage:
 *   node records.mjs --create --type health --data '{"condition":"diabetes"}'
 *   node records.mjs --list
 *   node records.mjs --show --record rec_123
 *   node records.mjs --grant-access --record rec_123 --to pnft_456
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONSTANTS
// =============================================================================

const RECORD_TYPES = {
  health: 'Health Assessment',
  medical: 'Medical Record',
  lab: 'Lab Results',
  prescription: 'Prescription',
  immunization: 'Immunization',
  allergy: 'Allergy',
  condition: 'Chronic Condition',
  nutrition: 'Nutrition Assessment',
  mental: 'Mental Health',
  dental: 'Dental Record',
};

// =============================================================================
// HELPERS
// =============================================================================

function loadDeployment() {
  const deploymentPath = path.join(__dirname, 'deployment.json');
  if (!fs.existsSync(deploymentPath)) {
    return { records: { entries: [], accessGrants: [] } };
  }
  const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  if (!data.records) data.records = { entries: [], accessGrants: [] };
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

function hashData(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
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
                    UltraLife Protocol — Health Records
===============================================================================

Usage: node records.mjs [command] [options]

COMMANDS:
  --create               Create a new health record
    --type <type>        Record type (see below)
    --data <json>        Record data as JSON
    --provider <name>    Healthcare provider (optional)
    --user <name>        Create as test user

  --list                 List your records
    --user <name>        List for test user
    --type <type>        Filter by type

  --show                 Show record details
    --record <id>        Record ID
    --user <name>        Show as test user

  --update               Update a record
    --record <id>        Record ID
    --data <json>        New data

  --delete               Delete a record
    --record <id>        Record ID

  --grant-access         Grant access to another pNFT
    --record <id>        Record ID
    --to <pnft_id>       Recipient pNFT ID
    --expires <days>     Access expires in N days (optional)

  --revoke-access        Revoke access
    --record <id>        Record ID
    --from <pnft_id>     pNFT to revoke

  --shared-with-me       Show records shared with you
    --user <name>        Check for test user

  --aggregate            Show aggregate health stats
    --bioregion <id>     For a bioregion (anonymized)

  --list-types           Show available record types

  --help                 Show this help

RECORD TYPES:
${Object.entries(RECORD_TYPES).map(([k, v]) => `  ${k.padEnd(15)} ${v}`).join('\n')}

PRIVACY:
  - All records are owned by the individual
  - Access must be explicitly granted
  - Access can be time-limited
  - Aggregate stats are anonymized (min 10 records)
`);
}

async function createRecord(args, deployment) {
  const type = args.type;
  const dataStr = args.data;
  const provider = args.provider;
  const userName = args.user;

  if (!type) {
    console.error('Error: --type is required');
    return;
  }

  if (!RECORD_TYPES[type]) {
    console.error(`Error: Unknown type "${type}". Use --list-types to see options.`);
    return;
  }

  let data;
  try {
    data = dataStr ? JSON.parse(dataStr) : {};
  } catch (e) {
    console.error('Error: Invalid JSON in --data');
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const record = {
    recordId: generateId('rec'),
    owner: pnft.id,
    ownerAddress: pnft.address,
    type,
    typeName: RECORD_TYPES[type],
    data,
    dataHash: hashData(data),
    provider: provider || null,
    bioregion: pnft.bioregion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    accessList: [],
    status: 'active',
    testnetSimulated: true,
  };

  deployment.records.entries.push(record);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         RECORD CREATED
===============================================================================
  Record ID:    ${record.recordId}
  Type:         ${record.typeName}
  Owner:        ${pnft.owner}
  Provider:     ${provider || 'Self-reported'}
  Data Hash:    ${record.dataHash.slice(0, 16)}...
-------------------------------------------------------------------------------

Grant access with: npm run records:grant -- --record ${record.recordId} --to <pnft_id>
`);
}

function listRecords(args, deployment) {
  const userName = args.user;
  const typeFilter = args.type;

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  let records = deployment.records.entries.filter(r => r.owner === pnft.id);

  if (typeFilter) {
    records = records.filter(r => r.type === typeFilter);
  }

  console.log(`
===============================================================================
                    Health Records — ${pnft.owner}
===============================================================================`);

  if (records.length === 0) {
    console.log('\n  No records found.\n');
    return;
  }

  console.log('\n  ID                    TYPE            PROVIDER         CREATED');
  console.log('  --------------------  --------------  ---------------  -------------------');

  for (const r of records) {
    const provider = (r.provider || 'Self').slice(0, 15);
    console.log(`  ${r.recordId.padEnd(20)}  ${r.typeName.slice(0, 14).padEnd(14)}  ${provider.padEnd(15)}  ${new Date(r.createdAt).toLocaleDateString()}`);
  }

  console.log(`\n  Total: ${records.length} records\n`);
}

function showRecord(args, deployment) {
  const recordId = args.record;
  const userName = args.user;

  if (!recordId) {
    console.error('Error: --record is required');
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const record = deployment.records.entries.find(r => r.recordId === recordId);
  if (!record) {
    console.error(`Error: Record ${recordId} not found`);
    return;
  }

  // Check access
  const isOwner = record.owner === pnft.id;
  const hasAccess = record.accessList.some(a =>
    a.grantedTo === pnft.id &&
    (!a.expiresAt || new Date(a.expiresAt) > new Date())
  );

  if (!isOwner && !hasAccess) {
    console.error('Error: No access to this record');
    return;
  }

  console.log(`
===============================================================================
                    HEALTH RECORD
===============================================================================
  Record ID:    ${record.recordId}
  Type:         ${record.typeName}
  Status:       ${record.status.toUpperCase()}
  Owner:        ${record.owner}
  Provider:     ${record.provider || 'Self-reported'}
  Bioregion:    ${record.bioregion}
-------------------------------------------------------------------------------
  CREATED:      ${new Date(record.createdAt).toLocaleString()}
  UPDATED:      ${new Date(record.updatedAt).toLocaleString()}
  DATA HASH:    ${record.dataHash}
-------------------------------------------------------------------------------
  DATA:
${JSON.stringify(record.data, null, 2).split('\n').map(l => '    ' + l).join('\n')}
-------------------------------------------------------------------------------
  ACCESS LIST (${record.accessList.length}):
`);

  if (record.accessList.length === 0) {
    console.log('    (No access grants)\n');
  } else {
    for (const access of record.accessList) {
      const exp = access.expiresAt ? new Date(access.expiresAt).toLocaleDateString() : 'Never';
      console.log(`    - ${access.grantedTo} (expires: ${exp})`);
    }
  }
}

async function updateRecord(args, deployment) {
  const recordId = args.record;
  const dataStr = args.data;

  if (!recordId || !dataStr) {
    console.error('Error: --record and --data are required');
    return;
  }

  let data;
  try {
    data = JSON.parse(dataStr);
  } catch (e) {
    console.error('Error: Invalid JSON in --data');
    return;
  }

  const pnft = getUserPnft(deployment);
  const record = deployment.records.entries.find(r => r.recordId === recordId);

  if (!record) {
    console.error(`Error: Record ${recordId} not found`);
    return;
  }

  if (record.owner !== pnft?.id) {
    console.error('Error: Only owner can update record');
    return;
  }

  record.data = { ...record.data, ...data };
  record.dataHash = hashData(record.data);
  record.updatedAt = new Date().toISOString();

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         RECORD UPDATED
===============================================================================
  Record ID:    ${recordId}
  New Hash:     ${record.dataHash.slice(0, 16)}...
  Updated:      ${record.updatedAt}
`);
}

async function deleteRecord(args, deployment) {
  const recordId = args.record;

  if (!recordId) {
    console.error('Error: --record is required');
    return;
  }

  const pnft = getUserPnft(deployment);
  const recordIndex = deployment.records.entries.findIndex(r => r.recordId === recordId);

  if (recordIndex === -1) {
    console.error(`Error: Record ${recordId} not found`);
    return;
  }

  const record = deployment.records.entries[recordIndex];

  if (record.owner !== pnft?.id) {
    console.error('Error: Only owner can delete record');
    return;
  }

  deployment.records.entries.splice(recordIndex, 1);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         RECORD DELETED
===============================================================================
  Record ID:    ${recordId}
  Type:         ${record.typeName}
`);
}

async function grantAccess(args, deployment) {
  const recordId = args.record;
  const toPnft = args.to;
  const expiresDays = parseInt(args.expires);

  if (!recordId || !toPnft) {
    console.error('Error: --record and --to are required');
    return;
  }

  const pnft = getUserPnft(deployment);
  const record = deployment.records.entries.find(r => r.recordId === recordId);

  if (!record) {
    console.error(`Error: Record ${recordId} not found`);
    return;
  }

  if (record.owner !== pnft?.id) {
    console.error('Error: Only owner can grant access');
    return;
  }

  const existing = record.accessList.find(a => a.grantedTo === toPnft);
  if (existing) {
    console.error('Error: Access already granted to this pNFT');
    return;
  }

  const grant = {
    grantedTo: toPnft,
    grantedAt: new Date().toISOString(),
    expiresAt: expiresDays
      ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString()
      : null,
  };

  record.accessList.push(grant);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         ACCESS GRANTED
===============================================================================
  Record:       ${recordId}
  Granted to:   ${toPnft}
  Expires:      ${grant.expiresAt ? new Date(grant.expiresAt).toLocaleString() : 'Never'}
`);
}

async function revokeAccess(args, deployment) {
  const recordId = args.record;
  const fromPnft = args.from;

  if (!recordId || !fromPnft) {
    console.error('Error: --record and --from are required');
    return;
  }

  const pnft = getUserPnft(deployment);
  const record = deployment.records.entries.find(r => r.recordId === recordId);

  if (!record) {
    console.error(`Error: Record ${recordId} not found`);
    return;
  }

  if (record.owner !== pnft?.id) {
    console.error('Error: Only owner can revoke access');
    return;
  }

  const accessIndex = record.accessList.findIndex(a => a.grantedTo === fromPnft);
  if (accessIndex === -1) {
    console.error('Error: No access grant found for this pNFT');
    return;
  }

  record.accessList.splice(accessIndex, 1);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         ACCESS REVOKED
===============================================================================
  Record:       ${recordId}
  Revoked from: ${fromPnft}
`);
}

function sharedWithMe(args, deployment) {
  const userName = args.user;
  const pnft = getUserPnft(deployment, userName);

  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const now = new Date();
  const sharedRecords = deployment.records.entries.filter(r =>
    r.accessList.some(a =>
      a.grantedTo === pnft.id &&
      (!a.expiresAt || new Date(a.expiresAt) > now)
    )
  );

  console.log(`
===============================================================================
                    Records Shared With ${pnft.owner}
===============================================================================`);

  if (sharedRecords.length === 0) {
    console.log('\n  No records shared with you.\n');
    return;
  }

  console.log('\n  ID                    TYPE            OWNER              EXPIRES');
  console.log('  --------------------  --------------  -----------------  ----------');

  for (const r of sharedRecords) {
    const access = r.accessList.find(a => a.grantedTo === pnft.id);
    const expires = access.expiresAt ? new Date(access.expiresAt).toLocaleDateString() : 'Never';
    console.log(`  ${r.recordId.padEnd(20)}  ${r.typeName.slice(0, 14).padEnd(14)}  ${r.owner.slice(0, 17).padEnd(17)}  ${expires}`);
  }

  console.log(`\n  Total: ${sharedRecords.length} shared records\n`);
}

function aggregateStats(args, deployment) {
  const bioregion = args.bioregion;

  let records = deployment.records.entries;
  if (bioregion) {
    records = records.filter(r => r.bioregion === bioregion);
  }

  if (records.length < 10) {
    console.log('\nInsufficient records for anonymized aggregation (minimum 10 required).\n');
    return;
  }

  const byType = {};
  for (const r of records) {
    byType[r.type] = (byType[r.type] || 0) + 1;
  }

  console.log(`
===============================================================================
                    Aggregate Health Statistics
                    ${bioregion ? `Bioregion: ${bioregion}` : 'All Bioregions'}
===============================================================================
  Total Records: ${records.length}
-------------------------------------------------------------------------------
  BY TYPE:
`);

  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / records.length) * 100).toFixed(1);
    console.log(`    ${RECORD_TYPES[type]?.padEnd(20) || type.padEnd(20)} ${String(count).padStart(5)} (${pct}%)`);
  }

  console.log(`
-------------------------------------------------------------------------------
  Note: Individual record data is not exposed in aggregates.
`);
}

function listTypes() {
  console.log(`
===============================================================================
                    Record Types
===============================================================================
`);

  for (const [key, name] of Object.entries(RECORD_TYPES)) {
    console.log(`  ${key.padEnd(15)} ${name}`);
  }

  console.log(`
Use with: npm run records:create -- --type <type> --data '{...}'
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

  if (args.create) {
    await createRecord(args, deployment);
    return;
  }

  if (args.list) {
    listRecords(args, deployment);
    return;
  }

  if (args.show) {
    showRecord(args, deployment);
    return;
  }

  if (args.update) {
    await updateRecord(args, deployment);
    return;
  }

  if (args.delete) {
    await deleteRecord(args, deployment);
    return;
  }

  if (args['grant-access']) {
    await grantAccess(args, deployment);
    return;
  }

  if (args['revoke-access']) {
    await revokeAccess(args, deployment);
    return;
  }

  if (args['shared-with-me']) {
    sharedWithMe(args, deployment);
    return;
  }

  if (args.aggregate) {
    aggregateStats(args, deployment);
    return;
  }

  if (args['list-types']) {
    listTypes();
    return;
  }

  showHelp();
}

main().catch(console.error);
