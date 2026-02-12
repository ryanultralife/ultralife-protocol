#!/usr/bin/env node
/**
 * UltraLife Protocol — Governance CLI
 *
 * Bioregional democracy with 37-day voting cycles.
 * Proposals for budget, policy, emergency, and constitutional changes.
 *
 * Usage:
 *   node governance.mjs --propose --type budget --amount 1000 --recipient <addr> --desc "Fund restoration project"
 *   node governance.mjs --list-proposals
 *   node governance.mjs --show --proposal <id>
 *   node governance.mjs --vote --proposal <id> --for
 *   node governance.mjs --vote --proposal <id> --against
 *   node governance.mjs --tally --proposal <id>
 *   node governance.mjs --execute --proposal <id>
 *   node governance.mjs --my-votes
 *   node governance.mjs --current-cycle
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const deploymentPath = path.join(__dirname, 'deployment.json');

// =============================================================================
// CONSTANTS
// =============================================================================

const PROPOSAL_TYPES = {
  budget: {
    name: 'Budget',
    description: 'Allocate funds from treasury',
    votingPeriodDays: 7,
    threshold: 'majority',
    requiredLevel: 'Verified',
    stakeRequired: 100,
  },
  policy: {
    name: 'Policy',
    description: 'Change protocol rules or parameters',
    votingPeriodDays: 7,
    threshold: 'majority',
    requiredLevel: 'Verified',
    stakeRequired: 100,
  },
  emergency: {
    name: 'Emergency',
    description: 'Urgent action requiring fast decision',
    votingPeriodDays: 1,
    threshold: 'majority',
    requiredLevel: 'Steward',
    stakeRequired: 200,
  },
  constitutional: {
    name: 'Constitutional',
    description: 'Fundamental protocol change',
    votingPeriodDays: 37,
    threshold: 'supermajority',
    requiredLevel: 'Steward',
    stakeRequired: 500,
  },
};

const VOTING_WEIGHTS = {
  Basic: 0,      // Cannot vote
  Ward: 0,       // Cannot vote
  Standard: 1,
  Verified: 2,
  Steward: 3,
};

const QUORUM_THRESHOLD = 0.37;  // 37% of eligible voters
const MAJORITY_THRESHOLD = 0.50;  // >50%
const SUPERMAJORITY_THRESHOLD = 0.63;  // 63%

const PROPOSAL_STATUS = {
  active: 'Active',
  passed: 'Passed',
  failed: 'Failed',
  executed: 'Executed',
  expired: 'Expired',
};

// =============================================================================
// HELPERS
// =============================================================================

function loadDeployment() {
  if (!fs.existsSync(deploymentPath)) {
    return {
      governance: {
        proposals: [],
        votes: [],
        currentCycle: 1,
        cycleStartSlot: Date.now(),
      }
    };
  }
  const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  if (!data.governance) {
    data.governance = {
      proposals: [],
      votes: [],
      currentCycle: 1,
      cycleStartSlot: Date.now(),
    };
  }
  return data;
}

function saveDeployment(data) {
  fs.writeFileSync(deploymentPath, JSON.stringify(data, null, 2));
}

function generateId() {
  return 'prop_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function getCurrentCycle() {
  // 37-day cycles (PRC-37)
  const CYCLE_LENGTH_MS = 37 * 24 * 60 * 60 * 1000;
  const protocolStart = new Date('2026-01-01').getTime();
  const now = Date.now();
  return Math.floor((now - protocolStart) / CYCLE_LENGTH_MS) + 1;
}

function formatDate(timestamp) {
  return new Date(timestamp).toISOString().replace('T', ' ').substr(0, 19);
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
  // Default to main wallet pNFT
  if (deployment.pnfts && deployment.pnfts.length > 0) {
    const mainPnft = deployment.pnfts.find(p => p.isMainWallet) || deployment.pnfts[0];
    return { ...mainPnft, owner: 'Main', address: deployment.walletAddress };
  }
  return null;
}

function getUserBalance(deployment, userName) {
  if (userName && deployment.ultraBalances) {
    return deployment.ultraBalances[userName] || 0;
  }
  return deployment.ultraBalances?.['Main'] || 50;
}

function canPropose(level) {
  return level === 'Verified' || level === 'Steward';
}

function canVote(level) {
  return VOTING_WEIGHTS[level] > 0;
}

// =============================================================================
// COMMANDS
// =============================================================================

function showHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                    UltraLife Protocol — Governance                            ║
║                                                                               ║
║     Bioregional democracy. Every voice weighted by verification.              ║
║     37-day cycles. Transparent. On-chain.                                     ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Usage: node governance.mjs [command] [options]

COMMANDS:

  --propose                   Create a new proposal
    --type <type>             Proposal type: budget|policy|emergency|constitutional
    --desc <text>             Description of the proposal
    --bioregion <name>        Bioregion for the proposal (default: sierra_nevada)

    For budget proposals:
      --amount <n>            Amount in ULTRA to allocate
      --recipient <addr>      Recipient address or name

    For policy proposals:
      --parameter <name>      Parameter to change
      --value <value>         New value

    For emergency proposals:
      --action <text>         Emergency action description

    For constitutional proposals:
      --amendment <text>      Amendment text

  --list-proposals            List all proposals
    --status <status>         Filter by status: active|passed|failed|executed|expired
    --bioregion <name>        Filter by bioregion
    --type <type>             Filter by proposal type

  --show --proposal <id>      Show proposal details

  --vote --proposal <id>      Vote on a proposal
    --for                     Vote in favor
    --against                 Vote against
    --user <name>             Vote as test user

  --tally --proposal <id>     Show current vote tally

  --execute --proposal <id>   Execute a passed proposal

  --close --proposal <id>     Close an expired/failed proposal

  --my-votes                  Show your voting history
    --user <name>             Check for test user

  --current-cycle             Show current 37-day cycle info

  --list-types                Show proposal types and requirements

OPTIONS:
  --user <name>               Act as test user (Alice, Bob, etc.)
  --help                      Show this help message

PROPOSAL TYPES:
  budget          7-day vote, majority, 100 ULTRA stake - allocate treasury funds
  policy          7-day vote, majority, 100 ULTRA stake - change protocol rules
  emergency       1-day vote, majority, 200 ULTRA stake - urgent actions (Steward only)
  constitutional  37-day vote, supermajority (63%), 500 ULTRA stake - fundamental changes

VOTING WEIGHTS:
  Standard: 1 vote    Verified: 2 votes    Steward: 3 votes

STAKE MECHANICS:
  - Stake locked when proposal created
  - If quorum (37%) reached: stake returned regardless of outcome
  - If quorum not reached: stake forfeited to bioregion treasury
`);
}

function listTypes() {
  console.log('\n=== Proposal Types ===\n');
  console.log('TYPE            VOTING    THRESHOLD      STAKE    MIN LEVEL    DESCRIPTION');
  console.log('─'.repeat(90));

  for (const [key, type] of Object.entries(PROPOSAL_TYPES)) {
    console.log(
      `${key.padEnd(15)} ${(type.votingPeriodDays + 'd').padEnd(9)} ${type.threshold.padEnd(14)} ${(type.stakeRequired + ' ULTRA').padEnd(12)} ${type.requiredLevel.padEnd(12)} ${type.description}`
    );
  }

  console.log('\n=== Voting Weights ===\n');
  for (const [level, weight] of Object.entries(VOTING_WEIGHTS)) {
    const status = weight === 0 ? '(cannot vote)' : `${weight} vote${weight > 1 ? 's' : ''}`;
    console.log(`  ${level.padEnd(12)} ${status}`);
  }
}

function createProposal(args, deployment) {
  const type = args.type?.toLowerCase();
  const desc = args.desc || args.description;
  const bioregion = args.bioregion || 'sierra_nevada';
  const userName = args.user;

  if (!type || !PROPOSAL_TYPES[type]) {
    console.error('Error: Invalid proposal type. Use: budget, policy, emergency, constitutional');
    return;
  }

  if (!desc) {
    console.error('Error: --desc is required');
    return;
  }

  const proposalType = PROPOSAL_TYPES[type];
  const pnft = getUserPnft(deployment, userName);

  if (!pnft) {
    console.error('Error: No pNFT found. Mint a pNFT first.');
    return;
  }

  if (!canPropose(pnft.level)) {
    console.error(`Error: ${pnft.level} level cannot create proposals. Need Verified or Steward.`);
    return;
  }

  // Check minimum level for proposal type
  const levelOrder = ['Basic', 'Ward', 'Standard', 'Verified', 'Steward'];
  const userLevelIdx = levelOrder.indexOf(pnft.level);
  const requiredLevelIdx = levelOrder.indexOf(proposalType.requiredLevel);

  if (userLevelIdx < requiredLevelIdx) {
    console.error(`Error: ${type} proposals require ${proposalType.requiredLevel} level. You are ${pnft.level}.`);
    return;
  }

  // Check stake
  const balance = getUserBalance(deployment, userName);
  if (balance < proposalType.stakeRequired) {
    console.error(`Error: Insufficient balance. Need ${proposalType.stakeRequired} ULTRA stake, have ${balance.toFixed(2)}.`);
    return;
  }

  // Build proposal
  const now = Date.now();
  const votingEndMs = now + (proposalType.votingPeriodDays * 24 * 60 * 60 * 1000);

  const proposal = {
    id: generateId(),
    type: type,
    description: desc,
    bioregion: bioregion,
    proposer: pnft.owner,
    proposerPnft: pnft.tokenName || pnft.pnftId,
    proposerLevel: pnft.level,
    status: 'active',
    votingStart: now,
    votingEnd: votingEndMs,
    votingPeriodDays: proposalType.votingPeriodDays,
    threshold: proposalType.threshold,
    stakeAmount: proposalType.stakeRequired,
    stakeReturned: false,
    votesFor: 0,
    votesAgainst: 0,
    voteCount: 0,
    createdAt: now,
    cycle: getCurrentCycle(),
  };

  // Type-specific fields
  if (type === 'budget') {
    proposal.budgetAmount = parseFloat(args.amount) || 0;
    proposal.budgetRecipient = args.recipient || '';
  } else if (type === 'policy') {
    proposal.policyParameter = args.parameter || '';
    proposal.policyValue = args.value || '';
  } else if (type === 'emergency') {
    proposal.emergencyAction = args.action || desc;
  } else if (type === 'constitutional') {
    proposal.amendmentText = args.amendment || desc;
  }

  // Deduct stake
  const balanceKey = userName || 'Main';
  if (!deployment.ultraBalances) deployment.ultraBalances = {};
  deployment.ultraBalances[balanceKey] = (deployment.ultraBalances[balanceKey] || 50) - proposalType.stakeRequired;

  // Save proposal
  deployment.governance.proposals.push(proposal);
  saveDeployment(deployment);

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                   PROPOSAL CREATED                            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`  Proposal ID:    ${proposal.id}`);
  console.log(`  Type:           ${proposalType.name}`);
  console.log(`  Bioregion:      ${bioregion}`);
  console.log(`  Description:    ${desc}`);
  console.log(`  Proposer:       ${pnft.owner} (${pnft.level})`);
  console.log(`  Stake Locked:   ${proposalType.stakeRequired} ULTRA`);
  console.log(`  Voting Period:  ${proposalType.votingPeriodDays} days`);
  console.log(`  Voting Ends:    ${formatDate(votingEndMs)}`);
  console.log(`  Threshold:      ${proposalType.threshold === 'supermajority' ? '63% (supermajority)' : '>50% (majority)'}`);
  console.log(`  Quorum:         37% of eligible voters`);

  if (type === 'budget') {
    console.log(`  Budget Amount:  ${proposal.budgetAmount} ULTRA`);
    console.log(`  Recipient:      ${proposal.budgetRecipient}`);
  }

  console.log('\n  Status: ACTIVE - Voting is open');
  console.log(`\n  Vote with: node governance.mjs --vote --proposal ${proposal.id} --for`);
}

function listProposals(args, deployment) {
  const statusFilter = args.status?.toLowerCase();
  const bioregionFilter = args.bioregion;
  const typeFilter = args.type?.toLowerCase();

  let proposals = deployment.governance.proposals || [];

  // Update statuses based on time
  const now = Date.now();
  proposals = proposals.map(p => {
    if (p.status === 'active' && now > p.votingEnd) {
      // Check if passed or failed
      const quorumMet = p.voteCount >= Math.ceil(getEligibleVoters(deployment, p.bioregion) * QUORUM_THRESHOLD);
      const totalVotes = p.votesFor + p.votesAgainst;
      const threshold = p.threshold === 'supermajority' ? SUPERMAJORITY_THRESHOLD : MAJORITY_THRESHOLD;
      const passed = totalVotes > 0 && (p.votesFor / totalVotes) > threshold;

      p.status = quorumMet && passed ? 'passed' : 'failed';
    }
    return p;
  });

  if (statusFilter) {
    proposals = proposals.filter(p => p.status === statusFilter);
  }
  if (bioregionFilter) {
    proposals = proposals.filter(p => p.bioregion === bioregionFilter);
  }
  if (typeFilter) {
    proposals = proposals.filter(p => p.type === typeFilter);
  }

  console.log('\n=== Governance Proposals ===\n');

  if (proposals.length === 0) {
    console.log('  No proposals found.');
    return;
  }

  console.log('ID                  TYPE            STATUS      VOTES       BIOREGION        DESCRIPTION');
  console.log('─'.repeat(100));

  for (const p of proposals) {
    const votes = `${p.votesFor}/${p.votesAgainst}`;
    const timeLeft = p.votingEnd - now;
    const timeStr = timeLeft > 0 ? `${Math.ceil(timeLeft / (24*60*60*1000))}d left` : 'ended';
    const statusStr = p.status === 'active' ? `active (${timeStr})` : p.status;

    console.log(
      `${p.id.padEnd(19)} ${p.type.padEnd(15)} ${statusStr.padEnd(15)} ${votes.padEnd(11)} ${p.bioregion.padEnd(16)} ${p.description.substring(0, 30)}...`
    );
  }

  console.log(`\nTotal: ${proposals.length} proposal(s)`);
}

function showProposal(args, deployment) {
  const proposalId = args.proposal;

  if (!proposalId) {
    console.error('Error: --proposal <id> required');
    return;
  }

  const proposal = deployment.governance.proposals?.find(p => p.id === proposalId);

  if (!proposal) {
    console.error(`Error: Proposal ${proposalId} not found`);
    return;
  }

  const now = Date.now();
  const timeLeft = proposal.votingEnd - now;
  const totalVotes = proposal.votesFor + proposal.votesAgainst;
  const eligibleVoters = getEligibleVoters(deployment, proposal.bioregion);
  const quorumNeeded = Math.ceil(eligibleVoters * QUORUM_THRESHOLD);
  const quorumMet = proposal.voteCount >= quorumNeeded;

  console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
  console.log(`║  PROPOSAL: ${proposal.id.padEnd(56)}║`);
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

  console.log(`  Type:           ${PROPOSAL_TYPES[proposal.type]?.name || proposal.type}`);
  console.log(`  Status:         ${proposal.status.toUpperCase()}`);
  console.log(`  Bioregion:      ${proposal.bioregion}`);
  console.log(`  Proposer:       ${proposal.proposer} (${proposal.proposerLevel})`);
  console.log(`  Cycle:          ${proposal.cycle}`);
  console.log(`  Created:        ${formatDate(proposal.createdAt)}`);
  console.log(`  Voting Ends:    ${formatDate(proposal.votingEnd)}`);

  if (timeLeft > 0) {
    const daysLeft = Math.ceil(timeLeft / (24*60*60*1000));
    const hoursLeft = Math.ceil(timeLeft / (60*60*1000)) % 24;
    console.log(`  Time Left:      ${daysLeft} days, ${hoursLeft} hours`);
  } else {
    console.log(`  Time Left:      Voting ended`);
  }

  console.log(`\n  Description:`);
  console.log(`    ${proposal.description}`);

  if (proposal.type === 'budget') {
    console.log(`\n  Budget Details:`);
    console.log(`    Amount:     ${proposal.budgetAmount} ULTRA`);
    console.log(`    Recipient:  ${proposal.budgetRecipient}`);
  }

  console.log(`\n  ═══ VOTING TALLY ═══`);
  console.log(`  For:        ${proposal.votesFor} votes`);
  console.log(`  Against:    ${proposal.votesAgainst} votes`);
  console.log(`  Total:      ${totalVotes} weighted votes from ${proposal.voteCount} voters`);

  const threshold = proposal.threshold === 'supermajority' ? SUPERMAJORITY_THRESHOLD : MAJORITY_THRESHOLD;
  const currentApproval = totalVotes > 0 ? (proposal.votesFor / totalVotes * 100).toFixed(1) : 0;
  console.log(`\n  Approval:   ${currentApproval}% (need ${threshold * 100}%)`);
  console.log(`  Quorum:     ${proposal.voteCount}/${quorumNeeded} voters (${quorumMet ? 'MET' : 'NOT MET'})`);

  console.log(`\n  Stake:      ${proposal.stakeAmount} ULTRA ${proposal.stakeReturned ? '(returned)' : '(locked)'}`);

  // Projection
  if (proposal.status === 'active' && timeLeft > 0) {
    const passing = totalVotes > 0 && (proposal.votesFor / totalVotes) > threshold;
    console.log(`\n  Projection: ${quorumMet && passing ? 'PASSING' : 'NOT PASSING'} (if voting ended now)`);
  }
}

function vote(args, deployment) {
  const proposalId = args.proposal;
  const voteFor = args.for === true;
  const voteAgainst = args.against === true;
  const userName = args.user;

  if (!proposalId) {
    console.error('Error: --proposal <id> required');
    return;
  }

  if (!voteFor && !voteAgainst) {
    console.error('Error: Specify --for or --against');
    return;
  }

  if (voteFor && voteAgainst) {
    console.error('Error: Cannot vote both for and against');
    return;
  }

  const proposal = deployment.governance.proposals?.find(p => p.id === proposalId);

  if (!proposal) {
    console.error(`Error: Proposal ${proposalId} not found`);
    return;
  }

  if (proposal.status !== 'active') {
    console.error(`Error: Proposal is ${proposal.status}, not active`);
    return;
  }

  const now = Date.now();
  if (now > proposal.votingEnd) {
    console.error('Error: Voting period has ended');
    return;
  }

  const pnft = getUserPnft(deployment, userName);

  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  if (!canVote(pnft.level)) {
    console.error(`Error: ${pnft.level} level cannot vote. Need Standard, Verified, or Steward.`);
    return;
  }

  // Check if already voted
  const existingVote = deployment.governance.votes?.find(v =>
    v.proposalId === proposalId && v.voter === pnft.owner
  );

  if (existingVote) {
    console.error(`Error: ${pnft.owner} has already voted on this proposal`);
    return;
  }

  const weight = VOTING_WEIGHTS[pnft.level];

  // Record vote
  const voteRecord = {
    id: 'vote_' + Date.now().toString(36),
    proposalId: proposalId,
    voter: pnft.owner,
    voterPnft: pnft.tokenName || pnft.pnftId,
    voterLevel: pnft.level,
    voteFor: voteFor,
    weight: weight,
    timestamp: now,
  };

  if (!deployment.governance.votes) deployment.governance.votes = [];
  deployment.governance.votes.push(voteRecord);

  // Update proposal tally
  if (voteFor) {
    proposal.votesFor += weight;
  } else {
    proposal.votesAgainst += weight;
  }
  proposal.voteCount++;

  saveDeployment(deployment);

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                      VOTE RECORDED                            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`  Proposal:  ${proposalId}`);
  console.log(`  Voter:     ${pnft.owner} (${pnft.level})`);
  console.log(`  Vote:      ${voteFor ? 'FOR' : 'AGAINST'}`);
  console.log(`  Weight:    ${weight} vote(s)`);

  const totalVotes = proposal.votesFor + proposal.votesAgainst;
  const approval = totalVotes > 0 ? (proposal.votesFor / totalVotes * 100).toFixed(1) : 0;

  console.log(`\n  Current Tally:`);
  console.log(`    For:      ${proposal.votesFor}`);
  console.log(`    Against:  ${proposal.votesAgainst}`);
  console.log(`    Approval: ${approval}%`);
}

function tally(args, deployment) {
  showProposal(args, deployment);
}

function executeProposal(args, deployment) {
  const proposalId = args.proposal;

  if (!proposalId) {
    console.error('Error: --proposal <id> required');
    return;
  }

  const proposal = deployment.governance.proposals?.find(p => p.id === proposalId);

  if (!proposal) {
    console.error(`Error: Proposal ${proposalId} not found`);
    return;
  }

  const now = Date.now();
  if (now <= proposal.votingEnd) {
    console.error('Error: Voting period has not ended yet');
    return;
  }

  // Check outcome
  const totalVotes = proposal.votesFor + proposal.votesAgainst;
  const eligibleVoters = getEligibleVoters(deployment, proposal.bioregion);
  const quorumNeeded = Math.ceil(eligibleVoters * QUORUM_THRESHOLD);
  const quorumMet = proposal.voteCount >= quorumNeeded;
  const threshold = proposal.threshold === 'supermajority' ? SUPERMAJORITY_THRESHOLD : MAJORITY_THRESHOLD;
  const passed = totalVotes > 0 && (proposal.votesFor / totalVotes) > threshold;

  if (!quorumMet) {
    console.error('Error: Quorum not reached. Use --close to close this proposal.');
    return;
  }

  if (!passed) {
    console.error('Error: Proposal did not pass. Use --close to close this proposal.');
    return;
  }

  // Execute based on type
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                   EXECUTING PROPOSAL                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  if (proposal.type === 'budget') {
    console.log(`  Executing budget allocation:`);
    console.log(`    Amount:    ${proposal.budgetAmount} ULTRA`);
    console.log(`    Recipient: ${proposal.budgetRecipient}`);

    // Simulate transfer from treasury
    if (!deployment.ultraBalances) deployment.ultraBalances = {};
    const recipientKey = proposal.budgetRecipient || 'BioregionTreasury';
    deployment.ultraBalances[recipientKey] = (deployment.ultraBalances[recipientKey] || 0) + proposal.budgetAmount;

    console.log(`    [Treasury transfer simulated]`);
  } else if (proposal.type === 'policy') {
    console.log(`  Executing policy change:`);
    console.log(`    Parameter: ${proposal.policyParameter}`);
    console.log(`    New Value: ${proposal.policyValue}`);
    console.log(`    [Policy recorded - enforcement is social]`);
  } else if (proposal.type === 'emergency') {
    console.log(`  Executing emergency action:`);
    console.log(`    Action: ${proposal.emergencyAction}`);
    console.log(`    [Emergency action recorded]`);
  } else if (proposal.type === 'constitutional') {
    console.log(`  Executing constitutional amendment:`);
    console.log(`    Amendment: ${proposal.amendmentText}`);
    console.log(`    [Amendment recorded - highest bar achieved]`);
  }

  // Return stake (quorum was met)
  const proposerKey = proposal.proposer === 'Main' ? 'Main' : proposal.proposer;
  if (!deployment.ultraBalances) deployment.ultraBalances = {};
  deployment.ultraBalances[proposerKey] = (deployment.ultraBalances[proposerKey] || 0) + proposal.stakeAmount;
  proposal.stakeReturned = true;

  proposal.status = 'executed';
  proposal.executedAt = now;

  saveDeployment(deployment);

  console.log(`\n  Stake returned: ${proposal.stakeAmount} ULTRA to ${proposal.proposer}`);
  console.log(`  Status: EXECUTED`);
}

function closeProposal(args, deployment) {
  const proposalId = args.proposal;

  if (!proposalId) {
    console.error('Error: --proposal <id> required');
    return;
  }

  const proposal = deployment.governance.proposals?.find(p => p.id === proposalId);

  if (!proposal) {
    console.error(`Error: Proposal ${proposalId} not found`);
    return;
  }

  const now = Date.now();
  if (now <= proposal.votingEnd) {
    console.error('Error: Voting period has not ended yet');
    return;
  }

  // Check outcome
  const totalVotes = proposal.votesFor + proposal.votesAgainst;
  const eligibleVoters = getEligibleVoters(deployment, proposal.bioregion);
  const quorumNeeded = Math.ceil(eligibleVoters * QUORUM_THRESHOLD);
  const quorumMet = proposal.voteCount >= quorumNeeded;
  const threshold = proposal.threshold === 'supermajority' ? SUPERMAJORITY_THRESHOLD : MAJORITY_THRESHOLD;
  const passed = totalVotes > 0 && (proposal.votesFor / totalVotes) > threshold;

  if (quorumMet && passed) {
    console.error('Error: Proposal passed. Use --execute to execute it.');
    return;
  }

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    CLOSING PROPOSAL                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  if (quorumMet) {
    // Quorum met but failed - return stake
    const proposerKey = proposal.proposer === 'Main' ? 'Main' : proposal.proposer;
    if (!deployment.ultraBalances) deployment.ultraBalances = {};
    deployment.ultraBalances[proposerKey] = (deployment.ultraBalances[proposerKey] || 0) + proposal.stakeAmount;
    proposal.stakeReturned = true;
    proposal.status = 'failed';

    console.log(`  Outcome: FAILED (did not reach ${threshold * 100}% approval)`);
    console.log(`  Stake returned: ${proposal.stakeAmount} ULTRA to ${proposal.proposer}`);
  } else {
    // Quorum not met - forfeit stake to bioregion
    const bioregionKey = `${proposal.bioregion}_treasury`;
    if (!deployment.ultraBalances) deployment.ultraBalances = {};
    deployment.ultraBalances[bioregionKey] = (deployment.ultraBalances[bioregionKey] || 0) + proposal.stakeAmount;
    proposal.stakeReturned = false;
    proposal.status = 'expired';

    console.log(`  Outcome: EXPIRED (quorum not reached)`);
    console.log(`  Stake forfeited: ${proposal.stakeAmount} ULTRA to ${proposal.bioregion} treasury`);
  }

  proposal.closedAt = now;
  saveDeployment(deployment);

  console.log(`  Status: ${proposal.status.toUpperCase()}`);
}

function myVotes(args, deployment) {
  const userName = args.user || 'Main';

  const votes = (deployment.governance.votes || []).filter(v => v.voter === userName);

  console.log(`\n=== Voting History for ${userName} ===\n`);

  if (votes.length === 0) {
    console.log('  No votes recorded.');
    return;
  }

  console.log('PROPOSAL            VOTE       WEIGHT    DATE');
  console.log('─'.repeat(60));

  for (const v of votes) {
    const proposal = deployment.governance.proposals?.find(p => p.id === v.proposalId);
    const voteStr = v.voteFor ? 'FOR' : 'AGAINST';
    console.log(
      `${v.proposalId.padEnd(19)} ${voteStr.padEnd(10)} ${v.weight.toString().padEnd(9)} ${formatDate(v.timestamp)}`
    );
  }

  console.log(`\nTotal: ${votes.length} vote(s)`);
}

function currentCycle(deployment) {
  const cycle = getCurrentCycle();
  const CYCLE_LENGTH_MS = 37 * 24 * 60 * 60 * 1000;
  const protocolStart = new Date('2026-01-01').getTime();
  const cycleStart = protocolStart + ((cycle - 1) * CYCLE_LENGTH_MS);
  const cycleEnd = cycleStart + CYCLE_LENGTH_MS;
  const now = Date.now();
  const progress = ((now - cycleStart) / CYCLE_LENGTH_MS * 100).toFixed(1);
  const daysLeft = Math.ceil((cycleEnd - now) / (24 * 60 * 60 * 1000));

  console.log('\n=== Current Governance Cycle ===\n');
  console.log(`  Cycle Number:  ${cycle}`);
  console.log(`  Cycle Start:   ${formatDate(cycleStart)}`);
  console.log(`  Cycle End:     ${formatDate(cycleEnd)}`);
  console.log(`  Progress:      ${progress}%`);
  console.log(`  Days Left:     ${daysLeft}`);

  // Active proposals
  const activeProposals = (deployment.governance.proposals || []).filter(p => p.status === 'active');
  console.log(`\n  Active Proposals: ${activeProposals.length}`);

  if (activeProposals.length > 0) {
    for (const p of activeProposals.slice(0, 5)) {
      console.log(`    - ${p.id}: ${p.description.substring(0, 40)}...`);
    }
  }
}

function getEligibleVoters(deployment, bioregion) {
  // Count users in bioregion who can vote
  let count = 0;

  // Count main wallet if verified
  const mainPnft = deployment.pnfts?.find(p => p.isMainWallet);
  if (mainPnft && canVote(mainPnft.level)) {
    count++;
  }

  // Count test users
  for (const user of (deployment.testUsers || [])) {
    if (user.pnft && canVote(user.pnft.level)) {
      count++;
    }
  }

  return Math.max(count, 1);  // At least 1 to avoid division by zero
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

  if (args.propose) {
    createProposal(args, deployment);
    return;
  }

  if (args['list-proposals']) {
    listProposals(args, deployment);
    return;
  }

  if (args.show && args.proposal) {
    showProposal(args, deployment);
    return;
  }

  if (args.vote) {
    vote(args, deployment);
    return;
  }

  if (args.tally) {
    tally(args, deployment);
    return;
  }

  if (args.execute) {
    executeProposal(args, deployment);
    return;
  }

  if (args.close) {
    closeProposal(args, deployment);
    return;
  }

  if (args['my-votes']) {
    myVotes(args, deployment);
    return;
  }

  if (args['current-cycle']) {
    currentCycle(deployment);
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
