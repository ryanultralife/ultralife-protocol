#!/usr/bin/env node
/**
 * UltraLife Protocol — Collective/DAO CLI
 *
 * Manage bioregion collectives and DAOs.
 *
 * Usage:
 *   node collective.mjs --create --name "Sierra Stewards" --bioregion sierra_nevada
 *   node collective.mjs --join --collective coll_123
 *   node collective.mjs --list
 *   node collective.mjs --show --collective coll_123
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_MEMBERS_FOR_QUORUM = 3;
const DEFAULT_QUORUM_PCT = 60;
const DEFAULT_APPROVAL_PCT = 51;

// =============================================================================
// HELPERS
// =============================================================================

function loadDeployment() {
  const deploymentPath = path.join(__dirname, 'deployment.json');
  if (!fs.existsSync(deploymentPath)) {
    return { collectives: [] };
  }
  const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  if (!data.collectives) data.collectives = [];
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
                    UltraLife Protocol — Collectives/DAOs
===============================================================================

Usage: node collective.mjs [command] [options]

COMMANDS:
  --create               Create a new collective
    --name <name>        Collective name
    --bioregion <id>     Bioregion ID
    --description <text> Description (optional)
    --quorum <pct>       Quorum percentage (default: ${DEFAULT_QUORUM_PCT})
    --approval <pct>     Approval threshold (default: ${DEFAULT_APPROVAL_PCT})

  --join                 Join a collective
    --collective <id>    Collective ID
    --user <name>        Join as test user

  --leave                Leave a collective
    --collective <id>    Collective ID
    --user <name>        Leave as test user

  --list                 List all collectives
    --bioregion <id>     Filter by bioregion

  --show                 Show collective details
    --collective <id>    Collective ID

  --propose              Create a collective proposal
    --collective <id>    Collective ID
    --title <title>      Proposal title
    --description <text> Description
    --type <type>        Type: treasury|membership|governance|project

  --vote                 Vote on proposal
    --proposal <id>      Proposal ID
    --vote <yes|no>      Vote direction
    --user <name>        Vote as test user

  --execute              Execute approved proposal
    --proposal <id>      Proposal ID

  --my-collectives       Show collectives you belong to
    --user <name>        Check for test user

  --help                 Show this help

COLLECTIVE TYPES:
  - Stewardship Collective: Land and resource management
  - Worker Collective: Labor coordination
  - Care Collective: Community care coordination
  - Project Collective: Specific initiatives
`);
}

async function createCollective(args, deployment) {
  const name = args.name;
  const bioregion = args.bioregion;
  const description = args.description || '';
  const quorum = parseInt(args.quorum) || DEFAULT_QUORUM_PCT;
  const approval = parseInt(args.approval) || DEFAULT_APPROVAL_PCT;

  if (!name) {
    console.error('Error: --name is required');
    return;
  }

  if (!bioregion) {
    console.error('Error: --bioregion is required');
    return;
  }

  const pnft = getUserPnft(deployment);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const collective = {
    collectiveId: generateId('coll'),
    name,
    bioregion,
    description,
    founder: pnft.id,
    founderAddress: pnft.address,
    members: [{
      pnftId: pnft.id,
      address: pnft.address,
      joinedAt: new Date().toISOString(),
      role: 'founder',
    }],
    governance: {
      quorumPct: quorum,
      approvalPct: approval,
      votingPeriodDays: 7,
    },
    proposals: [],
    treasury: {
      balance: 0,
      allocations: [],
    },
    createdAt: new Date().toISOString(),
    status: 'active',
    testnetSimulated: true,
  };

  deployment.collectives.push(collective);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         COLLECTIVE CREATED
===============================================================================
  ID:           ${collective.collectiveId}
  Name:         ${name}
  Bioregion:    ${bioregion}
  Founder:      ${pnft.owner}
-------------------------------------------------------------------------------
  GOVERNANCE:
    Quorum:     ${quorum}%
    Approval:   ${approval}%
    Voting:     7 days
-------------------------------------------------------------------------------

Members can join with: npm run collective:join -- --collective ${collective.collectiveId}
`);
}

async function joinCollective(args, deployment) {
  const collectiveId = args.collective;
  const userName = args.user;

  if (!collectiveId) {
    console.error('Error: --collective is required');
    return;
  }

  const collective = deployment.collectives.find(c => c.collectiveId === collectiveId);
  if (!collective) {
    console.error(`Error: Collective ${collectiveId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  if (pnft.bioregion !== collective.bioregion) {
    console.error(`Error: pNFT bioregion (${pnft.bioregion}) does not match collective (${collective.bioregion})`);
    return;
  }

  const existing = collective.members.find(m => m.pnftId === pnft.id);
  if (existing) {
    console.error('Error: Already a member of this collective');
    return;
  }

  collective.members.push({
    pnftId: pnft.id,
    address: pnft.address,
    joinedAt: new Date().toISOString(),
    role: 'member',
  });

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         JOINED COLLECTIVE
===============================================================================
  Collective:   ${collective.name}
  Member:       ${pnft.owner}
  Role:         member
  Members now:  ${collective.members.length}
`);
}

async function leaveCollective(args, deployment) {
  const collectiveId = args.collective;
  const userName = args.user;

  if (!collectiveId) {
    console.error('Error: --collective is required');
    return;
  }

  const collective = deployment.collectives.find(c => c.collectiveId === collectiveId);
  if (!collective) {
    console.error(`Error: Collective ${collectiveId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const memberIndex = collective.members.findIndex(m => m.pnftId === pnft.id);
  if (memberIndex === -1) {
    console.error('Error: Not a member of this collective');
    return;
  }

  const member = collective.members[memberIndex];
  if (member.role === 'founder' && collective.members.length > 1) {
    console.error('Error: Founder cannot leave while other members exist. Transfer ownership first.');
    return;
  }

  collective.members.splice(memberIndex, 1);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         LEFT COLLECTIVE
===============================================================================
  Collective:   ${collective.name}
  Member:       ${pnft.owner}
  Members now:  ${collective.members.length}
`);
}

function listCollectives(args, deployment) {
  let collectives = deployment.collectives || [];
  const bioregion = args.bioregion;

  if (bioregion) {
    collectives = collectives.filter(c => c.bioregion === bioregion);
  }

  console.log(`
===============================================================================
                    COLLECTIVES${bioregion ? ` — ${bioregion}` : ''}
===============================================================================`);

  if (collectives.length === 0) {
    console.log('\n  No collectives found.\n');
    return;
  }

  console.log('\n  ID                    NAME                    BIOREGION        MEMBERS');
  console.log('  --------------------  ----------------------  ---------------  -------');

  for (const c of collectives) {
    console.log(`  ${c.collectiveId.padEnd(20)}  ${c.name.slice(0, 22).padEnd(22)}  ${c.bioregion.padEnd(15)}  ${c.members.length}`);
  }

  console.log(`\n  Total: ${collectives.length} collectives\n`);
}

function showCollective(args, deployment) {
  const collectiveId = args.collective;

  if (!collectiveId) {
    console.error('Error: --collective is required');
    return;
  }

  const collective = deployment.collectives.find(c => c.collectiveId === collectiveId);
  if (!collective) {
    console.error(`Error: Collective ${collectiveId} not found`);
    return;
  }

  console.log(`
===============================================================================
                    ${collective.name}
===============================================================================
  ID:           ${collective.collectiveId}
  Bioregion:    ${collective.bioregion}
  Status:       ${collective.status.toUpperCase()}
  Created:      ${new Date(collective.createdAt).toLocaleString()}
  ${collective.description ? `Description:  ${collective.description}` : ''}
-------------------------------------------------------------------------------
  GOVERNANCE:
    Quorum:     ${collective.governance.quorumPct}%
    Approval:   ${collective.governance.approvalPct}%
    Voting:     ${collective.governance.votingPeriodDays} days
-------------------------------------------------------------------------------
  MEMBERS (${collective.members.length}):
`);

  for (const member of collective.members) {
    console.log(`    - ${member.pnftId} [${member.role}] (joined ${new Date(member.joinedAt).toLocaleDateString()})`);
  }

  console.log(`
-------------------------------------------------------------------------------
  TREASURY:
    Balance:    ${collective.treasury.balance} ULTRA
-------------------------------------------------------------------------------
  PROPOSALS:    ${collective.proposals.length} total
`);

  const active = collective.proposals.filter(p => p.status === 'active');
  if (active.length > 0) {
    console.log('  ACTIVE PROPOSALS:');
    for (const p of active) {
      console.log(`    - ${p.proposalId}: ${p.title}`);
    }
  }
}

async function createProposal(args, deployment) {
  const collectiveId = args.collective;
  const title = args.title;
  const description = args.description || '';
  const type = args.type || 'general';

  if (!collectiveId || !title) {
    console.error('Error: --collective and --title are required');
    return;
  }

  const collective = deployment.collectives.find(c => c.collectiveId === collectiveId);
  if (!collective) {
    console.error(`Error: Collective ${collectiveId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const isMember = collective.members.some(m => m.pnftId === pnft.id);
  if (!isMember) {
    console.error('Error: Must be a member to create proposals');
    return;
  }

  const proposal = {
    proposalId: generateId('cprop'),
    collectiveId,
    title,
    description,
    type,
    proposer: pnft.id,
    votes: [],
    status: 'active',
    createdAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + collective.governance.votingPeriodDays * 24 * 60 * 60 * 1000).toISOString(),
  };

  collective.proposals.push(proposal);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         PROPOSAL CREATED
===============================================================================
  ID:           ${proposal.proposalId}
  Collective:   ${collective.name}
  Title:        ${title}
  Type:         ${type}
  Proposer:     ${pnft.owner}
  Voting ends:  ${new Date(proposal.endsAt).toLocaleString()}
-------------------------------------------------------------------------------

Vote with: npm run collective:vote -- --proposal ${proposal.proposalId} --vote yes
`);
}

async function voteOnProposal(args, deployment) {
  const proposalId = args.proposal;
  const vote = args.vote?.toLowerCase();
  const userName = args.user;

  if (!proposalId || !vote) {
    console.error('Error: --proposal and --vote are required');
    return;
  }

  if (vote !== 'yes' && vote !== 'no') {
    console.error('Error: --vote must be "yes" or "no"');
    return;
  }

  // Find proposal
  let collective, proposal;
  for (const c of deployment.collectives) {
    const p = c.proposals.find(p => p.proposalId === proposalId);
    if (p) {
      collective = c;
      proposal = p;
      break;
    }
  }

  if (!proposal) {
    console.error(`Error: Proposal ${proposalId} not found`);
    return;
  }

  if (proposal.status !== 'active') {
    console.error(`Error: Proposal is ${proposal.status}`);
    return;
  }

  if (new Date() > new Date(proposal.endsAt)) {
    console.error('Error: Voting period has ended');
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const isMember = collective.members.some(m => m.pnftId === pnft.id);
  if (!isMember) {
    console.error('Error: Must be a member to vote');
    return;
  }

  const existingVote = proposal.votes.find(v => v.pnftId === pnft.id);
  if (existingVote) {
    console.error('Error: Already voted on this proposal');
    return;
  }

  proposal.votes.push({
    pnftId: pnft.id,
    vote: vote === 'yes',
    votedAt: new Date().toISOString(),
  });

  await saveDeploymentAsync(deployment);

  const yesVotes = proposal.votes.filter(v => v.vote).length;
  const noVotes = proposal.votes.filter(v => !v.vote).length;
  const totalVotes = proposal.votes.length;
  const quorum = (totalVotes / collective.members.length) * 100;

  console.log(`
===============================================================================
                         VOTE RECORDED
===============================================================================
  Proposal:     ${proposal.title}
  Your vote:    ${vote.toUpperCase()}
-------------------------------------------------------------------------------
  Current tally:
    Yes: ${yesVotes} | No: ${noVotes} | Total: ${totalVotes}
    Quorum: ${quorum.toFixed(1)}% (need ${collective.governance.quorumPct}%)
    Approval: ${totalVotes > 0 ? ((yesVotes / totalVotes) * 100).toFixed(1) : 0}% (need ${collective.governance.approvalPct}%)
`);
}

async function executeProposal(args, deployment) {
  const proposalId = args.proposal;

  if (!proposalId) {
    console.error('Error: --proposal is required');
    return;
  }

  let collective, proposal;
  for (const c of deployment.collectives) {
    const p = c.proposals.find(p => p.proposalId === proposalId);
    if (p) {
      collective = c;
      proposal = p;
      break;
    }
  }

  if (!proposal) {
    console.error(`Error: Proposal ${proposalId} not found`);
    return;
  }

  if (proposal.status !== 'active') {
    console.error(`Error: Proposal is ${proposal.status}`);
    return;
  }

  const yesVotes = proposal.votes.filter(v => v.vote).length;
  const totalVotes = proposal.votes.length;
  const quorum = (totalVotes / collective.members.length) * 100;
  const approval = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;

  if (quorum < collective.governance.quorumPct) {
    console.error(`Error: Quorum not met (${quorum.toFixed(1)}% < ${collective.governance.quorumPct}%)`);
    return;
  }

  if (approval < collective.governance.approvalPct) {
    proposal.status = 'rejected';
    await saveDeploymentAsync(deployment);
    console.log(`\nProposal REJECTED (${approval.toFixed(1)}% < ${collective.governance.approvalPct}%)\n`);
    return;
  }

  proposal.status = 'executed';
  proposal.executedAt = new Date().toISOString();

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         PROPOSAL EXECUTED
===============================================================================
  Proposal:     ${proposal.title}
  Status:       EXECUTED
  Final vote:   ${yesVotes} yes / ${totalVotes - yesVotes} no
  Approval:     ${approval.toFixed(1)}%
`);
}

function myCollectives(args, deployment) {
  const userName = args.user;
  const pnft = getUserPnft(deployment, userName);

  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const myColls = deployment.collectives.filter(c =>
    c.members.some(m => m.pnftId === pnft.id)
  );

  console.log(`
===============================================================================
                    My Collectives — ${pnft.owner}
===============================================================================`);

  if (myColls.length === 0) {
    console.log('\n  Not a member of any collectives.\n');
    return;
  }

  for (const c of myColls) {
    const member = c.members.find(m => m.pnftId === pnft.id);
    console.log(`
  ${c.name}
    ID:       ${c.collectiveId}
    Role:     ${member.role}
    Members:  ${c.members.length}
    Bioregion: ${c.bioregion}`);
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

  if (args.create) {
    await createCollective(args, deployment);
    return;
  }

  if (args.join) {
    await joinCollective(args, deployment);
    return;
  }

  if (args.leave) {
    await leaveCollective(args, deployment);
    return;
  }

  if (args.list) {
    listCollectives(args, deployment);
    return;
  }

  if (args.show) {
    showCollective(args, deployment);
    return;
  }

  if (args.propose) {
    await createProposal(args, deployment);
    return;
  }

  if (args.vote) {
    await voteOnProposal(args, deployment);
    return;
  }

  if (args.execute) {
    await executeProposal(args, deployment);
    return;
  }

  if (args['my-collectives']) {
    myCollectives(args, deployment);
    return;
  }

  showHelp();
}

main().catch(console.error);
